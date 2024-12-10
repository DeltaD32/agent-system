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

# Define Prometheus metrics
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

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'components': {
            'database': check_database_health(),
            'message_queue': check_message_queue_health(),
            'ollama': check_ollama_health(),
            'websocket': {
                'status': 'healthy',
                'connections': get_websocket_connections()
            }
        }
    })

@app.route('/metrics')
def metrics():
    """Prometheus metrics endpoint"""
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

@app.route('/api/projects', methods=['GET'])
@require_auth
def list_projects():
    """List all projects"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute('SELECT * FROM projects ORDER BY created_at DESC')
            projects = cur.fetchall()
            
            # Format projects
            formatted_projects = []
            for project in projects:
                # Get tasks for this project
                cur.execute('SELECT * FROM tasks WHERE project_id = %s', (project[0],))
                tasks = cur.fetchall()
                
                formatted_projects.append({
                    'project': {
                        'id': project[0],
                        'name': project[1],
                        'description': project[2],
                        'status': project[3],
                        'created_at': project[4].isoformat(),
                        'updated_at': project[5].isoformat(),
                    },
                    'tasks': [
                        {
                            'id': task[0],
                            'description': task[2],
                            'status': task[3],
                            'assigned_agent': task[4],
                        }
                        for task in tasks
                    ]
                })
            
            return jsonify(formatted_projects)
    except Exception as e:
        app.logger.error(f"Error listing projects: {str(e)}")
        return jsonify({'error': 'Failed to list projects'}), 500

@app.route('/api/projects', methods=['POST'])
@require_auth
def create_project():
    """Create a new project"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data:
            return jsonify({'error': 'Project name is required'}), 400
        
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            # Insert project
            cur.execute(
                'INSERT INTO projects (name, description, status) VALUES (%s, %s, %s) RETURNING id',
                (data['name'], data.get('description', ''), 'pending')
            )
            project_id = cur.fetchone()[0]
            
            # If template is specified, create tasks from template
            if 'template_id' in data:
                template = get_template_by_id(data['template_id'])
                if template and template.get('tasks'):
                    for task in template['tasks']:
                        cur.execute(
                            'INSERT INTO tasks (project_id, description, status) VALUES (%s, %s, %s)',
                            (project_id, task['description'], 'pending')
                        )
            
            conn.commit()
            
            return jsonify({
                'message': 'Project created successfully',
                'project_id': project_id
            }), 201
            
    except Exception as e:
        app.logger.error(f"Error creating project: {str(e)}")
        return jsonify({'error': 'Failed to create project'}), 500

@app.route('/api/projects/<int:project_id>', methods=['GET'])
@require_auth
def get_project(project_id):
    """Get project details"""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            # Get project
            cur.execute('SELECT * FROM projects WHERE id = %s', (project_id,))
            project = cur.fetchone()
            
            if not project:
                return jsonify({'error': 'Project not found'}), 404
            
            # Get tasks
            cur.execute('SELECT * FROM tasks WHERE project_id = %s', (project_id,))
            tasks = cur.fetchall()
            
            return jsonify({
                'project': {
                    'id': project[0],
                    'name': project[1],
                    'description': project[2],
                    'status': project[3],
                    'created_at': project[4].isoformat(),
                    'updated_at': project[5].isoformat(),
                },
                'tasks': [
                    {
                        'id': task[0],
                        'description': task[2],
                        'status': task[3],
                        'assigned_agent': task[4],
                    }
                    for task in tasks
                ]
            })
    except Exception as e:
        app.logger.error(f"Error getting project: {str(e)}")
        return jsonify({'error': 'Failed to get project'}), 500

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

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Username and password are required'}), 400
    
    if data['username'] == ADMIN_USERNAME and data['password'] == ADMIN_PASSWORD:
        token = create_jwt_token(data['username'])
        return jsonify({
            'token': token,
            'username': data['username']
        })
    
    return jsonify({'error': 'Invalid credentials'}), 401

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 