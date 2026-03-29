"""
WebSocket handler for real-time office UI updates and chat.

All connected browser clients receive agent state events so the
pixel-art office visualization stays in sync.
"""

import asyncio
import json
import logging
from quart import websocket, Blueprint

from services import agent_manager

logger = logging.getLogger(__name__)

ws_bp = Blueprint("ws", __name__)

# Connected WebSocket clients
_clients: set[asyncio.Queue] = set()
_clients_lock = asyncio.Lock()


async def _broadcast(message: dict):
    """Send a message to all connected WebSocket clients."""
    payload = json.dumps(message)
    async with _clients_lock:
        dead = set()
        for q in _clients:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.add(q)
        for q in dead:
            _clients.discard(q)


def setup_broadcast(app):
    """Wire the broadcast function into the agent_manager at app startup."""
    agent_manager.set_broadcast(_broadcast)


@ws_bp.websocket("/ws")
async def office_ws():
    """WebSocket endpoint consumed by the React office UI."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    async with _clients_lock:
        _clients.add(queue)

    logger.info(f"WebSocket client connected. Total: {len(_clients)}")

    # Send current agent snapshot to the new client
    try:
        snapshot = {
            "event": "snapshot",
            "data": {"agents": agent_manager.get_all_agents()},
        }
        await websocket.send(json.dumps(snapshot))
    except Exception:
        pass

    sender_task = asyncio.ensure_future(_ws_sender(queue))
    try:
        while True:
            # We don't process incoming WS messages here (chat uses HTTP POST)
            # But we keep the connection alive
            try:
                msg = await asyncio.wait_for(websocket.receive(), timeout=30)
                if msg == "ping":
                    await websocket.send("pong")
            except asyncio.TimeoutError:
                # send keepalive
                try:
                    await websocket.send(json.dumps({"event": "ping"}))
                except Exception:
                    break
    except Exception as e:
        logger.info(f"WebSocket client disconnected: {e}")
    finally:
        sender_task.cancel()
        async with _clients_lock:
            _clients.discard(queue)
        logger.info(f"WebSocket client removed. Total: {len(_clients)}")


async def _ws_sender(queue: asyncio.Queue):
    """Drain the per-client queue and send messages."""
    while True:
        payload = await queue.get()
        try:
            await websocket.send(payload)
        except Exception as e:
            logger.debug(f"WS send error: {e}")
            break
