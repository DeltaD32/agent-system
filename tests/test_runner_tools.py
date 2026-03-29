# tests/test_runner_tools.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.agents.roles import AgentRole
from backend.tools import ToolKit
from backend.tools.search import SearchResult
from backend.tools.browser import BrowseResult
from backend.tools.terminal import TerminalResult
from backend.agents.runner import AgentRunner, _parse_tool_call


def test_parse_tool_call_search():
    name, arg = _parse_tool_call('TOOL_CALL: search("python asyncio")')
    assert name == "search"
    assert arg == "python asyncio"


def test_parse_tool_call_browse():
    name, arg = _parse_tool_call('TOOL_CALL: browse("https://example.com")')
    assert name == "browse"
    assert arg == "https://example.com"


def test_parse_tool_call_terminal():
    name, arg = _parse_tool_call("TOOL_CALL: terminal(\"ls -la\")")
    assert name == "terminal"
    assert arg == "ls -la"


def test_parse_tool_call_returns_none_when_no_match():
    assert _parse_tool_call("No tool call here") is None


@pytest.mark.asyncio
async def test_runner_executes_search_tool():
    mock_search = AsyncMock(return_value=[
        SearchResult(title="FastAPI docs", url="http://fastapi.tiangolo.com", snippet="Great framework")
    ])
    toolkit = ToolKit(search=mock_search)

    router = MagicMock()
    vault  = MagicMock()

    # First LLM call returns a TOOL_CALL, second returns final answer
    first  = MagicMock(text='TOOL_CALL: search("FastAPI tutorial")', backend="local_ollama", model="llama3")
    second = MagicMock(text="Here is the answer based on search results.", backend="local_ollama", model="llama3")
    router.complete = AsyncMock(side_effect=[first, second])
    vault.read    = AsyncMock(return_value="")
    vault.search  = AsyncMock(return_value=[])
    vault.append  = AsyncMock()

    runner = AgentRunner(
        agent_id="a1", name="Researcher-1",
        role=AgentRole.RESEARCHER,
        specialization="Web research",
        llm_override=None,
        router=router,
        vault=vault,
        toolkit=toolkit,
    )

    with patch("backend.agents.runner.publish", new_callable=AsyncMock):
        await runner._execute_task("t1", "Research FastAPI", "user")

    mock_search.assert_called_once_with("FastAPI tutorial")
    assert router.complete.call_count == 2


@pytest.mark.asyncio
async def test_runner_skips_tool_not_in_kit():
    """If toolkit has no browse, a TOOL_CALL: browse(...) is treated as unknown."""
    toolkit = ToolKit(search=AsyncMock(return_value=[]))  # no browse

    router = MagicMock()
    vault  = MagicMock()
    first  = MagicMock(text='TOOL_CALL: browse("http://example.com")', backend="local_ollama", model="llama3")
    second = MagicMock(text="Final answer.", backend="local_ollama", model="llama3")
    router.complete = AsyncMock(side_effect=[first, second])
    vault.read   = AsyncMock(return_value="")
    vault.search = AsyncMock(return_value=[])
    vault.append = AsyncMock()

    runner = AgentRunner(
        agent_id="a2", name="Researcher-1",
        role=AgentRole.RESEARCHER,
        specialization="",
        llm_override=None,
        router=router,
        vault=vault,
        toolkit=toolkit,
    )

    with patch("backend.agents.runner.publish", new_callable=AsyncMock):
        await runner._execute_task("t2", "Browse example", "user")

    # LLM called twice (initial + after tool not-found error injected)
    assert router.complete.call_count == 2


@pytest.mark.asyncio
async def test_runner_without_toolkit_ignores_tool_calls():
    """AgentRunner with no toolkit: TOOL_CALL in response is left in session log but no tool runs."""
    router = MagicMock()
    vault  = MagicMock()
    resp   = MagicMock(text='TOOL_CALL: search("hello")', backend="local_ollama", model="llama3")
    router.complete = AsyncMock(return_value=resp)
    vault.read   = AsyncMock(return_value="")
    vault.search = AsyncMock(return_value=[])
    vault.append = AsyncMock()

    runner = AgentRunner(
        agent_id="a3", name="Writer-1",
        role=AgentRole.WRITER,
        specialization="",
        llm_override=None,
        router=router,
        vault=vault,
        toolkit=None,
    )

    with patch("backend.agents.runner.publish", new_callable=AsyncMock):
        await runner._execute_task("t3", "Write something", "user")

    # Only one LLM call when no toolkit
    router.complete.assert_called_once()
