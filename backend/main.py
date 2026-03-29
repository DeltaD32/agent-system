import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from functools import partial
from backend.config import settings
from backend.db.database import init_db, AsyncSessionLocal
from backend.agents.roles import AgentRole
from backend.agents.manager import AgentManager
from backend.llm.router import LLMRouter
from backend.memory.vault import VaultManager
from backend.tools import ToolKit
from backend.tools.search import SearXNGClient, discover_searxng
from backend.tools.browser import browse as _browse
from backend.tools.terminal import run_command
from backend.ws.handler import init_redis, redis_listener, websocket_endpoint, publish

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Singletons ───────────────────────────────────────────────────────────────
router = LLMRouter(settings.ollama_local, settings.ollama_remotes, settings.local_model)
vault  = VaultManager(settings.vault_path)
_manager: AgentManager | None = None
_db_session = None

# ── Startup / shutdown ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _manager, _db_session
    await init_db()
    await init_redis()

    # Discover SearXNG (use .env value if set, otherwise auto-discover)
    searxng_url = settings.searxng_url
    if not searxng_url:
        searxng_url = await discover_searxng()
        if searxng_url:
            settings.searxng_url = searxng_url
            logger.info(f"SearXNG discovered at {searxng_url}")
        else:
            logger.warning("SearXNG not found — search tool disabled")

    # Build ToolKit
    search_fn = SearXNGClient(searxng_url).search if searxng_url else None
    browse_fn = partial(_browse, vault_root=settings.vault_path, headful=settings.playwright_headful)
    toolkit = ToolKit(
        search=search_fn,
        browse=browse_fn,
        terminal=run_command,
    )

    # Keep session open for app lifetime (single-user local app)
    _db_session = AsyncSessionLocal()
    _manager = AgentManager(_db_session, vault, router, settings.max_concurrent_agents, toolkit)
    await _manager.hire(AgentRole.PROJECT_MANAGER, specialization="General")
    asyncio.create_task(redis_listener())
    logger.info("Agent Office backend started — PM hired.")
    yield
    await _db_session.close()
    logger.info("Shutting down.")


app = FastAPI(title="Agent Office", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ────────────────────────────────────────────────
class HireRequest(BaseModel):
    role: AgentRole
    specialization: str = ""
    llm_override: str | None = None


class AssignRequest(BaseModel):
    description: str
    requested_by: str = "user"


# ── Routes ───────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    llm = await router.health_check()
    return {
        "status": "ok",
        "llm": llm,
        "agents": len(_manager._agents) if _manager else 0,
        "searxng": settings.searxng_url,
    }


@app.get("/agents")
async def list_agents():
    if not _manager:
        return {"agents": []}
    return await _manager.get_snapshot()


@app.post("/agents/hire")
async def hire_agent(req: HireRequest):
    if not _manager:
        raise HTTPException(503, "Manager not ready")
    try:
        agent_id = await _manager.hire(req.role, req.specialization, req.llm_override)
        return {"agent_id": agent_id}
    except RuntimeError as e:
        raise HTTPException(409, str(e))


@app.delete("/agents/{agent_id}")
async def dismiss_agent(agent_id: str):
    if not _manager:
        raise HTTPException(503, "Manager not ready")
    try:
        await _manager.dismiss(agent_id)
        return {"dismissed": agent_id}
    except KeyError:
        raise HTTPException(404, "Agent not found")


@app.post("/agents/{agent_id}/task")
async def assign_task(agent_id: str, req: AssignRequest):
    if not _manager:
        raise HTTPException(503, "Manager not ready")
    try:
        task_id = await _manager.assign_task(agent_id, req.description, req.requested_by)
        return {"task_id": task_id}
    except KeyError:
        raise HTTPException(404, "Agent not found")


@app.get("/llm/status")
async def llm_status():
    return await router.health_check()


@app.websocket("/ws")
async def ws_route(websocket: WebSocket):
    await websocket_endpoint(websocket, agent_manager=_manager)
