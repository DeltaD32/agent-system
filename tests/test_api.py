import pytest
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
