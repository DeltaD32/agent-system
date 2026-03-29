"""
AgentRunner — asyncio coroutine that drives a single agent.

Lifecycle:
  1. Load prompt layers (identity → instructions → memory → task)
  2. Call LLM router
  3. Parse response
  4. Write memory updates to vault
  5. Emit WebSocket events
  6. Return to idle or handle consult requests
"""
import asyncio
import logging
from datetime import datetime, timezone
from backend.agents.roles import AgentRole, role_vault_folder, ROLE_CONFIG
from backend.llm.router import LLMRouter
from backend.memory.vault import VaultManager
from backend.ws.handler import publish

logger = logging.getLogger(__name__)


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
    ):
        self.agent_id     = agent_id
        self.name         = name
        self.role         = role
        self.specialization = specialization
        self.llm_override = llm_override
        self.router       = router
        self.vault        = vault
        self._task_queue: asyncio.Queue = asyncio.Queue()
        self._running     = True

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

        # Emit working status
        await publish("agent_status_updated", {"id": self.agent_id, "status": "working"})
        await publish("agent_task_assigned", {
            "id": self.agent_id, "task_id": task_id, "description": description
        })

        # Layer 2: Load instructions from vault
        instructions = await self.vault.read(self.role, f"instructions/{role_slug}.md")

        # Layer 3: Load memory
        context     = await self.vault.read(self.role, f"agents/{role_slug}/context.md")
        shared_hits = await self.vault.search(self.role, description[:100])

        # Assemble + call LLM
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
        except Exception as e:
            logger.error(f"Agent {self.name} LLM error: {e}")
            await publish("agent_status_updated", {"id": self.agent_id, "status": "blocked"})
            await self.vault.append(
                self.role,
                "shared/blockers.md",
                f"## {datetime.now(timezone.utc).isoformat()} — {self.name}\n{e}",
            )
            return

        # Write session log
        entry = (
            f"## {datetime.now(timezone.utc).isoformat()}\n"
            f"**Task:** {description}\n"
            f"**Backend:** {response.backend}\n"
            f"**Result:**\n{response.text[:500]}"
        )
        await self.vault.append(self.role, f"agents/{role_slug}/session-log.md", entry)

        # Check for consult request in response
        if "CONSULT_REQUEST:" in response.text:
            await publish("consult_request", {
                "from_agent_id": self.agent_id,
                "response_text": response.text,
            })

        await publish("agent_status_updated", {"id": self.agent_id, "status": "idle"})

    def stop(self):
        self._running = False
