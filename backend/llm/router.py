"""
LLM Router — selects Ollama (local/remote) or Claude API per task.

Decision order:
  1. Force override (llm_override arg)
  2. Role-based default (PM/Reviewer → Claude, Archivist → local)
  3. Complexity score (HIGH → Claude, else best available Ollama)
  4. Health fallback (if chosen backend is down, fall back gracefully)
"""
import logging
from backend.agents.roles import AgentRole
from backend.llm.backends.base import LLMResponse
from backend.llm.backends.ollama import call_ollama, check_ollama_health
from backend.llm.backends.claude import call_claude, claude_available

logger = logging.getLogger(__name__)

COMPLEX_KEYWORDS = {
    "reason", "analyze", "analyse", "architecture", "design", "refactor",
    "security", "vulnerability", "optimize", "optimise", "explain",
    "compare", "evaluate", "critique", "plan", "decompose", "summarize",
    "summarise",
}

ALWAYS_CLAUDE  = {AgentRole.PROJECT_MANAGER, AgentRole.REVIEWER}
ALWAYS_LOCAL   = {AgentRole.ARCHIVIST}

def complexity_score(prompt: str) -> int:
    """0-100. >=50 means route to Claude."""
    words = prompt.lower().split()
    keyword_hits = sum(1 for w in words if w in COMPLEX_KEYWORDS)
    length_score = min(len(words) / 12, 1.0)   # 600+ words → 1.0
    return int((keyword_hits * 15 + length_score * 50))


class LLMRouter:
    def __init__(self, local_url: str, remote_urls: list[str], local_model: str):
        self.local_url   = local_url
        self.remote_urls = remote_urls
        self.local_model = local_model
        self._health_cache: dict[str, bool] = {}

    async def _local_healthy(self) -> bool:
        ok = await check_ollama_health(self.local_url)
        self._health_cache["local"] = ok
        return ok

    async def _best_ollama_url(self) -> tuple[str, str] | None:
        """Return (url, label) for first healthy Ollama, or None."""
        if await check_ollama_health(self.local_url):
            return (self.local_url, "local_ollama")
        for i, url in enumerate(self.remote_urls, start=1):
            if await check_ollama_health(url):
                return (url, f"remote_ollama_{i}")
        return None

    async def _call_ollama(self, prompt: str, url: str, label: str) -> LLMResponse:
        return await call_ollama(url, self.local_model, prompt, backend_label=label)

    async def _call_claude(self, prompt: str) -> LLMResponse:
        return await call_claude(prompt)

    async def complete(
        self,
        prompt: str,
        role: AgentRole,
        llm_override: str | None = None,
    ) -> LLMResponse:
        # 1. Force override
        if llm_override == "claude_api":
            return await self._call_claude(prompt)
        if llm_override in ("local_ollama", "remote_ollama"):
            best = await self._best_ollama_url()
            if best:
                return await self._call_ollama(prompt, *best)

        # 2. Role-based default
        if role in ALWAYS_CLAUDE:
            return await self._call_claude(prompt)
        if role in ALWAYS_LOCAL:
            best = await self._best_ollama_url()
            if best:
                return await self._call_ollama(prompt, *best)

        # 3. Complexity routing
        score = complexity_score(prompt)
        if score >= 50 and claude_available():
            return await self._call_claude(prompt)

        # 4. Best available Ollama, fallback to Claude
        best = await self._best_ollama_url()
        if best:
            return await self._call_ollama(prompt, *best)
        if claude_available():
            logger.warning("All Ollama servers down — falling back to Claude API")
            return await self._call_claude(prompt)

        raise RuntimeError("No LLM backend available. Check Ollama and ANTHROPIC_API_KEY.")

    async def health_check(self) -> dict:
        local_ok = await check_ollama_health(self.local_url)
        remotes = {}
        for i, url in enumerate(self.remote_urls, start=1):
            remotes[f"remote_{i}"] = await check_ollama_health(url)
        return {
            "local_ollama":  local_ok,
            "remote_ollama": remotes,
            "claude_api":    claude_available(),
        }
