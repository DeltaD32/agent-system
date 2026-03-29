"""Tests for LLM backend modules (ollama.py and claude.py)."""
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from backend.llm.backends.ollama import LLMResponse, call_ollama, check_ollama_health
from backend.llm.backends.claude import call_claude, claude_available


# ── Ollama tests ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_call_ollama_success():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"response": "Hello!", "eval_count": 42}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("backend.llm.backends.ollama.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await call_ollama("http://localhost:11434", "llama3", "Say hi")

    assert isinstance(result, LLMResponse)
    assert result.text == "Hello!"
    assert result.backend == "local_ollama"
    assert result.model == "llama3"
    assert result.tokens_used == 42


@pytest.mark.asyncio
async def test_call_ollama_custom_backend_label():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"response": "pong", "eval_count": 5}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("backend.llm.backends.ollama.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await call_ollama(
            "http://192.168.1.10:11434", "llama3", "ping",
            backend_label="remote_ollama_1"
        )

    assert result.backend == "remote_ollama_1"


@pytest.mark.asyncio
async def test_call_ollama_http_error_raises_runtime_error():
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(
        side_effect=httpx.HTTPStatusError("404", request=MagicMock(), response=MagicMock())
    )

    with patch("backend.llm.backends.ollama.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        with pytest.raises(RuntimeError, match="Ollama request failed"):
            await call_ollama("http://localhost:11434", "llama3", "hi")


@pytest.mark.asyncio
async def test_call_ollama_connection_error_raises_runtime_error():
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(
        side_effect=httpx.ConnectError("Connection refused")
    )

    with patch("backend.llm.backends.ollama.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        with pytest.raises(RuntimeError, match="Ollama request failed"):
            await call_ollama("http://localhost:11434", "llama3", "hi")


@pytest.mark.asyncio
async def test_check_ollama_health_healthy():
    mock_resp = MagicMock(status_code=200)
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("backend.llm.backends.ollama.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        assert await check_ollama_health("http://localhost:11434") is True


@pytest.mark.asyncio
async def test_check_ollama_health_unhealthy_status():
    mock_resp = MagicMock(status_code=500)
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("backend.llm.backends.ollama.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        assert await check_ollama_health("http://localhost:11434") is False


@pytest.mark.asyncio
async def test_check_ollama_health_connection_refused():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))

    with patch("backend.llm.backends.ollama.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        assert await check_ollama_health("http://localhost:11434") is False


# ── Claude tests ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_call_claude_success():
    mock_content = MagicMock()
    mock_content.text = "Sure, here is the answer."
    mock_message = MagicMock()
    mock_message.content = [mock_content]
    mock_message.usage.input_tokens = 10
    mock_message.usage.output_tokens = 20

    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(return_value=mock_message)

    with patch("backend.llm.backends.claude.settings") as mock_settings, \
         patch("backend.llm.backends.claude.anthropic.AsyncAnthropic") as mock_cls:
        mock_settings.anthropic_api_key = "sk-ant-test"
        mock_settings.claude_model = "claude-sonnet-4-6"
        mock_cls.return_value = mock_anthropic

        result = await call_claude("What is 2+2?")

    assert isinstance(result, LLMResponse)
    assert result.text == "Sure, here is the answer."
    assert result.backend == "claude_api"
    assert result.tokens_used == 30


@pytest.mark.asyncio
async def test_call_claude_uses_override_model():
    mock_content = MagicMock()
    mock_content.text = "response"
    mock_message = MagicMock()
    mock_message.content = [mock_content]
    mock_message.usage.input_tokens = 5
    mock_message.usage.output_tokens = 5

    mock_anthropic = AsyncMock()
    mock_anthropic.messages.create = AsyncMock(return_value=mock_message)

    with patch("backend.llm.backends.claude.settings") as mock_settings, \
         patch("backend.llm.backends.claude.anthropic.AsyncAnthropic") as mock_cls:
        mock_settings.anthropic_api_key = "sk-ant-test"
        mock_settings.claude_model = "claude-sonnet-4-6"
        mock_cls.return_value = mock_anthropic

        result = await call_claude("prompt", model="claude-opus-4-6")

    assert result.model == "claude-opus-4-6"


@pytest.mark.asyncio
async def test_call_claude_missing_api_key_raises_runtime_error():
    with patch("backend.llm.backends.claude.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""

        with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY not set"):
            await call_claude("hello")


def test_claude_available_true():
    with patch("backend.llm.backends.claude.settings") as mock_settings:
        mock_settings.anthropic_api_key = "sk-ant-real"
        assert claude_available() is True


def test_claude_available_false():
    with patch("backend.llm.backends.claude.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""
        assert claude_available() is False
