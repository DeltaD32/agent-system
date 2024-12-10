import os
from flask import Flask, request, jsonify, Response
import pika
import psycopg2
from prometheus_client import start_http_server, Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
import json
import ollama
from flask_cors import CORS
import logging
import colorlog
import datetime
import simple_websocket
from threading import Lock
from queue import Queue
import threading
from auth_middleware import token_required, create_jwt_token, create_service_tokens

# Set up logging
handler = colorlog.StreamHandler()
handler.setFormatter(colorlog.ColoredFormatter(
    '%(log_color)s%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    log_colors={
        'DEBUG': 'cyan',
        'INFO': 'green',
        'WARNING': 'yellow',
        'ERROR': 'red',
        'CRITICAL': 'red,bg_white',
    }
))

logger = logging.getLogger('orchestrator')
logger.addHandler(handler)
logger.setLevel(logging.INFO)

app = Flask(__name__)
CORS(app)

# Prometheus metrics
PROJECT_COUNTER = Counter('projects_created_total', 'Total number of projects created')
ACTIVE_TASKS = Gauge('active_tasks', 'Number of active tasks')
TASK_PROCESSING_TIME = Gauge('task_processing_time_seconds', 'Time taken to process tasks')
MISTRAL_REQUESTS = Counter('mistral_requests_total', 'Total number of requests to Mistral')
MISTRAL_ERRORS = Counter('mistral_errors_total', 'Total number of Mistral request errors')
WORKER_CONNECTIONS = Gauge('worker_connections', 'Number of active worker connections')

@app.route('/metrics')
def metrics():
    """Endpoint for Prometheus metrics"""
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

# Global variables for WebSocket connections and message queue
ws_connections = set()
ws_lock = Lock()
message_queue = Queue()

def broadcast_message(message_type, data):
    """Add message to queue for broadcasting to all WebSocket clients"""
    message = {
        'type': message_type,
        'timestamp': datetime.datetime.now().isoformat(),
        'data': data
    }
    message_queue.put(json.dumps(message))

def emit_log(level, message, data=None):
    """Emit a log message to both logger and WebSocket clients"""
    log_entry = {
        'level': level,
        'message': message,
        'data': data
    }
    if level == 'error':
        logger.error(message)
    else:
        logger.info(message)
    broadcast_message('log_message', log_entry)

def emit_agent_interaction(from_agent, to_agent, message_type, data=None):
    """Emit agent interaction event to WebSocket clients"""
    interaction = {
        'from': from_agent,
        'to': to_agent,
        'type': message_type,
        'data': data
    }
    broadcast_message('agent_interaction', interaction)

@app.route('/ws')
def websocket():
    """WebSocket endpoint for real-time updates"""
    try:
        ws = simple_websocket.Server(request.environ)
        with ws_lock:
            ws_connections.add(ws)
            WORKER_CONNECTIONS.set(len(ws_connections))
        
        try:
            while True:
                # Keep connection alive and handle any incoming messages
                msg = ws.receive()
                if msg is None:
                    break
        except:
            pass
        finally:
            with ws_lock:
                ws_connections.remove(ws)
                WORKER_CONNECTIONS.set(len(ws_connections))
            ws.close()
    except simple_websocket.ConnectionError:
        return 'WebSocket connection failed', 400
    return Response()

def websocket_broadcast_worker():
    """Worker thread to broadcast messages to all WebSocket clients"""
    while True:
        message = message_queue.get()
        with ws_lock:
            disconnected = set()
            for ws in ws_connections:
                try:
                    ws.send(message)
                except:
                    disconnected.add(ws)
            
            # Remove disconnected clients
            for ws in disconnected:
                try:
                    ws.close()
                except:
                    pass
                ws_connections.remove(ws)

# Initialize Ollama client with base URL from environment
ollama_client = ollama.Client(base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'))

def check_database():
    """Check database connection"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False

def check_rabbitmq():
    """Check RabbitMQ connection"""
    try:
        conn = get_rabbitmq_connection()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"RabbitMQ health check failed: {str(e)}")
        return False

def check_ollama():
    """Check Ollama connection"""
    try:
        ollama_client.list()
        return True
    except Exception as e:
        logger.error(f"Ollama health check failed: {str(e)}")
        return False

def perform_health_check():
    """Perform comprehensive health check"""
    db_healthy = check_database()
    mq_healthy = check_rabbitmq()
    ollama_healthy = check_ollama()
    
    system_status = 'healthy' if all([db_healthy, mq_healthy, ollama_healthy]) else 'degraded'
    
    return {
        'status': system_status,
        'timestamp': datetime.datetime.now().isoformat(),
        'components': {
            'database': 'healthy' if db_healthy else 'unhealthy',
            'message_queue': 'healthy' if mq_healthy else 'unhealthy',
            'ollama': 'healthy' if ollama_healthy else 'unhealthy',
            'websocket': {
                'status': 'healthy',
                'connections': len(ws_connections)
            }
        },
        'metrics': {
            'active_tasks': ACTIVE_TASKS._value.get(),
            'projects_created': PROJECT_COUNTER._value.get(),
            'mistral_requests': MISTRAL_REQUESTS._value.get(),
            'mistral_errors': MISTRAL_ERRORS._value.get()
        }
    }

@app.route('/health', methods=['GET'])
@app.route('/healthy', methods=['GET'])
def health_check():
    """Health check endpoint"""
    emit_log('info', 'Health check endpoint accessed')
    health_status = perform_health_check()
    return jsonify(health_status), 200 if health_status['status'] == 'healthy' else 503

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.environ['DB_HOST'],
        database=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )

# RabbitMQ connection
def get_rabbitmq_connection():
    credentials = pika.PlainCredentials(
        os.environ['RABBITMQ_USER'],
        os.environ['RABBITMQ_PASS']
    )
    return pika.BlockingConnection(
        pika.ConnectionParameters(
            host=os.environ['RABBITMQ_HOST'],
            credentials=credentials
        )
    )

def create_tables():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Create projects table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create tasks table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            project_id INTEGER REFERENCES projects(id),
            description TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            assigned_agent VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create users table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()

@app.route('/project', methods=['POST'])
@token_required
def create_project(current_user):
    data = request.json
    name = data.get('name')
    description = data.get('description')
    
    if not name or not description:
        emit_log('error', 'Invalid project creation request - missing name or description')
        return jsonify({'error': 'Name and description are required'}), 400
    
    emit_log('info', f'Creating new project: {name}')
    
    try:
        start_time = datetime.datetime.now()
        
        # Store project in database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            'INSERT INTO projects (name, description) VALUES (%s, %s) RETURNING id',
            (name, description)
        )
        project_id = cur.fetchone()[0]
        conn.commit()
        emit_log('info', f'Project {project_id} created in database')
        
        # Use Mistral to analyze project and create tasks
        emit_log('info', 'Requesting Mistral to analyze project and create tasks')
        emit_agent_interaction('orchestrator', 'mistral', 'task_analysis_request', {
            'project_id': project_id,
            'name': name,
            'description': description
        })
        
        MISTRAL_REQUESTS.inc()
        try:
            prompt = f"Analyze this project and break it down into tasks:\nName: {name}\nDescription: {description}"
            response = ollama_client.generate(model="mistral", prompt=prompt)
        except Exception as e:
            MISTRAL_ERRORS.inc()
            raise e
        
        emit_log('info', 'Received task analysis from Mistral')
        emit_agent_interaction('mistral', 'orchestrator', 'task_analysis_response')
        
        # Parse tasks from Mistral's response and store them
        tasks = parse_tasks_from_response(response['response'])
        emit_log('info', f'Created {len(tasks)} tasks from analysis')
        
        for task in tasks:
            cur.execute(
                'INSERT INTO tasks (project_id, description) VALUES (%s, %s) RETURNING id',
                (project_id, task)
            )
            task_id = cur.fetchone()[0]
            emit_log('info', f'Created task {task_id}: {task[:50]}...')
        
        conn.commit()
        cur.close()
        conn.close()
        
        # Distribute tasks to worker agents
        emit_log('info', f'Distributing tasks for project {project_id}')
        distribute_tasks(project_id)
        
        PROJECT_COUNTER.inc()
        end_time = datetime.datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        TASK_PROCESSING_TIME.set(processing_time)
        
        emit_log('info', f'Project {project_id} creation completed successfully')
        return jsonify({'project_id': project_id, 'message': 'Project created successfully'}), 201
        
    except Exception as e:
        emit_log('error', f'Error creating project: {str(e)}')
        return jsonify({'error': 'Failed to create project'}), 500

def parse_tasks_from_response(response_text):
    # This is a simple implementation - you might want to make it more sophisticated
    tasks = []
    lines = response_text.split('\n')
    for line in lines:
        if line.strip().startswith('-'):
            tasks.append(line.strip()[2:])
    return tasks

def distribute_tasks(project_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get all pending tasks for the project
        cur.execute(
            'SELECT id, description FROM tasks WHERE project_id = %s AND status = %s',
            (project_id, 'pending')
        )
        tasks = cur.fetchall()
        
        # Connect to RabbitMQ
        rabbitmq_conn = get_rabbitmq_connection()
        channel = rabbitmq_conn.channel()
        channel.queue_declare(queue='task_queue', durable=True)
        
        # Distribute tasks
        for task_id, description in tasks:
            task_data = {
                'task_id': task_id,
                'description': description,
                'project_id': project_id
            }
            channel.basic_publish(
                exchange='',
                routing_key='task_queue',
                body=json.dumps(task_data),
                properties=pika.BasicProperties(delivery_mode=2)
            )
            
            emit_log('info', f'Distributed task {task_id} to worker queue')
            emit_agent_interaction('orchestrator', 'worker_agents', 'task_assignment', {
                'task_id': task_id,
                'project_id': project_id
            })
            
            # Update task status
            cur.execute(
                'UPDATE tasks SET status = %s WHERE id = %s',
                ('assigned', task_id)
            )
            ACTIVE_TASKS.inc()
        
        conn.commit()
        cur.close()
        conn.close()
        rabbitmq_conn.close()
        
    except Exception as e:
        emit_log('error', f'Error distributing tasks: {str(e)}')
        raise

@app.route('/project/<int:project_id>', methods=['GET'])
def get_project_status(project_id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get project details
    cur.execute('SELECT * FROM projects WHERE id = %s', (project_id,))
    project = cur.fetchone()
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Get tasks for the project
    cur.execute('SELECT * FROM tasks WHERE project_id = %s', (project_id,))
    tasks = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify({
        'project': {
            'id': project[0],
            'name': project[1],
            'description': project[2],
            'status': project[3],
            'created_at': project[4].isoformat()
        },
        'tasks': [{
            'id': task[0],
            'description': task[2],
            'status': task[3],
            'assigned_agent': task[4],
            'created_at': task[5].isoformat()
        } for task in tasks]
    })

# Add authentication endpoints
@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Validate credentials against database
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT * FROM users WHERE username = %s', (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if user and check_password(password, user['password_hash']):
        token = create_jwt_token(user)
        service_tokens = create_service_tokens(user)
        return jsonify({
            'token': token,
            'serviceTokens': service_tokens
        })
    
    return jsonify({'message': 'Invalid credentials'}), 401

if __name__ == '__main__':
    # Start Prometheus metrics server
    start_http_server(8000)
    
    # Create database tables
    create_tables()
    
    # Start WebSocket broadcast worker thread
    broadcast_thread = threading.Thread(target=websocket_broadcast_worker, daemon=True)
    broadcast_thread.start()
    
    emit_log('info', 'Orchestrator starting up')
    # Start Flask application
    app.run(host='0.0.0.0', port=5000) 