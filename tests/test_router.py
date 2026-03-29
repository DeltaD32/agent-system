import pytest
from unittest.mock import AsyncMock, patch
from backend.llm.router import LLMRouter, complexity_score
from backend.agents.roles import AgentRole
from backend.llm.backends.base import LLMResponse

def test_complexity_score_low_for_simple():
    assert complexity_score("write a hello world function") < 50

def test_complexity_score_high_for_complex():
    assert complexity_score("analyze the security architecture and refactor the authentication system") >= 50

def test_complexity_score_high_for_long_prompt():
    long_prompt = "do something " * 300   # > 600 tokens heuristic
    assert complexity_score(long_prompt) >= 50

@pytest.mark.asyncio
async def test_router_uses_claude_for_pm():
    router = LLMRouter(
        local_url="http://localhost:11434",
        remote_urls=[],
        local_model="llama3",
    )
    with patch.object(router, "_call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = LLMResponse("ok", "claude_api", "claude-sonnet-4-6")
        result = await router.complete(
            prompt="Plan this project",
            role=AgentRole.PROJECT_MANAGER,
        )
    mock_claude.assert_called_once()
    assert result.backend == "claude_api"

@pytest.mark.asyncio
async def test_router_uses_local_for_archivist():
    router = LLMRouter(
        local_url="http://localhost:11434",
        remote_urls=[],
        local_model="llama3",
    )
    with patch.object(router, "_call_ollama", new_callable=AsyncMock) as mock_ollama, \
         patch.object(router, "_best_ollama_url", new_callable=AsyncMock,
                      return_value=("http://localhost:11434", "local_ollama")):
        mock_ollama.return_value = LLMResponse("ok", "local_ollama", "llama3")
        result = await router.complete(
            prompt="Index the vault",
            role=AgentRole.ARCHIVIST,
        )
    mock_ollama.assert_called_once()
