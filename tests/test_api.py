import pytest
from backend.db.models import AgentRow, TaskRow

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
