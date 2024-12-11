import os
import json
import pika
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from prometheus_client import Counter, Gauge, Histogram, Info, generate_latest, CONTENT_TYPE_LATEST
import logging
from datetime import datetime, timezone
from auth_middleware import require_auth, token_required, create_jwt_token
import simple_websocket
import time
import platform
import requests

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

# Project metrics
PROJECTS_TOTAL = Gauge('project_total', 'Total number of projects')
ACTIVE_PROJECTS = Gauge('active_projects', 'Number of active projects')
TASKS_TOTAL = Gauge('project_tasks_total', 'Total number of tasks', ['project'])
TASKS_BY_STATUS = Gauge('project_tasks_by_status', 'Tasks by status', ['status'])
TASKS_BY_PRIORITY = Gauge('project_tasks_by_priority', 'Tasks by priority', ['priority'])
PROJECT_COMPLETION = Gauge('project_completion_percentage', 'Project completion percentage', ['project'])
TEAM_MEMBERS = Gauge('team_members_total', 'Total number of team members')
ONLINE_MEMBERS = Gauge('team_members_online', 'Number of online team members')
AGENT_COUNT = Gauge('ai_agents_total', 'Total number of AI agents')
AGENT_STATUS = Gauge('ai_agents_by_status', 'AI agents by status', ['status'])

# System metrics
REQUEST_TIME = Histogram('http_request_duration_seconds', 'HTTP request duration in seconds', ['endpoint'])
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
SYSTEM_INFO = Info('system_version', 'System version information')

# Default admin credentials
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'adminadmin'

# Global variables
active_connections = set()

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'database'),
        database=os.environ.get('DB_NAME', 'project_db'),
        user=os.environ.get('DB_USER', 'projectuser'),
        password=os.environ.get('DB_PASSWORD', 'projectpass')
    )

def update_metrics():
    """Update Prometheus metrics"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Update project metrics
        cur.execute("SELECT COUNT(*) FROM projects")
        total_projects = cur.fetchone()[0]
        PROJECTS_TOTAL.set(total_projects)

        cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'active'")
        active_projects = cur.fetchone()[0]
        ACTIVE_PROJECTS.set(active_projects)

        # Update task metrics
        cur.execute("SELECT project_id, COUNT(*) FROM tasks GROUP BY project_id")
        for project_id, count in cur.fetchall():
            TASKS_TOTAL.labels(project=str(project_id)).set(count)

        cur.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status")
        for status, count in cur.fetchall():
            TASKS_BY_STATUS.labels(status=status).set(count)

        cur.execute("SELECT priority, COUNT(*) FROM tasks GROUP BY priority")
        for priority, count in cur.fetchall():
            TASKS_BY_PRIORITY.labels(priority=priority).set(count)

        # Update project completion
        cur.execute("""
            SELECT p.id, 
                   COALESCE(CAST(COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS FLOAT) / 
                   NULLIF(COUNT(*), 0) * 100, 0)
            FROM projects p
            LEFT JOIN tasks t ON p.id = t.project_id
            GROUP BY p.id
        """)
        for project_id, completion in cur.fetchall():
            PROJECT_COMPLETION.labels(project=str(project_id)).set(completion)

        # Update agent metrics
        AGENT_COUNT.set(len(active_connections))
        healthy_agents = sum(1 for conn in active_connections if conn.get('status') == 'healthy')
        unhealthy_agents = len(active_connections) - healthy_agents
        AGENT_STATUS.labels(status='healthy').set(healthy_agents)
        AGENT_STATUS.labels(status='unhealthy').set(unhealthy_agents)

        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating metrics: {e}")

@app.route('/health')
def health():
    """Health check endpoint"""
    update_metrics()  # Update metrics before health check
    return jsonify({
        'status': 'healthy',
        'components': {
            'database': check_database_health(),
            'message_queue': check_message_queue_health(),
            'ollama': check_ollama_health(),
            'websocket': {
                'status': 'healthy',
                'connections': len(active_connections)
            }
        }
    })

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
    update_metrics()  # Update metrics before generating response
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

# Add metrics middleware
@app.before_request
def before_request():
    request.start_time = time.time()

@app.after_request
def after_request(response):
    if hasattr(request, 'start_time'):
        request_latency = time.time() - request.start_time
        REQUEST_TIME.labels(endpoint=request.endpoint).observe(request_latency)
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.endpoint or 'unknown',
            status=response.status_code
        ).inc()
    return response

# Update system info
SYSTEM_INFO.info({
    'version': '1.0.0',
    'python_version': platform.python_version(),
    'platform': platform.platform()
})

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

@app.route('/api/projects', methods=['GET', 'POST'])
@require_auth
def handle_projects():
    """Handle project operations"""
    try:
        if request.method == 'POST':
            data = request.get_json()
            
            if not data or 'name' not in data:
                return jsonify({"error": "Project name is required"}), 400
                
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Create project
            cur.execute(
                '''
                INSERT INTO projects (name, description, status, created_at, metadata)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                ''',
                (
                    data['name'],
                    data.get('description', ''),
                    'active',
                    datetime.now(timezone.utc),
                    json.dumps(data.get('metadata', {}))
                )
            )
            
            project_id = cur.fetchone()[0]
            conn.commit()
            
            # Get the created project
            cur.execute(
                '''
                SELECT id, name, description, status, created_at, updated_at, metadata
                FROM projects WHERE id = %s
                ''',
                (project_id,)
            )
            
            project = cur.fetchone()
            
            cur.close()
            conn.close()
            
            # Update metrics
            PROJECTS_TOTAL.inc()
            ACTIVE_PROJECTS.inc()
            
            return jsonify({
                'id': project[0],
                'name': project[1],
                'description': project[2],
                'status': project[3],
                'created_at': project[4].isoformat(),
                'updated_at': project[5].isoformat(),
                'metadata': project[6]
            }), 201
            
        else:  # GET request
            conn = get_db_connection()
            cur = conn.cursor()
            
            cur.execute(
                '''
                SELECT id, name, description, status, created_at, updated_at, metadata
                FROM projects
                ORDER BY created_at DESC
                '''
            )
            
            projects = []
            for row in cur.fetchall():
                projects.append({
                    'id': row[0],
                    'name': row[1],
                    'description': row[2],
                    'status': row[3],
                    'created_at': row[4].isoformat(),
                    'updated_at': row[5].isoformat(),
                    'metadata': row[6]
                })
                
            cur.close()
            conn.close()
            
            return jsonify(projects), 200
            
    except Exception as e:
        logger.error(f"Error handling projects: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<int:project_id>', methods=['GET', 'PUT', 'DELETE'])
@require_auth
def handle_project(project_id):
    """Handle individual project operations"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if request.method == 'GET':
            # Get project details
            cur.execute(
                '''
                SELECT id, name, description, status, created_at, updated_at, metadata
                FROM projects WHERE id = %s
                ''',
                (project_id,)
            )
            
            project = cur.fetchone()
            if not project:
                return jsonify({"error": "Project not found"}), 404

            # Get project tasks
            cur.execute(
                '''
                SELECT id, description, status, created_at, updated_at
                FROM tasks
                WHERE project_id = %s
                ORDER BY created_at DESC
                ''',
                (project_id,)
            )
            
            tasks = []
            for task in cur.fetchall():
                tasks.append({
                    'id': task[0],
                    'description': task[1],
                    'status': task[2],
                    'created_at': task[3].isoformat(),
                    'updated_at': task[4].isoformat() if task[4] else None
                })

            return jsonify({
                'id': project[0],
                'name': project[1],
                'description': project[2],
                'status': project[3],
                'created_at': project[4].isoformat(),
                'updated_at': project[5].isoformat() if project[5] else None,
                'metadata': project[6],
                'tasks': tasks
            }), 200

        elif request.method == 'PUT':
            data = request.get_json()
            
            if not data:
                return jsonify({"error": "No data provided"}), 400

            # Update project
            update_fields = []
            update_values = []
            
            if 'name' in data:
                update_fields.append('name = %s')
                update_values.append(data['name'])
            
            if 'description' in data:
                update_fields.append('description = %s')
                update_values.append(data['description'])
            
            if 'status' in data:
                update_fields.append('status = %s')
                update_values.append(data['status'])
            
            if 'metadata' in data:
                update_fields.append('metadata = %s')
                update_values.append(json.dumps(data['metadata']))
            
            update_fields.append('updated_at = %s')
            update_values.append(datetime.now(timezone.utc))
            
            # Add project_id to values
            update_values.append(project_id)
            
            if update_fields:
                query = f'''
                    UPDATE projects 
                    SET {', '.join(update_fields)}, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, name, description, status, created_at, updated_at, metadata
                '''
                
                cur.execute(query, update_values)
                updated_project = cur.fetchone()
                
                if not updated_project:
                    return jsonify({"error": "Project not found"}), 404
                
                conn.commit()
                
                return jsonify({
                    'id': updated_project[0],
                    'name': updated_project[1],
                    'description': updated_project[2],
                    'status': updated_project[3],
                    'created_at': updated_project[4].isoformat(),
                    'updated_at': updated_project[5].isoformat(),
                    'metadata': updated_project[6]
                }), 200
            
            return jsonify({"error": "No fields to update"}), 400

        elif request.method == 'DELETE':
            # Check if project exists
            cur.execute('SELECT id FROM projects WHERE id = %s', (project_id,))
            if not cur.fetchone():
                return jsonify({"error": "Project not found"}), 404

            # Delete associated tasks
            cur.execute('DELETE FROM tasks WHERE project_id = %s', (project_id,))
            
            # Delete the project
            cur.execute('DELETE FROM projects WHERE id = %s', (project_id,))
            
            conn.commit()
            
            # Update metrics
            ACTIVE_PROJECTS.dec()
            
            return jsonify({"message": "Project deleted successfully"}), 200

    except Exception as e:
        logger.error(f"Error handling project {project_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

def check_database_health():
    """Check database health"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT 1')
            cur.close()
            return 'healthy'
    except Exception as e:
        app.logger.error(f"Database health check failed: {str(e)}")
        return 'unhealthy'

def check_message_queue_health():
    """Check RabbitMQ health"""
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
        return 'healthy'
    except Exception as e:
        app.logger.error(f"Message queue health check failed: {str(e)}")
        return 'unhealthy'

def check_ollama_health():
    """Check Ollama health"""
    try:
        response = requests.get('http://ollama:11434/api/health')
        if response.status_code == 200:
            return 'healthy'
        return 'unhealthy'
    except Exception as e:
        app.logger.error(f"Ollama health check failed: {str(e)}")
        return 'unhealthy'

def get_websocket_connections():
    """Get current WebSocket connections count"""
    return len(active_connections)

@app.route('/api/login', methods=['POST'])
def login():
    """Handle user login"""
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({"error": "Missing username or password"}), 400
            
        # Check credentials against default admin
        if data['username'] == ADMIN_USERNAME and data['password'] == ADMIN_PASSWORD:
            # Generate JWT token
            token = create_jwt_token(data['username'])
            return jsonify({
                "token": token,
                "message": "Login successful"
            }), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401
            
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/projects', methods=['GET', 'POST'])
@require_auth
def projects():
    """Handle project operations"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if request.method == 'GET':
            # Get all projects
            cur.execute('''
                SELECT id, name, description, status, created_at, updated_at
                FROM projects
                ORDER BY created_at DESC
            ''')
            
            projects = []
            for row in cur.fetchall():
                projects.append({
                    'id': row[0],
                    'name': row[1],
                    'description': row[2],
                    'status': row[3],
                    'created_at': row[4].isoformat() if row[4] else None,
                    'updated_at': row[5].isoformat() if row[5] else None
                })
            
            return jsonify(projects), 200

        elif request.method == 'POST':
            data = request.get_json()
            
            if not data or 'name' not in data:
                return jsonify({"error": "Missing required fields"}), 400
                
            # Create project
            cur.execute(
                '''
                INSERT INTO projects (name, description, status, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                ''',
                (
                    data['name'],
                    data.get('description', ''),
                    'active',
                    datetime.now(timezone.utc),
                    datetime.now(timezone.utc)
                )
            )
            
            project_id = cur.fetchone()[0]
            conn.commit()
            
            # Update metrics
            PROJECTS_TOTAL.inc()
            ACTIVE_PROJECTS.inc()
            
            return jsonify({
                "id": project_id,
                "message": "Project created successfully"
            }), 201

    except Exception as e:
        logger.error(f"Error handling projects: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 