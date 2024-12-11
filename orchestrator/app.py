import os
import json
import logging
from datetime import datetime, timezone
from quart import Quart, request, Response, jsonify
from prometheus_client import Counter, Histogram, Gauge
import psycopg2
from auth_middleware import require_auth
import discord_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Quart app
app = Quart(__name__)

# Prometheus metrics
REQUEST_TIME = Histogram('request_processing_seconds', 'Time spent processing request')
ACTIVE_CONNECTIONS = Gauge('active_connections', 'Number of active connections')
PROJECTS_TOTAL = Counter('projects_total', 'Total number of projects')
ACTIVE_PROJECTS = Gauge('active_projects', 'Number of active projects')
TASKS_TOTAL = Counter('tasks_total', 'Total number of tasks')
ACTIVE_TASKS = Gauge('active_tasks', 'Number of active tasks')
SYSTEM_INFO = Counter('system_info', 'System information', ['version'])

# Default project templates
DEFAULT_TEMPLATES = [
    {
        'id': 'web-app',
        'name': 'Web Application',
        'description': 'Template for web application projects',
        'tasks': [
            {'description': 'Setup development environment', 'status': 'pending'},
            {'description': 'Design database schema', 'status': 'pending'},
            {'description': 'Implement user authentication', 'status': 'pending'},
            {'description': 'Create API endpoints', 'status': 'pending'},
            {'description': 'Build frontend UI', 'status': 'pending'},
            {'description': 'Write tests', 'status': 'pending'},
            {'description': 'Deploy to staging', 'status': 'pending'},
            {'description': 'Perform security audit', 'status': 'pending'},
            {'description': 'Deploy to production', 'status': 'pending'}
        ]
    }
]

def get_db_connection():
    """Get a connection to the PostgreSQL database"""
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'database'),
        database=os.environ.get('DB_NAME', 'postgres'),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD', 'postgres')
    )

@app.route('/health')
async def health_check():
    """Health check endpoint"""
    return await jsonify({"status": "healthy"})

@app.route('/metrics')
async def metrics():
    """Prometheus metrics endpoint"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Update active projects count
        cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'active'")
        active_projects_count = cur.fetchone()[0]
        ACTIVE_PROJECTS.set(active_projects_count)
        
        # Update active tasks count
        cur.execute("SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'")
        active_tasks_count = cur.fetchone()[0]
        ACTIVE_TASKS.set(active_tasks_count)
        
        # Get total projects
        cur.execute("SELECT COUNT(*) FROM projects")
        total_projects = cur.fetchone()[0]
        
        # Get total tasks
        cur.execute("SELECT COUNT(*) FROM tasks")
        total_tasks = cur.fetchone()[0]
        
        # Get tasks by status
        cur.execute("""
            SELECT status, COUNT(*) 
            FROM tasks 
            GROUP BY status
        """)
        tasks_by_status = dict(cur.fetchall())
        
        # Get projects by status
        cur.execute("""
            SELECT status, COUNT(*) 
            FROM projects 
            GROUP BY status
        """)
        projects_by_status = dict(cur.fetchall())
        
        metrics_data = {
            "active_projects": active_projects_count,
            "active_tasks": active_tasks_count,
            "total_projects": total_projects,
            "total_tasks": total_tasks,
            "tasks_by_status": tasks_by_status,
            "projects_by_status": projects_by_status
        }
        
        return await jsonify(metrics_data)
    except Exception as e:
        logger.error(f"Error fetching metrics: {str(e)}")
        return await jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

@app.route('/api/login', methods=['POST'])
async def login():
    """Handle login requests"""
    try:
        data = await request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return await jsonify({"error": "Username and password are required"}), 400
        
        # For demo purposes, accept any username/password
        # In production, this should validate against a secure user store
        if data['username'] == 'admin' and data['password'] == 'adminadmin':
            from auth_middleware import create_jwt_token
            token = create_jwt_token(data['username'])
            return await jsonify({"token": token})
        else:
            return await jsonify({"error": "Invalid credentials"}), 401
            
    except Exception as e:
        logger.error(f"Error handling login: {str(e)}")
        return await jsonify({"error": str(e)}), 500

@app.route('/api/projects', methods=['GET', 'POST'])
@require_auth
async def handle_projects():
    """Handle project operations"""
    conn = None
    cur = None
    try:
        if request.method == 'POST':
            data = await request.get_json()
            
            if not data or 'name' not in data:
                return await jsonify({"error": "Project name is required"}), 400
                
            conn = get_db_connection()
            cur = conn.cursor()
            
            try:
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
                
                # If template is specified, create initial tasks
                if 'template' in data:
                    template = next((t for t in DEFAULT_TEMPLATES if t['id'] == data['template']), None)
                    if template:
                        for task in template['tasks']:
                            cur.execute(
                                '''
                                INSERT INTO tasks (project_id, description, status, created_at)
                                VALUES (%s, %s, %s, %s)
                                ''',
                                (project_id, task['description'], task['status'], datetime.now(timezone.utc))
                            )
                
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
                
                # Update metrics
                PROJECTS_TOTAL.inc()
                ACTIVE_PROJECTS.inc()
                
                response_data = {
                    'id': project[0],
                    'name': project[1],
                    'description': project[2],
                    'status': project[3],
                    'created_at': project[4].isoformat(),
                    'updated_at': project[5].isoformat() if project[5] else None,
                    'metadata': project[6]
                }
                
                # Send Discord notification
                try:
                    await discord_service.notify_project_update(
                        project_name=project[1],
                        update_type="Project Created",
                        details=f"New project '{project[1]}' has been created."
                    )
                except Exception as discord_error:
                    logger.error(f"Error sending Discord notification: {discord_error}")
                
                return await jsonify(response_data), 201
            except Exception as e:
                if conn:
                    conn.rollback()
                raise e
            
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
                    'updated_at': row[5].isoformat() if row[5] else None,
                    'metadata': row[6]
                })
                
            return await jsonify(projects)
            
    except Exception as e:
        logger.error(f"Error handling projects: {str(e)}")
        return await jsonify({"error": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 