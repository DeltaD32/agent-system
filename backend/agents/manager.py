import asyncio
import uuid
import logging
from backend.agents.roles import AgentRole, role_vault_folder, ROLE_CONFIG
from backend.agents.runner import AgentRunner
from backend.llm.router import LLMRouter
from backend.memory.vault import VaultManager
from backend.db.models import AgentRow, TaskRow
from backend.ws.handler import publish
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Desk grid: PM fixed at (9, 0); others fill from row 1 outward
PM_DESK = (9, 0)


def _next_desk(occupied: list[tuple[int, int]]) -> tuple[int, int]:
    """Find next free desk position on a 20×14 grid (simple row-fill)."""
    for row in range(1, 14, 3):
        for col in range(0, 18, 4):
            pos = (col, row)
            if pos not in occupied and pos != PM_DESK:
                return pos
    return (0, 13)  # overflow fallback


class AgentManager:
    def __init__(
        self,
        db_session: AsyncSession,
        vault: VaultManager,
        router: LLMRouter,
        max_agents: int = 6,
    ):
        self._db      = db_session
        self._vault   = vault
        self._router  = router
        self._max     = max_agents
        self._agents:  dict[str, dict]          = {}
        self._runners: dict[str, AgentRunner]   = {}
        self._tasks:   dict[str, asyncio.Task]  = {}

    def get_agent(self, agent_id: str) -> dict | None:
        return self._agents.get(agent_id)

    async def get_snapshot(self) -> dict:
        return {"agents": list(self._agents.values())}

    async def hire(
        self,
        role: AgentRole,
        specialization: str = "",
        llm_override: str | None = None,
    ) -> str:
        if len(self._agents) >= self._max:
            raise RuntimeError(f"Cannot hire: max_agents ({self._max}) reached")

        occupied = [(a["desk_col"], a["desk_row"]) for a in self._agents.values()]
        desk_col, desk_row = PM_DESK if role == AgentRole.PROJECT_MANAGER else _next_desk(occupied)

        count = sum(1 for a in self._agents.values() if a["role"] == role) + 1
        role_cfg = ROLE_CONFIG[role]
        name = f"{role_cfg['display_name']}-{count}"
        if specialization:
            name += f" [{specialization}]"

        agent_id = str(uuid.uuid4())
        meta = {
            "id":             agent_id,
            "name":           name,
            "role":           role,
            "specialization": specialization,
            "status":         "idle",
            "llm_backend":    llm_override or role_cfg["default_llm"],
            "desk_col":       desk_col,
            "desk_row":       desk_row,
            "color":          role_cfg["color"],
        }
        self._agents[agent_id] = meta

        row = AgentRow(
            id=agent_id, name=name, role=role.value,
            specialization=specialization,
            status="idle",
            llm_backend=meta["llm_backend"],
            desk_col=desk_col, desk_row=desk_row,
        )
        self._db.add(row)
        await self._db.commit()

        runner = AgentRunner(
            agent_id=agent_id, name=name, role=role,
            specialization=specialization,
            llm_override=llm_override,
            router=self._router,
            vault=self._vault,
        )
        self._runners[agent_id] = runner
        self._tasks[agent_id] = asyncio.create_task(runner.run())

        await publish("agent_hired", meta)
        logger.info(f"Hired {name} ({agent_id}) at desk ({desk_col},{desk_row})")
        return agent_id

    async def dismiss(self, agent_id: str):
        if agent_id not in self._agents:
            raise KeyError(f"Agent {agent_id} not found")

        if agent_id in self._tasks:
            self._tasks[agent_id].cancel()
            try:
                await self._tasks.pop(agent_id)
            except (asyncio.CancelledError, Exception):
                pass
        self._runners.pop(agent_id, None)

        meta = self._agents.pop(agent_id)
        await publish("agent_dismissed", {"agent_id": agent_id})
        logger.info(f"Dismissed {meta['name']}")

    async def assign_task(
        self, agent_id: str, description: str, requested_by: str = "user"
    ) -> str:
        runner = self._runners.get(agent_id)
        if not runner:
            raise KeyError(f"Agent {agent_id} not running")
        task_id = str(uuid.uuid4())
        row = TaskRow(
            id=task_id, agent_id=agent_id, description=description,
            status="pending", requested_by=requested_by,
        )
        self._db.add(row)
        await self._db.commit()
        await runner.assign_task(task_id, description, requested_by)
        return task_id
