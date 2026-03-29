"""Ollama HTTP client — calls the /api/generate endpoint."""
import httpx
from dataclasses import dataclass


@dataclass
class LLMResponse:
    text: str
    backend: str          # "local_ollama" | "remote_ollama_1" etc.
    model: str
    tokens_used: int = 0


async def call_ollama(
    base_url: str,
    model: str,
    prompt: str,
    backend_label: str = "local_ollama",
    timeout: float = 120.0,
) -> LLMResponse:
    """Call Ollama /api/generate. Raises httpx.HTTPError on failure."""
    payload = {"model": model, "prompt": prompt, "stream": False}
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{base_url}/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
    return LLMResponse(
        text=data.get("response", ""),
        backend=backend_label,
        model=model,
        tokens_used=data.get("eval_count", 0),
    )


async def check_ollama_health(base_url: str, timeout: float = 5.0) -> bool:
    """Return True if Ollama is reachable and responding."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False
