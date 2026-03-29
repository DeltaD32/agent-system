import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from backend.db.models import AgentRow, TaskRow, ProjectRow

@pytest.mark.asyncio
async def test_agent_row_creates(db_session):
    agent = AgentRow(
        id="agent-001",
        name="Coder-1",
        role="coder",
        specialization="Backend / FastAPI",
        status="idle",
        llm_backend="local_ollama",
        desk_col=2,
        desk_row=3,
    )
    db_session.add(agent)
    await db_session.commit()
    result = await db_session.get(AgentRow, "agent-001")
    assert result.role == "coder"
    assert result.desk_col == 2

@pytest.mark.asyncio
async def test_task_row_creates(db_session):
    # First create the parent agent
    agent = AgentRow(
        id="agent-002", name="PM-1", role="project_manager",
        status="idle", llm_backend="claude_api", desk_col=9, desk_row=0,
    )
    db_session.add(agent)
    await db_session.commit()

    task = TaskRow(
        id="task-001",
        agent_id="agent-002",
        description="Plan the project",
        status="pending",
        requested_by="user",
    )
    db_session.add(task)
    await db_session.commit()
    result = await db_session.get(TaskRow, "task-001")
    assert result.agent_id == "agent-002"
    assert result.completed_at is None

@pytest.mark.asyncio
async def test_project_row_creates(db_session):
    project = ProjectRow(
        id="proj-001",
        name="Home Server Setup",
        description="Research and improve home server",
        status="active",
    )
    db_session.add(project)
    await db_session.commit()
    result = await db_session.get(ProjectRow, "proj-001")
    assert result.name == "Home Server Setup"
    assert result.status == "active"


# ── Integration smoke tests ──────────────────────────────────────────────────
# Bypass the lifespan by injecting a fully-constructed AgentManager into the
# module global before each test.  This avoids real Redis / SQLite file deps.

import pytest_asyncio
import backend.main as main_module
from backend.agents.manager import AgentManager
from backend.agents.roles import AgentRole
from backend.llm.router import LLMRouter
from backend.memory.vault import VaultManager
from vault_init.setup import scaffold_vault


@pytest_asyncio.fixture
async def live_app(db_session, tmp_path):
    """Inject a test AgentManager into the app module and yield the ASGI app."""
    scaffold_vault(tmp_path)
    vault  = VaultManager(tmp_path)
    router = LLMRouter("http://localhost:11434", [], "llama3")
    mgr    = AgentManager(db_session=db_session, vault=vault, router=router, max_agents=6)
    # Pre-hire PM so the app is in a valid initial state
    with patch("backend.agents.manager.publish", new_callable=AsyncMock), \
         patch("backend.agents.runner.publish", new_callable=AsyncMock):
        await mgr.hire(AgentRole.PROJECT_MANAGER, specialization="General")
    main_module._manager = mgr
    yield main_module.app
    main_module._manager = None


@pytest.mark.asyncio
async def test_health_endpoint(live_app):
    async with AsyncClient(transport=ASGITransport(live_app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "llm" in data


@pytest.mark.asyncio
async def test_hire_and_dismiss_coder(live_app):
    with patch("backend.agents.manager.publish", new_callable=AsyncMock), \
         patch("backend.agents.runner.publish", new_callable=AsyncMock):
        async with AsyncClient(transport=ASGITransport(live_app), base_url="http://test") as client:
            # Hire
            resp = await client.post("/agents/hire", json={
                "role": "coder", "specialization": "Test"
            })
            assert resp.status_code == 200
            agent_id = resp.json()["agent_id"]

            # Appears in list
            resp = await client.get("/agents")
            ids = [a["id"] for a in resp.json()["agents"]]
            assert agent_id in ids

            # Dismiss
            resp = await client.delete(f"/agents/{agent_id}")
            assert resp.status_code == 200

            # Gone from list
            resp = await client.get("/agents")
            ids = [a["id"] for a in resp.json()["agents"]]
            assert agent_id not in ids


@pytest.mark.asyncio
async def test_cannot_hire_unknown_role(live_app):
    async with AsyncClient(transport=ASGITransport(live_app), base_url="http://test") as client:
        resp = await client.post("/agents/hire", json={"role": "wizard"})
    assert resp.status_code == 422
