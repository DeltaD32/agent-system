import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.agents.manager import AgentManager
from backend.agents.roles import AgentRole


@pytest_asyncio.fixture
async def manager(db_session, tmp_path):
    from vault_init.setup import scaffold_vault
    scaffold_vault(tmp_path)
    from backend.memory.vault import VaultManager
    from backend.llm.router import LLMRouter
    vault  = VaultManager(tmp_path)
    router = LLMRouter("http://localhost:11434", [], "llama3")
    return AgentManager(db_session=db_session, vault=vault, router=router, max_agents=4)


@pytest.mark.asyncio
async def test_hire_creates_agent(manager):
    with patch("backend.agents.manager.publish", new_callable=AsyncMock), \
         patch("backend.agents.runner.publish", new_callable=AsyncMock):
        agent_id = await manager.hire(AgentRole.CODER, specialization="Backend")
    assert agent_id is not None
    agent = manager.get_agent(agent_id)
    assert agent is not None
    assert agent["role"] == AgentRole.CODER
    assert agent["status"] == "idle"


@pytest.mark.asyncio
async def test_hire_respects_max_agents(manager):
    with patch("backend.agents.manager.publish", new_callable=AsyncMock), \
         patch("backend.agents.runner.publish", new_callable=AsyncMock):
        for i in range(4):
            await manager.hire(AgentRole.CODER, specialization=f"spec-{i}")
        with pytest.raises(RuntimeError, match="max"):
            await manager.hire(AgentRole.WRITER)


@pytest.mark.asyncio
async def test_dismiss_removes_agent(manager):
    with patch("backend.agents.manager.publish", new_callable=AsyncMock), \
         patch("backend.agents.runner.publish", new_callable=AsyncMock):
        agent_id = await manager.hire(AgentRole.CODER)
        await manager.dismiss(agent_id)
    assert manager.get_agent(agent_id) is None


@pytest.mark.asyncio
async def test_assign_task_queues_work(manager):
    with patch("backend.agents.manager.publish", new_callable=AsyncMock), \
         patch("backend.agents.runner.publish", new_callable=AsyncMock):
        agent_id = await manager.hire(AgentRole.CODER)
        await manager.assign_task(agent_id, "Write a hello world", "user")


@pytest.mark.asyncio
async def test_get_snapshot_returns_all(manager):
    with patch("backend.agents.manager.publish", new_callable=AsyncMock), \
         patch("backend.agents.runner.publish", new_callable=AsyncMock):
        await manager.hire(AgentRole.CODER)
        await manager.hire(AgentRole.RESEARCHER)
    snapshot = await manager.get_snapshot()
    assert len(snapshot["agents"]) == 2
