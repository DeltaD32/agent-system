"""Anthropic Claude API client."""
import anthropic
from backend.llm.backends.ollama import LLMResponse
from backend.config import settings


async def call_claude(prompt: str, model: str | None = None) -> LLMResponse:
    """Call Claude API. Raises anthropic.APIError on failure."""
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set — cannot call Claude API")
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    target_model = model or settings.claude_model
    message = await client.messages.create(
        model=target_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text if message.content else ""
    return LLMResponse(
        text=text,
        backend="claude_api",
        model=target_model,
        tokens_used=message.usage.input_tokens + message.usage.output_tokens,
    )


def claude_available() -> bool:
    """Return True if ANTHROPIC_API_KEY is set."""
    return bool(settings.anthropic_api_key)
