"""
Project Manager Agent

The singleton "lead" agent.  It:
  - Receives user chat messages
  - Decides whether to answer directly or delegate to sub-agents
  - Spawns specialised agents as needed
  - Logs everything to the Obsidian vault
  - Broadcasts state changes via WebSocket for the office UI
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from . import llm_router, agent_manager, obsidian_service
from .agent_manager import AgentRole, AgentStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chat history (in-memory; also persisted to vault and DB by callers)
# ---------------------------------------------------------------------------

_chat_history: list[dict] = []

_DELEGATION_PROMPT = """
You are the Project Manager AI. A user has sent you the following message:

<message>
{message}
</message>

Current active agents:
{agents}

Decide what to do:
1. If you can answer directly, do so.
2. If a task needs a specialist, respond with a JSON block ONLY (no extra text):
{{
  "action": "delegate",
  "role": "<role>",           // one of: researcher, coder, writer, analyst, reviewer, archivist
  "task": "<task description>",
  "prefer_remote_gpu": false  // set true for heavy compute tasks
}}
3. To spawn a NEW agent first then delegate:
{{
  "action": "spawn_and_delegate",
  "role": "<role>",
  "agent_name": "<optional name>",
  "task": "<task description>",
  "prefer_remote_gpu": false
}}
4. To report status to the user, respond normally (no JSON).

Be concise. If delegating, only output the JSON block.
"""

_DIRECT_ANSWER_PROMPT = """
You are the Project Manager AI for a local AI agent system.
Answer the user's message helpfully. You have:
- Access to a team of specialised agents (researcher, coder, writer, analyst, reviewer, archivist)
- An Obsidian knowledge vault
- Both local GPU (Ollama/Llama) and Claude API for inference

User message: {message}

Previous conversation context:
{history}
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_agents() -> str:
    agents = agent_manager.get_all_agents()
    if not agents:
        return "No agents currently active."
    lines = []
    for a in agents:
        task = a.get("current_task", {}) or {}
        task_desc = task.get("description", "idle") if task else "idle"
        lines.append(f"  - {a['name']} ({a['role']}) [{a['status']}]: {task_desc}")
    return "\n".join(lines)


def _fmt_history(limit: int = 6) -> str:
    recent = _chat_history[-limit:] if len(_chat_history) > limit else _chat_history
    lines = []
    for m in recent:
        role = "User" if m["role"] == "user" else "PM"
        lines.append(f"{role}: {m['content']}")
    return "\n".join(lines) if lines else "No previous messages."


def _parse_delegation(text: str) -> Optional[dict]:
    """Try to extract a JSON delegation block from LLM output."""
    text = text.strip()
    # Look for {...} block
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        return None
    try:
        obj = json.loads(text[start:end])
        if obj.get("action") in ("delegate", "spawn_and_delegate"):
            return obj
    except json.JSONDecodeError:
        pass
    return None


# ---------------------------------------------------------------------------
# Core chat handler
# ---------------------------------------------------------------------------

async def handle_message(user_message: str) -> dict:
    """
    Process a user message.
    Returns {"reply": str, "agent_events": list}.
    """
    # Ensure PM agent exists in the registry
    pm = await agent_manager.ensure_pm_agent()

    _chat_history.append({
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": user_message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    await agent_manager.update_agent_status(pm.id, AgentStatus.THINKING)

    # Log to vault
    try:
        await obsidian_service.log_agent_activity(
            "User", user_message, project="Chat"
        )
    except Exception as e:
        logger.warning(f"Vault log failed: {e}")

    agent_events: list[dict] = []
    reply: str = ""

    # --- Step 1: Ask PM LLM whether to delegate ---
    try:
        routing_prompt = _DELEGATION_PROMPT.format(
            message=user_message,
            agents=_fmt_agents(),
        )
        routing_resp = await llm_router.route(
            routing_prompt,
            system=agent_manager.ROLE_SYSTEM_PROMPTS[AgentRole.PROJECT_MANAGER],
            force_claude=False,
        )
        delegation = _parse_delegation(routing_resp.text)
    except Exception as e:
        logger.error(f"Routing LLM call failed: {e}")
        delegation = None

    # --- Step 2: Execute delegation or direct answer ---
    if delegation:
        role_str = delegation.get("role", "researcher")
        try:
            role = AgentRole(role_str)
        except ValueError:
            role = AgentRole.RESEARCHER

        task_desc = delegation.get("task", user_message)
        prefer_remote = delegation.get("prefer_remote_gpu", False)

        # Spawn if needed
        target_agent = None
        if delegation["action"] == "spawn_and_delegate":
            target_agent = await agent_manager.spawn_agent(
                role,
                name=delegation.get("agent_name"),
                prefer_remote_gpu=prefer_remote,
            )
            agent_events.append({"type": "spawned", "agent": target_agent.to_dict()})
        else:
            # Find an idle agent of the right role
            for a in agent_manager.get_all_agents():
                if a["role"] == role.value and a["status"] == AgentStatus.IDLE.value:
                    target_agent = agent_manager.get_agent(a["id"])
                    break
            if target_agent is None:
                # Spawn one on demand
                target_agent = await agent_manager.spawn_agent(
                    role, prefer_remote_gpu=prefer_remote
                )
                agent_events.append({"type": "spawned", "agent": target_agent.to_dict()})

        await agent_manager.assign_task(target_agent.id, task_desc)
        await agent_manager.update_agent_status(target_agent.id, AgentStatus.WORKING)

        # Run the task
        try:
            task_resp = await llm_router.route(
                task_desc,
                system=target_agent.system_prompt,
                prefer_remote_gpu=target_agent.prefer_remote_gpu,
            )
            task_result = task_resp.text
        except Exception as e:
            task_result = f"Error: {e}"
            await agent_manager.update_agent_status(target_agent.id, AgentStatus.ERROR)

        await agent_manager.update_agent_status(
            target_agent.id, AgentStatus.IDLE, task_result=task_result
        )
        agent_events.append({"type": "task_complete", "agent_id": target_agent.id,
                              "result": task_result[:300]})

        # Summarise for user
        summary_prompt = (
            f"A {role.value} agent completed this task: '{task_desc}'.\n"
            f"Result:\n{task_result}\n\n"
            f"Summarise the result for the user in 2-3 sentences."
        )
        try:
            summary_resp = await llm_router.route(
                summary_prompt,
                system=agent_manager.ROLE_SYSTEM_PROMPTS[AgentRole.PROJECT_MANAGER],
            )
            reply = summary_resp.text
        except Exception as e:
            reply = f"Task completed by {target_agent.name}. Result: {task_result[:500]}"

        # Save result to vault
        try:
            note_path = f"AgentWork/{role.value}/{task_desc[:40].replace(' ', '_')}"
            await obsidian_service.write_note(
                note_path,
                f"## Task\n{task_desc}\n\n## Result\n{task_result}",
                meta={"agent": target_agent.name, "role": role.value},
            )
        except Exception as e:
            logger.warning(f"Failed to save result to vault: {e}")

    else:
        # Direct answer
        try:
            direct_prompt = _DIRECT_ANSWER_PROMPT.format(
                message=user_message,
                history=_fmt_history(),
            )
            resp = await llm_router.route(
                direct_prompt,
                system=agent_manager.ROLE_SYSTEM_PROMPTS[AgentRole.PROJECT_MANAGER],
            )
            reply = resp.text
        except Exception as e:
            reply = f"I encountered an error: {e}"

    await agent_manager.update_agent_status(pm.id, AgentStatus.IDLE)

    _chat_history.append({
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": reply,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent_events": agent_events,
    })

    # Log PM reply to vault
    try:
        await obsidian_service.log_agent_activity(
            "Project Manager", reply[:200], project="Chat"
        )
    except Exception:
        pass

    return {"reply": reply, "agent_events": agent_events}


def get_chat_history(limit: int = 50) -> list[dict]:
    return _chat_history[-limit:]


async def get_status_report() -> str:
    """Generate a human-readable status report for the user."""
    agents = agent_manager.get_all_agents()
    lines = ["## Agent System Status\n"]
    for a in agents:
        task = a.get("current_task") or {}
        task_desc = task.get("description", "—") if task else "—"
        lines.append(f"- **{a['name']}** ({a['role']}): {a['status']} — {task_desc}")
    if not agents:
        lines.append("No agents currently active.")
    return "\n".join(lines)
