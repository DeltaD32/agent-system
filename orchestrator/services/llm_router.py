"""
LLM Router - Routes requests to local Ollama (Llama) or Claude API
based on task complexity, type, and GPU availability.

Two Ollama endpoints are supported:
  - LOCAL:  the machine running this stack (default http://host.docker.internal:11434)
  - REMOTE: a second GPU server on the LAN (e.g. http://192.168.x.x:11434)

Claude API is used for tasks that require advanced reasoning, long-context
understanding, or when local inference is unavailable.
"""

import os
import logging
import asyncio
import aiohttp
from enum import Enum
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (overridable via environment variables)
# ---------------------------------------------------------------------------
OLLAMA_LOCAL_URL  = os.environ.get("OLLAMA_LOCAL_URL",  "http://host.docker.internal:11434")
OLLAMA_REMOTE_URL = os.environ.get("OLLAMA_REMOTE_URL", "")           # LAN GPU server
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL      = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")

# Default local model served by Ollama
LOCAL_MODEL       = os.environ.get("LOCAL_MODEL", "llama3")


class LLMBackend(str, Enum):
    LOCAL_OLLAMA  = "local_ollama"
    REMOTE_OLLAMA = "remote_ollama"
    CLAUDE_API    = "claude_api"


@dataclass
class LLMResponse:
    text: str
    backend: LLMBackend
    model: str
    tokens_used: int = 0


# ---------------------------------------------------------------------------
# Task complexity heuristics
# ---------------------------------------------------------------------------

COMPLEX_KEYWORDS = {
    "reason", "analyze", "architecture", "design", "refactor",
    "security", "vulnerability", "optimize", "explain",
    "compare", "evaluate", "critique", "summarize long",
}

def _needs_claude(prompt: str, force_claude: bool = False) -> bool:
    """Return True when the task should be routed to Claude API."""
    if force_claude:
        return True
    if not ANTHROPIC_API_KEY:
        return False
    prompt_lower = prompt.lower()
    return any(kw in prompt_lower for kw in COMPLEX_KEYWORDS) or len(prompt) > 3000


def _remote_available() -> bool:
    return bool(OLLAMA_REMOTE_URL)


# ---------------------------------------------------------------------------
# Backend callers
# ---------------------------------------------------------------------------

async def _call_ollama(url: str, model: str, prompt: str,
                       system: str = "") -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system

    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{url}/api/generate",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=120),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data.get("response", "")


async def _call_claude(prompt: str, system: str = "",
                       model: str = CLAUDE_MODEL) -> tuple[str, int]:
    """Call Anthropic Claude API using raw HTTP (no SDK dependency required)."""
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    messages = [{"role": "user", "content": prompt}]
    body = {
        "model": model,
        "max_tokens": 4096,
        "messages": messages,
    }
    if system:
        body["system"] = system

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=body,
            timeout=aiohttp.ClientTimeout(total=180),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            text = data["content"][0]["text"]
            tokens = data.get("usage", {}).get("output_tokens", 0)
            return text, tokens


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def route(
    prompt: str,
    system: str = "",
    force_claude: bool = False,
    force_local: bool = False,
    prefer_remote_gpu: bool = False,
) -> LLMResponse:
    """
    Route a prompt to the best available LLM backend and return an LLMResponse.

    Priority logic:
      1. force_claude=True  → Claude API (if key present)
      2. force_local=True   → local Ollama only
      3. prefer_remote_gpu  → try remote Ollama first
      4. Complex prompt + Claude key available → Claude API
      5. Default: local Ollama (fallback to remote, then Claude)
    """
    # --- Claude forced ---
    if force_claude and ANTHROPIC_API_KEY:
        text, tokens = await _call_claude(prompt, system)
        return LLMResponse(text=text, backend=LLMBackend.CLAUDE_API,
                           model=CLAUDE_MODEL, tokens_used=tokens)

    # --- Local forced ---
    if force_local:
        text = await _call_ollama(OLLAMA_LOCAL_URL, LOCAL_MODEL, prompt, system)
        return LLMResponse(text=text, backend=LLMBackend.LOCAL_OLLAMA,
                           model=LOCAL_MODEL)

    # --- Complexity routing ---
    if _needs_claude(prompt, force_claude) and ANTHROPIC_API_KEY:
        try:
            text, tokens = await _call_claude(prompt, system)
            return LLMResponse(text=text, backend=LLMBackend.CLAUDE_API,
                               model=CLAUDE_MODEL, tokens_used=tokens)
        except Exception as e:
            logger.warning(f"Claude API failed, falling back to local: {e}")

    # --- Remote GPU preferred ---
    if prefer_remote_gpu and _remote_available():
        try:
            text = await _call_ollama(OLLAMA_REMOTE_URL, LOCAL_MODEL, prompt, system)
            return LLMResponse(text=text, backend=LLMBackend.REMOTE_OLLAMA,
                               model=LOCAL_MODEL)
        except Exception as e:
            logger.warning(f"Remote Ollama failed, falling back to local: {e}")

    # --- Local Ollama (default) ---
    try:
        text = await _call_ollama(OLLAMA_LOCAL_URL, LOCAL_MODEL, prompt, system)
        return LLMResponse(text=text, backend=LLMBackend.LOCAL_OLLAMA,
                           model=LOCAL_MODEL)
    except Exception as e:
        logger.error(f"Local Ollama failed: {e}")
        # Last resort: remote GPU
        if _remote_available():
            text = await _call_ollama(OLLAMA_REMOTE_URL, LOCAL_MODEL, prompt, system)
            return LLMResponse(text=text, backend=LLMBackend.REMOTE_OLLAMA,
                               model=LOCAL_MODEL)
        raise


async def health_check() -> dict:
    """Return availability status of all LLM backends."""
    status = {
        "local_ollama": False,
        "remote_ollama": False,
        "claude_api": bool(ANTHROPIC_API_KEY),
    }

    async def ping_ollama(url: str, key: str):
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(f"{url}/api/tags",
                                 timeout=aiohttp.ClientTimeout(total=5)) as r:
                    status[key] = r.status == 200
        except Exception:
            pass

    tasks = [ping_ollama(OLLAMA_LOCAL_URL, "local_ollama")]
    if _remote_available():
        tasks.append(ping_ollama(OLLAMA_REMOTE_URL, "remote_ollama"))

    await asyncio.gather(*tasks)
    return status
