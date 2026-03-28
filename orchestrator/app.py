import os
import json
import logging
from datetime import datetime, timezone
from quart import Quart, request, jsonify
from prometheus_client import Counter, Histogram, Gauge
import psycopg2
from auth_middleware import require_auth
import discord_service
from websocket_handler import ws_bp, setup_broadcast
from services import llm_router, agent_manager, obsidian_service, pm_agent
from services.agent_manager import AgentRole, AgentStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Quart(__name__)
app.register_blueprint(ws_bp)

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------
REQUEST_TIME    = Histogram('request_processing_seconds', 'Time spent processing request')
ACTIVE_CONNECTIONS = Gauge('active_connections', 'Number of active connections')
PROJECTS_TOTAL  = Counter('projects_total', 'Total number of projects')
ACTIVE_PROJECTS = Gauge('active_projects', 'Number of active projects')
TASKS_TOTAL     = Counter('tasks_total', 'Total number of tasks')
ACTIVE_TASKS    = Gauge('active_tasks', 'Number of active tasks')
SYSTEM_INFO     = Counter('system_info', 'System information', ['version'])

DEFAULT_TEMPLATES = [
    {
        'id': 'web-app',
        'name': 'Web Application',
        'description': 'Template for web application projects',
        'tasks': [
            {'description': 'Setup development environment', 'status': 'pending'},
            {'description': 'Design database schema',        'status': 'pending'},
            {'description': 'Implement user authentication', 'status': 'pending'},
            {'description': 'Create API endpoints',          'status': 'pending'},
            {'description': 'Build frontend UI',             'status': 'pending'},
            {'description': 'Write tests',                   'status': 'pending'},
            {'description': 'Deploy to staging',             'status': 'pending'},
            {'description': 'Perform security audit',        'status': 'pending'},
            {'description': 'Deploy to production',          'status': 'pending'},
        ]
    }
]


def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'database'),
        database=os.environ.get('DB_NAME', 'postgres'),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD', 'postgres'),
    )


# ---------------------------------------------------------------------------
# App startup
# ---------------------------------------------------------------------------

@app.before_serving
async def startup():
    setup_broadcast(app)
    # Ensure the PM agent exists at boot
    await agent_manager.ensure_pm_agent()
    logger.info("Orchestrator started — PM agent ready.")


# ---------------------------------------------------------------------------
# Health / Metrics
# ---------------------------------------------------------------------------

@app.route('/health')
async def health_check():
    llm_status = await llm_router.health_check()
    return await jsonify({"status": "healthy", "llm_backends": llm_status})


@app.route('/metrics')
async def metrics():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM projects WHERE status = 'active'")
        active_projects_count = cur.fetchone()[0]
        ACTIVE_PROJECTS.set(active_projects_count)
        cur.execute("SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'")
        active_tasks_count = cur.fetchone()[0]
        ACTIVE_TASKS.set(active_tasks_count)
        cur.execute("SELECT COUNT(*) FROM projects")
        total_projects = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tasks")
        total_tasks = cur.fetchone()[0]
        cur.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status")
        tasks_by_status = dict(cur.fetchall())
        cur.execute("SELECT status, COUNT(*) FROM projects GROUP BY status")
        projects_by_status = dict(cur.fetchall())
        return await jsonify({
            "active_projects": active_projects_count,
            "active_tasks": active_tasks_count,
            "total_projects": total_projects,
            "total_tasks": total_tasks,
            "tasks_by_status": tasks_by_status,
            "projects_by_status": projects_by_status,
            "active_agents": len(agent_manager.get_all_agents()),
        })
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        return await jsonify({"error": str(e)}), 500
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.route('/api/login', methods=['POST'])
async def login():
    try:
        data = await request.get_json()
        if not data or 'username' not in data or 'password' not in data:
            return await jsonify({"error": "Username and password are required"}), 400
        if data['username'] == 'admin' and data['password'] == 'adminadmin':
            from auth_middleware import create_jwt_token
            token = create_jwt_token(data['username'])
            return await jsonify({"token": token})
        return await jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        return await jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@app.route('/api/projects', methods=['GET', 'POST'])
@require_auth
async def handle_projects():
    conn = cur = None
    try:
        if request.method == 'POST':
            data = await request.get_json()
            if not data or 'name' not in data:
                return await jsonify({"error": "Project name is required"}), 400
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                'INSERT INTO projects (name, description, status, created_at, metadata) '
                'VALUES (%s, %s, %s, %s, %s) RETURNING id',
                (data['name'], data.get('description', ''), 'active',
                 datetime.now(timezone.utc), json.dumps(data.get('metadata', {})))
            )
            project_id = cur.fetchone()[0]
            if 'template' in data:
                tmpl = next((t for t in DEFAULT_TEMPLATES if t['id'] == data['template']), None)
                if tmpl:
                    for task in tmpl['tasks']:
                        cur.execute(
                            'INSERT INTO tasks (project_id, description, status, created_at) '
                            'VALUES (%s, %s, %s, %s)',
                            (project_id, task['description'], task['status'],
                             datetime.now(timezone.utc))
                        )
            conn.commit()
            cur.execute(
                'SELECT id, name, description, status, created_at, updated_at, metadata '
                'FROM projects WHERE id = %s', (project_id,)
            )
            p = cur.fetchone()
            PROJECTS_TOTAL.inc()
            ACTIVE_PROJECTS.inc()
            resp = {
                'id': p[0], 'name': p[1], 'description': p[2], 'status': p[3],
                'created_at': p[4].isoformat(),
                'updated_at': p[5].isoformat() if p[5] else None,
                'metadata': p[6],
            }
            try:
                await discord_service.notify_project_update(
                    project_name=p[1], update_type="Project Created",
                    details=f"New project '{p[1]}' has been created."
                )
            except Exception:
                pass
            return await jsonify(resp), 201
        else:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                'SELECT id, name, description, status, created_at, updated_at, metadata '
                'FROM projects ORDER BY created_at DESC'
            )
            projects = [
                {'id': r[0], 'name': r[1], 'description': r[2], 'status': r[3],
                 'created_at': r[4].isoformat(),
                 'updated_at': r[5].isoformat() if r[5] else None,
                 'metadata': r[6]}
                for r in cur.fetchall()
            ]
            return await jsonify(projects)
    except Exception as e:
        logger.error(f"Error handling projects: {e}")
        return await jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()


# ---------------------------------------------------------------------------
# Chat with PM Agent
# ---------------------------------------------------------------------------

@app.route('/api/chat', methods=['POST'])
@require_auth
async def chat():
    """Send a message to the Project Manager agent."""
    try:
        data = await request.get_json()
        if not data or 'message' not in data:
            return await jsonify({"error": "message is required"}), 400
        result = await pm_agent.handle_message(data['message'])
        return await jsonify(result)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return await jsonify({"error": str(e)}), 500


@app.route('/api/chat/history', methods=['GET'])
@require_auth
async def chat_history():
    limit = int(request.args.get('limit', 50))
    return await jsonify(pm_agent.get_chat_history(limit))


@app.route('/api/chat/status', methods=['GET'])
@require_auth
async def agent_status_report():
    report = await pm_agent.get_status_report()
    return await jsonify({"report": report})


# ---------------------------------------------------------------------------
# Agent Management
# ---------------------------------------------------------------------------

@app.route('/api/agents', methods=['GET'])
@require_auth
async def list_agents():
    return await jsonify(agent_manager.get_all_agents())


@app.route('/api/agents/spawn', methods=['POST'])
@require_auth
async def spawn_agent():
    try:
        data = await request.get_json()
        role_str = data.get('role', 'researcher')
        try:
            role = AgentRole(role_str)
        except ValueError:
            return await jsonify({"error": f"Unknown role: {role_str}"}), 400
        agent = await agent_manager.spawn_agent(
            role,
            name=data.get('name'),
            prefer_remote_gpu=data.get('prefer_remote_gpu', False),
        )
        return await jsonify(agent.to_dict()), 201
    except Exception as e:
        return await jsonify({"error": str(e)}), 500


@app.route('/api/agents/<agent_id>', methods=['DELETE'])
@require_auth
async def despawn_agent(agent_id):
    await agent_manager.despawn_agent(agent_id)
    return await jsonify({"status": "removed"})


@app.route('/api/agents/roles', methods=['GET'])
async def agent_roles():
    return await jsonify([r.value for r in AgentRole])


# ---------------------------------------------------------------------------
# Obsidian Vault
# ---------------------------------------------------------------------------

@app.route('/api/vault/notes', methods=['GET'])
@require_auth
async def vault_list():
    folder = request.args.get('folder', '')
    notes = await obsidian_service.list_notes(folder)
    return await jsonify(notes)


@app.route('/api/vault/notes/<path:note_path>', methods=['GET'])
@require_auth
async def vault_read(note_path):
    note = await obsidian_service.read_note(note_path)
    if note is None:
        return await jsonify({"error": "Note not found"}), 404
    return await jsonify(note)


@app.route('/api/vault/notes', methods=['POST'])
@require_auth
async def vault_write():
    try:
        data = await request.get_json()
        result = await obsidian_service.write_note(
            data['path'],
            data.get('body', ''),
            meta=data.get('meta'),
        )
        return await jsonify(result), 201
    except Exception as e:
        return await jsonify({"error": str(e)}), 500


@app.route('/api/vault/search', methods=['GET'])
@require_auth
async def vault_search():
    q = request.args.get('q', '')
    if not q:
        return await jsonify({"error": "q parameter required"}), 400
    results = await obsidian_service.search_vault(q)
    return await jsonify(results)


# ---------------------------------------------------------------------------
# LLM Backend Status
# ---------------------------------------------------------------------------

@app.route('/api/llm/status', methods=['GET'])
@require_auth
async def llm_status():
    status = await llm_router.health_check()
    return await jsonify(status)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
