import os
import json
import pika
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
import logging
from datetime import datetime, timezone
from auth_middleware import require_auth, token_required, create_jwt_token
import simple_websocket

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Prometheus metrics
TASKS_CREATED = Counter('tasks_created_total', 'Total number of tasks created')
TASKS_ASSIGNED = Counter('tasks_assigned_total', 'Total number of tasks assigned')
ACTIVE_AGENTS = Gauge('active_agents', 'Number of active worker agents')
ACTIVE_TASKS = Gauge('active_tasks', 'Number of active tasks')
MISTRAL_REQUESTS = Counter('mistral_requests_total', 'Total number of requests to Mistral')
MISTRAL_ERRORS = Counter('mistral_errors_total', 'Total number of Mistral errors')

# Default admin credentials
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'adminadmin'

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'database'),
        database=os.environ.get('DB_NAME', 'project_db'),
        user=os.environ.get('DB_USER', 'projectuser'),
        password=os.environ.get('DB_PASSWORD', 'projectpass')
    )

@app.route('/api/login', methods=['POST'])
def login():
    """Login endpoint to get JWT token"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    # Check against default admin credentials
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        token = create_jwt_token(username)
        return jsonify({'token': token}), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        # Check database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        db_status = 'healthy'
    except Exception:
        db_status = 'unhealthy'
    
    # Check RabbitMQ
    try:
        credentials = pika.PlainCredentials(
            os.environ.get('RABBITMQ_USER', 'guest'),
            os.environ.get('RABBITMQ_PASS', 'guest')
        )
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=os.environ.get('RABBITMQ_HOST', 'message_queue'),
                credentials=credentials
            )
        )
        connection.close()
        mq_status = 'healthy'
    except Exception:
        mq_status = 'unhealthy'
    
    # Get metrics
    metrics = {
        'active_tasks': ACTIVE_TASKS._value.get(),
        'mistral_requests': MISTRAL_REQUESTS._value.get(),
        'mistral_errors': MISTRAL_ERRORS._value.get(),
    }
    
    return jsonify({
        'components': {
            'database': db_status,
            'message_queue': mq_status,
            'ollama': 'healthy',  # Assuming Ollama is always available
            'websocket': {
                'status': 'healthy',
                'connections': 0  # TODO: Track actual connections
            }
        },
        'metrics': metrics
    })

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/agents', methods=['GET'])
@require_auth
def list_agents():
    """List all registered worker agents"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get all agents and their status
        cur.execute('''
            SELECT name, status, capabilities, last_heartbeat, metadata
            FROM worker_agents
            WHERE last_heartbeat > NOW() - INTERVAL '2 minutes'
            ORDER BY last_heartbeat DESC
        ''')
        
        agents = []
        for row in cur.fetchall():
            agents.append({
                'name': row[0],
                'status': row[1],
                'capabilities': row[2],
                'last_heartbeat': row[3].isoformat() if row[3] else None,
                'metadata': row[4]
            })
        
        # Update active agents metric
        ACTIVE_AGENTS.set(len(agents))
        
        cur.close()
        conn.close()
        
        return jsonify(agents), 200
        
    except Exception as e:
        logger.error(f"Error listing agents: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tasks', methods=['POST'])
@require_auth
def create_task():
    """Create a new task"""
    try:
        data = request.get_json()
        
        if not data or 'description' not in data:
            return jsonify({"error": "Missing required fields"}), 400
            
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create task
        cur.execute(
            '''
            INSERT INTO tasks (description, status, created_at, metadata)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            ''',
            (
                data['description'],
                'pending',
                datetime.now(timezone.utc),
                json.dumps(data.get('metadata', {}))
            )
        )
        
        task_id = cur.fetchone()[0]
        conn.commit()
        
        # Get available agent
        cur.execute(
            '''
            SELECT name 
            FROM worker_agents 
            WHERE status = 'available' 
            AND last_heartbeat > NOW() - INTERVAL '1 minute'
            ORDER BY last_heartbeat DESC 
            LIMIT 1
            '''
        )
        
        agent = cur.fetchone()
        
        if agent:
            agent_name = agent[0]
            
            # Update task with assigned agent
            cur.execute(
                'UPDATE tasks SET assigned_agent = %s WHERE id = %s',
                (agent_name, task_id)
            )
            
            # Update agent status
            cur.execute(
                'UPDATE worker_agents SET status = %s WHERE name = %s',
                ('busy', agent_name)
            )
            
            conn.commit()
            
            # Send task to agent's queue
            credentials = pika.PlainCredentials(
                os.environ.get('RABBITMQ_USER', 'guest'),
                os.environ.get('RABBITMQ_PASS', 'guest')
            )
            
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=os.environ.get('RABBITMQ_HOST', 'message_queue'),
                    credentials=credentials
                )
            )
            
            channel = connection.channel()
            
            # Declare queue for agent
            queue_name = f'agent_{agent_name}'
            channel.queue_declare(queue=queue_name, durable=True)
            
            # Send task to agent's queue
            message = {
                'task_id': task_id,
                'description': data['description']
            }
            
            channel.basic_publish(
                exchange='',
                routing_key=queue_name,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2  # make message persistent
                )
            )
            
            connection.close()
            
            TASKS_CREATED.inc()
            TASKS_ASSIGNED.inc()
            
            return jsonify({
                "task_id": task_id,
                "status": "assigned",
                "assigned_to": agent_name
            }), 201
            
        else:
            # No available agent
            return jsonify({
                "task_id": task_id,
                "status": "pending",
                "message": "No available agent found"
            }), 201
        
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
@require_auth
def get_task(task_id):
    """Get task status"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            '''
            SELECT id, description, status, assigned_agent, 
                   created_at, updated_at, completion_percentage, metadata
            FROM tasks
            WHERE id = %s
            ''',
            (task_id,)
        )
        
        task = cur.fetchone()
        
        if task:
            return jsonify({
                "id": task[0],
                "description": task[1],
                "status": task[2],
                "assigned_agent": task[3],
                "created_at": task[4].isoformat() if task[4] else None,
                "updated_at": task[5].isoformat() if task[5] else None,
                "completion_percentage": task[6],
                "metadata": task[7]
            }), 200
        else:
            return jsonify({"error": "Task not found"}), 404
            
    except Exception as e:
        logger.error(f"Error getting task: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 