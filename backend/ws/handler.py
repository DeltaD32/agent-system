"""
WebSocket handler — connects to Redis pub/sub and fans events to browser clients.

Event types published to Redis channel "agent_events":
  agent_hired          {id, name, role, color, specialization, desk_col, desk_row, llm_backend}
  agent_dismissed      {agent_id}
  agent_status_updated {id, status}
  agent_moved          {agent_id, desk_col, desk_row}
  agent_task_assigned  {id, task_id, description}
  consult_request      {from_agent_id, to_agent_id, question}
  consult_response     {from_agent_id, to_agent_id, answer}
  snapshot             {agents: [...]}   — sent on WS connect
"""
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
from backend.config import settings

logger = logging.getLogger(__name__)
CHANNEL = "agent_events"

# Global Redis connection (initialised in startup)
_redis: aioredis.Redis | None = None
_connected_clients: list[WebSocket] = []


async def init_redis():
    global _redis
    _redis = aioredis.from_url(settings.redis_url, decode_responses=True)


async def publish(event_type: str, data: dict):
    if _redis is None:
        return
    msg = json.dumps({"event": event_type, "data": data})
    await _redis.publish(CHANNEL, msg)


async def _fan_out(message: str):
    dead = []
    for ws in _connected_clients:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connected_clients.remove(ws)


async def redis_listener():
    """Background task — listens on Redis channel and fans out to WS clients."""
    if _redis is None:
        return
    pubsub = _redis.pubsub()
    await pubsub.subscribe(CHANNEL)
    async for message in pubsub.listen():
        if message["type"] == "message":
            await _fan_out(message["data"])


async def websocket_endpoint(websocket: WebSocket, agent_manager=None):
    await websocket.accept()
    _connected_clients.append(websocket)
    # Send snapshot of current state on connect
    if agent_manager:
        snapshot = await agent_manager.get_snapshot()
        await websocket.send_text(json.dumps({"event": "snapshot", "data": snapshot}))
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _connected_clients:
            _connected_clients.remove(websocket)
