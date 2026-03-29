"""
AgentRunner — asyncio coroutine that drives a single agent.

Lifecycle:
  1. Load prompt layers (identity → instructions → memory → task)
  2. Call LLM router
  3. Parse tool calls from response (if toolkit available)
  4. Execute tools, re-call LLM with results (max 3 rounds)
  5. Write memory updates to vault
  6. Emit WebSocket events
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
from backend.agents.roles import AgentRole, role_vault_folder, ROLE_CONFIG
from backend.llm.router import LLMRouter
from backend.memory.vault import VaultManager
from backend.ws.handler import publish

logger = logging.getLogger(__name__)

# Matches: TOOL_CALL: toolname("argument")
_TOOL_CALL_RE = re.compile(r'TOOL_CALL:\s*(\w+)\("([^"]*)"\)')

MAX_TOOL_ROUNDS = 3


def _parse_tool_call(text: str) -> tuple[str, str] | None:
    """Return (tool_name, argument) from first TOOL_CALL marker, or None."""
    m = _TOOL_CALL_RE.search(text)
    return (m.group(1), m.group(2)) if m else None


def assemble_prompt(
    role: AgentRole,
    specialization: str,
    instructions: str,
    context: str,
    shared_hits: list[dict],
    task_description: str,
    requested_by: str,
    prior_output: str = "",
) -> str:
    """Assemble the four-layer prompt."""
    shared_section = "\n\n".join(
        f"[From {h['path']}]\n{h['content'][:800]}" for h in shared_hits[:3]
    )

    return f"""\
## LAYER 1 — IDENTITY
You are {ROLE_CONFIG[role]['display_name']} in an AI agent office.
Your specialization: {specialization or 'General'}.
You ONLY perform tasks within your role.
You NEVER impersonate another agent.
If asked to do something outside your role, redirect to the correct specialist
and include "CONSULT_REQUEST: <role>" in your response.

## LAYER 2 — INSTRUCTIONS
{instructions}

## LAYER 3 — MEMORY
### Your context:
{context or '(no prior context)'}

### Relevant shared knowledge:
{shared_section or '(nothing found)'}

{'### Prior task output:' + chr(10) + prior_output if prior_output else ''}

## LAYER 4 — TASK
Requested by: {requested_by}
Task: {task_description}

Respond in markdown. Always end your response with:
- **Confidence:** <0-100>
- **Next recommended agent:** <role or 'none'>
"""


class AgentRunner:
    def __init__(
        self,
        agent_id: str,
        name: str,
        role: AgentRole,
        specialization: str,
        llm_override: str | None,
        router: LLMRouter,
        vault: VaultManager,
        toolkit=None,   # ToolKit | None — imported lazily to avoid circular imports
    ):
        self.agent_id       = agent_id
        self.name           = name
        self.role           = role
        self.specialization = specialization
        self.llm_override   = llm_override
        self.router         = router
        self.vault          = vault
        self.toolkit        = toolkit
        self._task_queue: asyncio.Queue = asyncio.Queue()
        self._running       = True

    async def assign_task(self, task_id: str, description: str, requested_by: str = "user"):
        await self._task_queue.put((task_id, description, requested_by))

    async def run(self):
        """Main coroutine — loop waiting for tasks."""
        await publish("agent_status_updated", {"id": self.agent_id, "status": "idle"})
        while self._running:
            try:
                task_id, description, requested_by = await asyncio.wait_for(
                    self._task_queue.get(), timeout=30.0
                )
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            await self._execute_task(task_id, description, requested_by)

    async def _execute_task(self, task_id: str, description: str, requested_by: str):
        role_slug = role_vault_folder(self.role)

        await publish("agent_status_updated", {"id": self.agent_id, "status": "working"})
        await publish("agent_task_assigned", {
            "id": self.agent_id, "task_id": task_id, "description": description
        })

        # Layer 2: Load instructions from vault
        instructions = await self.vault.read(self.role, f"instructions/{role_slug}.md")

        # Layer 3: Load memory
        context     = await self.vault.read(self.role, f"agents/{role_slug}/context.md")
        shared_hits = await self.vault.search(self.role, description[:100])

        prompt = assemble_prompt(
            role=self.role,
            specialization=self.specialization,
            instructions=instructions,
            context=context,
            shared_hits=shared_hits,
            task_description=description,
            requested_by=requested_by,
        )

        try:
            response = await self.router.complete(
                prompt=prompt,
                role=self.role,
                llm_override=self.llm_override,
            )
            # Run tool loop if toolkit is available
            if self.toolkit is not None:
                final_text = await self._run_tool_loop(prompt, response.text)
                response = type(response)(
                    text=final_text,
                    backend=response.backend,
                    model=response.model,
                    tokens_used=response.tokens_used,
                )
        except Exception as e:
            logger.error(f"Agent {self.name} LLM error: {e}")
            await publish("agent_status_updated", {"id": self.agent_id, "status": "blocked"})
            await self.vault.append(
                self.role,
                "shared/blockers.md",
                f"## {datetime.now(timezone.utc).isoformat()} — {self.name}\n{e}",
            )
            await publish("agent_status_updated", {"id": self.agent_id, "status": "idle"})
            return

        entry = (
            f"## {datetime.now(timezone.utc).isoformat()}\n"
            f"**Task:** {description}\n"
            f"**Backend:** {response.backend}\n"
            f"**Result:**\n{response.text[:500]}"
        )
        await self.vault.append(self.role, f"agents/{role_slug}/session-log.md", entry)

        if "CONSULT_REQUEST:" in response.text:
            await publish("consult_request", {
                "from_agent_id": self.agent_id,
                "response_text": response.text,
            })

        await publish("agent_status_updated", {"id": self.agent_id, "status": "idle"})

    async def _run_tool_loop(self, original_prompt: str, response_text: str) -> str:
        """Execute TOOL_CALL markers in response text, up to MAX_TOOL_ROUNDS re-calls."""
        prompt = original_prompt
        text   = response_text

        for _ in range(MAX_TOOL_ROUNDS):
            parsed = _parse_tool_call(text)
            if parsed is None:
                break
            tool_name, arg = parsed
            tool_result = await self._call_tool(tool_name, arg)
            prompt = (
                prompt
                + f"\n\n---\nTool result for {tool_name}(\"{arg}\"):\n{tool_result}"
                + "\n\nNow provide your final answer incorporating the tool result:"
            )
            response = await self.router.complete(
                prompt=prompt,
                role=self.role,
                llm_override=self.llm_override,
            )
            text = response.text

        return text

    async def _call_tool(self, tool_name: str, arg: str) -> str:
        """Dispatch to the appropriate tool. Returns a string result for the LLM."""
        if self.toolkit is None:
            return f"[No toolkit available — cannot run {tool_name}]"

        allowed = self.toolkit.allowed_for(self.role)
        if tool_name not in allowed:
            return f"[Tool '{tool_name}' is not permitted for {self.role.value} or not available]"

        try:
            if tool_name == "search" and self.toolkit.search:
                results = await self.toolkit.search(arg)
                return "\n".join(
                    f"- [{r.title}]({r.url}): {r.snippet}"
                    for r in results
                ) or "(no results)"

            if tool_name == "browse" and self.toolkit.browse:
                result = await self.toolkit.browse(arg)
                return f"**{result.title}**\n{result.text}"

            if tool_name == "terminal" and self.toolkit.terminal:
                result = await self.toolkit.terminal(arg)
                lines = []
                if result.stdout:
                    lines.append(f"stdout:\n{result.stdout}")
                if result.stderr:
                    lines.append(f"stderr:\n{result.stderr}")
                lines.append(f"exit code: {result.returncode}")
                return "\n".join(lines)

        except Exception as exc:
            logger.warning(f"Tool {tool_name}({arg!r}) failed: {exc}")
            return f"[Tool error: {exc}]"

        return f"[Unknown tool: {tool_name}]"

    def stop(self):
        self._running = False
