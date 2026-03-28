"""
Agent Manager - Spawns, tracks, and manages specialized sub-agents.

Each agent has:
  - A unique ID and human-readable name
  - A specialization (role)
  - An assigned LLM backend preference
  - A current task and status
  - A desk position in the pixel-art office UI

The PM agent uses this service to spawn helpers, delegate tasks,
and observe results.
"""

import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
from enum import Enum

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    IDLE      = "idle"
    THINKING  = "thinking"
    WORKING   = "working"
    WALKING   = "walking"   # visual: agent is moving to a new desk
    DONE      = "done"
    ERROR     = "error"


class AgentRole(str, Enum):
    PROJECT_MANAGER = "project_manager"
    RESEARCHER      = "researcher"
    CODER           = "coder"
    WRITER          = "writer"
    ANALYST         = "analyst"
    REVIEWER        = "reviewer"
    ARCHIVIST       = "archivist"   # manages Obsidian vault


# Pixel-art office desk positions (isometric grid col, row)
ROLE_DESKS: dict[AgentRole, tuple[int, int]] = {
    AgentRole.PROJECT_MANAGER: (3, 1),
    AgentRole.RESEARCHER:      (1, 2),
    AgentRole.CODER:           (5, 2),
    AgentRole.WRITER:          (1, 4),
    AgentRole.ANALYST:         (5, 4),
    AgentRole.REVIEWER:        (3, 4),
    AgentRole.ARCHIVIST:       (3, 6),
}

# Colour accent per role (used by the office renderer)
ROLE_COLORS: dict[AgentRole, str] = {
    AgentRole.PROJECT_MANAGER: "#FFD700",
    AgentRole.RESEARCHER:      "#4FC3F7",
    AgentRole.CODER:           "#81C784",
    AgentRole.WRITER:          "#F48FB1",
    AgentRole.ANALYST:         "#CE93D8",
    AgentRole.REVIEWER:        "#FFAB40",
    AgentRole.ARCHIVIST:       "#80DEEA",
}

# System prompts per role
ROLE_SYSTEM_PROMPTS: dict[AgentRole, str] = {
    AgentRole.PROJECT_MANAGER: (
        "You are the Project Manager AI. You coordinate all other agents, "
        "break down user requests into subtasks, delegate to specialists, "
        "and synthesise results. Be concise, decisive, and keep the user informed."
    ),
    AgentRole.RESEARCHER: (
        "You are a Research Agent. Your job is to gather information, search the "
        "knowledge base, and produce well-cited research summaries."
    ),
    AgentRole.CODER: (
        "You are a Coding Agent. Write clean, efficient, well-documented code. "
        "Prefer existing patterns in the codebase. Always consider security."
    ),
    AgentRole.WRITER: (
        "You are a Writing Agent. Produce clear, concise documentation, reports, "
        "and notes. Adapt your tone to the target audience."
    ),
    AgentRole.ANALYST: (
        "You are an Analysis Agent. Examine data, metrics, and system behaviour. "
        "Identify patterns, anomalies, and actionable insights."
    ),
    AgentRole.REVIEWER: (
        "You are a Review Agent. Critically evaluate work produced by other agents "
        "and flag issues, inconsistencies, or improvements."
    ),
    AgentRole.ARCHIVIST: (
        "You are the Archivist Agent. You maintain the Obsidian knowledge vault: "
        "organise notes, create links, summarise completed work, and ensure "
        "information is easy to retrieve."
    ),
}


@dataclass
class AgentTask:
    id: str
    description: str
    status: str = "pending"
    result: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None


@dataclass
class Agent:
    id: str
    name: str
    role: AgentRole
    status: AgentStatus = AgentStatus.IDLE
    current_task: Optional[AgentTask] = None
    desk: tuple[int, int] = (0, 0)
    position: tuple[float, float] = (0.0, 0.0)   # current pixel pos for animation
    color: str = "#FFFFFF"
    system_prompt: str = ""
    prefer_remote_gpu: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    task_history: list = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["role"] = self.role.value
        d["status"] = self.status.value
        return d


# ---------------------------------------------------------------------------
# In-memory registry (persisted to DB via orchestrator endpoints)
# ---------------------------------------------------------------------------

_agents: dict[str, Agent] = {}
_agent_lock = asyncio.Lock()

# WebSocket broadcast callback — set by the WS handler at startup
_broadcast_fn = None


def set_broadcast(fn):
    global _broadcast_fn
    _broadcast_fn = fn


async def _broadcast(event: str, data: dict):
    if _broadcast_fn:
        try:
            await _broadcast_fn({"event": event, "data": data})
        except Exception as e:
            logger.warning(f"Broadcast failed: {e}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def spawn_agent(
    role: AgentRole,
    name: Optional[str] = None,
    prefer_remote_gpu: bool = False,
) -> Agent:
    """Create and register a new agent of the given role."""
    async with _agent_lock:
        agent_id = str(uuid.uuid4())
        if name is None:
            existing = [a for a in _agents.values() if a.role == role]
            name = f"{role.value.replace('_', ' ').title()} {len(existing) + 1}"

        desk = ROLE_DESKS.get(role, (0, 0))
        agent = Agent(
            id=agent_id,
            name=name,
            role=role,
            desk=desk,
            position=(float(desk[0]), float(desk[1])),
            color=ROLE_COLORS.get(role, "#FFFFFF"),
            system_prompt=ROLE_SYSTEM_PROMPTS.get(role, ""),
            prefer_remote_gpu=prefer_remote_gpu,
        )
        _agents[agent_id] = agent
        logger.info(f"Spawned agent {name} ({role.value}) id={agent_id}")

    await _broadcast("agent_spawned", agent.to_dict())
    return agent


async def assign_task(agent_id: str, description: str) -> AgentTask:
    """Assign a task to an agent and mark it as working."""
    async with _agent_lock:
        agent = _agents.get(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        task = AgentTask(id=str(uuid.uuid4()), description=description)
        agent.current_task = task
        agent.status = AgentStatus.THINKING

    await _broadcast("agent_task_assigned", {
        "agent": agent.to_dict(),
        "task": asdict(task),
    })
    return task


async def update_agent_status(agent_id: str, status: AgentStatus,
                               task_result: Optional[str] = None):
    async with _agent_lock:
        agent = _agents.get(agent_id)
        if not agent:
            return
        agent.status = status
        if task_result is not None and agent.current_task:
            agent.current_task.result = task_result
            agent.current_task.status = "completed"
            agent.current_task.completed_at = datetime.now(timezone.utc).isoformat()
            agent.task_history.append(asdict(agent.current_task))
            if status == AgentStatus.IDLE:
                agent.current_task = None

    await _broadcast("agent_status_updated", agent.to_dict())


async def move_agent(agent_id: str, destination: tuple[int, int]):
    """Update agent desk/destination (triggers walking animation in UI)."""
    async with _agent_lock:
        agent = _agents.get(agent_id)
        if not agent:
            return
        agent.desk = destination
        agent.status = AgentStatus.WALKING

    await _broadcast("agent_moved", {
        "agent_id": agent_id,
        "destination": destination,
    })


async def despawn_agent(agent_id: str):
    async with _agent_lock:
        agent = _agents.pop(agent_id, None)
    if agent:
        await _broadcast("agent_despawned", {"agent_id": agent_id})


def get_all_agents() -> list[dict]:
    return [a.to_dict() for a in _agents.values()]


def get_agent(agent_id: str) -> Optional[Agent]:
    return _agents.get(agent_id)


async def ensure_pm_agent() -> Agent:
    """Ensure the singleton Project Manager agent exists."""
    for agent in _agents.values():
        if agent.role == AgentRole.PROJECT_MANAGER:
            return agent
    return await spawn_agent(AgentRole.PROJECT_MANAGER, name="Project Manager")
