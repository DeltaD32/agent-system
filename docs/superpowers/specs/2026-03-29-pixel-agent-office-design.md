# Pixel Agent Office — Design Spec
**Date:** 2026-03-29
**Status:** Approved
**Project:** Fresh implementation (replaces prior agent-system codebase)

---

## 1. Overview

A locally-running multi-agent AI system with a 3D low-poly pixel-art office as its primary interface. Users hire specialist agents to accomplish tasks — coding home projects, researching server setups, writing docs, designing assets, and more. Agents have persistent memory via an Obsidian vault, can browse the web, and route their LLM calls across local GPU (Ollama), remote Ollama servers, or Claude API depending on task complexity.

The office is a fully rotatable 3D environment. Agents are low-poly humanoid models with pixel-art textures that physically walk to each other's desks to consult, collaborate, and hand off work.

---

## 2. Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | Python 3.12 + FastAPI | Async-native, excellent LLM/AI tooling ecosystem |
| Agent runtime | asyncio (one coroutine per agent) | Lightweight, no message broker daemon needed |
| Frontend | Svelte 5 | Minimal boilerplate, reactive, fast |
| 3D renderer | Threlte (Three.js + Svelte) | Native Svelte/Three.js integration, orbit camera built-in |
| Real-time | Redis pub/sub → WebSocket | Fast event fan-out from orchestrator to frontend |
| Storage | SQLite (via SQLAlchemy async) | More than sufficient for home-scale use |
| Search | SearXNG | Privacy-respecting, self-hosted |
| Browser automation | Playwright (async Python) | Full page control for deep web research |
| Memory | Obsidian vault (markdown files) | Human-readable, survives system changes, no vector DB needed |
| Pathfinding | pathfinding.js (A\*) | Lightweight, no deps, runs in browser |
| 3D models | Low-poly GLTF + pixel textures | Cinematic feel, small file sizes, pixel aesthetic preserved |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  SVELTE FRONTEND  (localhost:5173)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Threlte 3D   │  │  Chat Panel  │  │  Hire Panel   │  │
│  │ Office       │  │  per-agent   │  │  spawn/assign │  │
│  │ orbit camera │  │  + PM chat   │  │  + dismiss    │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└────────────────────────┬────────────────────────────────┘
              WebSocket (events) │ REST API
┌─────────────────────────────────────────────────────────┐
│  FASTAPI ORCHESTRATOR  (localhost:8000)                  │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌────────┐  │
│  │   Agent    │ │    LLM     │ │  Memory  │ │  Tool  │  │
│  │  Manager   │ │   Router   │ │  Manager │ │  Exec  │  │
│  └────────────┘ └────────────┘ └──────────┘ └────────┘  │
└──────┬──────────────┬─────────────┬────────────┬────────┘
       │              │             │            │
  ┌────┴───┐   ┌──────┴──────┐ ┌───┴────┐  ┌───┴──────┐
  │ Ollama │   │  Claude API │ │Obsidian│  │ SearXNG  │
  │ local  │   │  (complex   │ │ Vault  │  │ +        │
  │ remote │   │   tasks)    │ │        │  │Playwright│
  │ N svrs │   └─────────────┘ └────────┘  └──────────┘
  └────────┘
       │
  ┌────┴───────────────┐
  │  SQLite  │  Redis  │
  └─────────────────────┘
```

### Key architectural decisions

- **One asyncio coroutine per hired agent.** No RabbitMQ, no Celery. Each `hire` call spawns a coroutine managed by the Agent Manager. Dismissed agents have their coroutine cancelled cleanly.
- **Redis pub/sub for real-time events.** The orchestrator publishes typed events (`agent_hired`, `agent_moved`, `agent_status_updated`, `consult_request`, etc.) to Redis. The WebSocket handler fans these out to connected frontend clients.
- **Obsidian vault as the sole memory layer.** No vector database. Agents read/write markdown files. The Archivist role handles periodic deduplication and indexing of `shared/`.
- **SearXNG auto-discovery.** On startup, the orchestrator probes `localhost:8080`, then the Docker network. If neither is reachable it spawns a SearXNG container via Docker SDK. URL is stored in config once found.

---

## 4. Agent System

### 4.1 Roles

| Role | Color | Default LLM | Capabilities |
|---|---|---|---|
| Project Manager | Gold `#FFD700` | Claude API | Decompose tasks, hire/dismiss agents, track projects |
| Coder | Cyan `#4FC3F7` | Local Ollama | Write/debug code, run terminal commands, git ops |
| Researcher | Pink `#F48FB1` | Local → Claude | Web search, Playwright browsing, synthesize findings |
| Writer | Lavender `#CE93D8` | Local Ollama | Docs, notes, summaries, markdown |
| Sysadmin | Green `#AED581` | Local Ollama | Docker, networking, server config, home lab tasks |
| Analyst | Amber `#FFD54F` | Local Ollama | Data analysis, metrics, comparisons |
| Archivist | Teal `#80DEEA` | Local Ollama | Vault management, indexing, deduplication |
| Reviewer | Orange `#FFAB40` | Claude API | Code review, fact-checking, cross-agent diagnosis |
| Graphic Designer | Blue `#90CAF9` | Local Ollama | Asset prompts, image specs, visual direction |
| Marketing Specialist | Red `#EF9A9A` | Local Ollama | Copy, campaigns, messaging |
| Documentation Specialist | Sage `#A5D6A7` | Local Ollama | Technical docs, READMEs, API docs |

### 4.2 Multiple Instances

Any role can be hired N times. Each instance receives:
- A unique name: `Coder-1 [Backend]`, `Coder-2 [Frontend]`
- Its own asyncio coroutine
- Its own private vault folder: `agents/coder-1-backend/`
- A specialization string injected into the base role prompt

Concurrency cap is configurable via `MAX_CONCURRENT_AGENTS` in `.env` (default: 6, tuned to available VRAM).

### 4.3 Agent Lifecycle

```
hire → desk assigned → coroutine spawned → agent_hired event
  → idle → task assigned → working → [consult if blocked]
  → task complete → idle
  → dismiss → coroutine cancelled → desk freed → agent_dismissed event
```

### 4.4 Agent-to-Agent Consultation

When an agent is blocked or needs specialist input:
1. Writes question to `shared/blockers.md`
2. Emits `consult_request` event with `from_agent`, `to_agent`, `question`
3. Frontend triggers pathfinding — sprite walks to target desk
4. Target agent receives task injection with question in context
5. Responds via `consult_response` event
6. Requesting agent resumes with answer injected into its context

---

## 5. Memory — AgentVault

**Vault path:** `~/Documents/AgentVault`

### 5.1 Folder Structure

```
AgentVault/
├── shared/                    ← all agents read + write
│   ├── project-status.md
│   ├── blockers.md
│   ├── decisions.md
│   ├── glossary.md
│   └── research/              ← Playwright screenshots + scraped content
├── instructions/              ← role system prompts (agents read own file only)
│   ├── project-manager.md
│   ├── coder.md
│   ├── researcher.md
│   ├── writer.md
│   ├── sysadmin.md
│   ├── analyst.md
│   ├── archivist.md
│   ├── reviewer.md
│   ├── graphic-designer.md
│   ├── marketing-specialist.md
│   └── documentation-specialist.md
├── agents/                    ← private per-agent memory
│   ├── project-manager/
│   │   ├── context.md
│   │   └── session-log.md
│   ├── coder/
│   │   ├── context.md
│   │   ├── snippets.md
│   │   ├── toolchain.md
│   │   └── session-log.md
│   └── {role}/                ← same pattern for all roles
└── system/                    ← orchestrator metadata (agents read-only)
    ├── agent-registry.md
    └── task-log.md
```

### 5.2 Permission Matrix

| Agent | shared/ | instructions/own | agents/own | agents/others | system/ |
|---|---|---|---|---|---|
| Project Manager | RW | R | RW | R | RW |
| Archivist | RW | R | RW | R | RW |
| Reviewer | RW | R | RW | R | R |
| All others | RW | R | RW | — | R |

### 5.3 Memory Check Protocol (all agents)

Every agent follows this sequence at the start of each task:
1. Read `instructions/{role}.md` → load identity rules and constraints
2. Read `agents/{role}/context.md` → load private memory
3. Search `shared/` for relevant prior work
4. Execute task
5. Write findings to `shared/` and/or own folder
6. Update `agents/{role}/session-log.md` with task summary

---

## 6. Agent Prompt System ("Staying in Their Stack")

Each agent's full prompt is assembled from four layers at task time:

### Layer 1 — Identity (hardcoded, never overridable)
```
You are {role} in an AI agent office. Your specialization: {specialization}.
You ONLY perform tasks within your role. You NEVER impersonate another agent.
If asked to do something outside your role, you redirect to the correct specialist
and emit a consult_request.
```

### Layer 2 — Instructions (loaded from vault)
Contents of `instructions/{role}.md`. Defines:
- Tools this role is allowed to use
- Tools explicitly forbidden
- Output format requirements (always include: confidence score, sources, next recommended agent)
- Escalation rules (when to notify PM, when to block)
- Quality standards
- Which agents to consult for what

### Layer 3 — Memory (loaded per task)
- Contents of `agents/{role}/context.md`
- Relevant search hits from `shared/`
- Current project state from PM task description
- Output of previous chained task (if applicable)

### Layer 4 — Task (per invocation)
- Task description and expected output format
- Priority level
- Requesting agent identity
- Deadline (if set)

### Guardrail Rules (present in every `instructions/{role}.md`)
- ✓ Explicit list of permitted tools
- ✗ Explicit list of forbidden tools
- ✓ All outputs must include: confidence score, sources used, next recommended agent
- ✓ If blocked: write to `shared/blockers.md` and emit `consult_request`
- ✗ Never write to another agent's private folder
- ✗ Never skip the memory-check protocol

---

## 7. LLM Routing

### Decision Order
1. **Force override** — user pinned a backend in the Hire panel → use it
2. **Local Ollama health** — ping `OLLAMA_LOCAL`; if down try remotes in order; if all down fall back to Claude API
3. **Task complexity score** — keyword heuristic + token length
   - LOW → local Ollama
   - MED → best available Ollama
   - HIGH → Claude API
4. **Role-based default** — PM and Reviewer always prefer Claude API; Archivist always local

### Multi-Server Config (`.env`)
```env
OLLAMA_LOCAL=http://localhost:11434
OLLAMA_REMOTE_1=http://192.168.x.x:11434
OLLAMA_REMOTE_2=http://192.168.x.x:11434
# Add OLLAMA_REMOTE_N as needed — router probes all on startup, re-checks every 60s
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
LOCAL_MODEL=llama3
MAX_CONCURRENT_AGENTS=6
```

### Complexity Keywords (routes to Claude)
`reason, analyze, architecture, design, refactor, security, vulnerability, optimize, explain, compare, evaluate, critique, plan, decompose`

---

## 8. 3D Pixel Office

### Rendering Stack
- **Threlte** (Svelte + Three.js) for all 3D rendering
- **OrbitControls** — drag to rotate, scroll to zoom, right-drag to pan
- **GLTF models** — low-poly room, desks, chairs exported from Blender
- **Pixel textures** — 16×16 to 64×64 PNG textures applied to all surfaces, `THREE.NearestFilter` for sharp pixels
- **Humanoid agent models** — low-poly (~200 tri) with role-colored pixel skin textures

### Office Layout
- PM desk fixed at center-back of room (always visible, always reachable)
- Archivist and Reviewer desks flanking PM (coordination roles near center)
- Specialist desks (Coder, Researcher, Writer, Sysadmin, etc.) arranged in rows
- Dynamic desk pool: desks spawn with a pop animation on hire, fade out on dismiss
- Office expands (new row added) if all desks are occupied

### Pathfinding
- 2D grid (20×14 tiles) mapped to 3D floor coordinates
- Each desk occupies a 2×2 tile footprint marked as non-walkable
- A* via `pathfinding.js` recalculates walkable grid on every hire/dismiss
- Agents lerp smoothly between tile centers in 3D space
- Walk speed scales with distance (longer paths feel purposeful, not frantic)

### Agent Sprite States

| State | Visual |
|---|---|
| `idle` | Sitting at desk, subtle 2-frame bob animation |
| `working` | Typing animation, soft glow pulse on model |
| `walking` | 4-frame walk cycle, moves along A* path |
| `blocked` | Exclamation mark above head, model shakes |
| `consulting` | Speech bubble, standing at another agent's desk |
| `dismissed` | Fade out + shrink, desk disappears after 500ms |

### Click Interactions
- Click any agent model → opens Agent Card panel
- Agent Card shows: name, role, specialization, current task, LLM backend, status
- Actions: 💬 Chat directly, 📂 Open vault folder, ✕ Dismiss

---

## 9. Web Tools

### SearXNG
- On startup: probe `localhost:8080` → Docker network gateway → spawn container
- Spawn uses Docker SDK (`docker.from_env()`), pulls `searxng/searxng:latest` if not cached
- URL stored in runtime config once resolved
- All search results include source URLs, titles, snippets

### Playwright
- Async Playwright (Python) for full browser control
- Researcher role primary user; other roles can request via `consult_request`
- Screenshots saved to `shared/research/` for other agents to reference
- Headless by default; `PLAYWRIGHT_HEADFUL=true` in `.env` for debugging

---

## 10. Project Structure (fresh)

```
agent-office/
├── backend/
│   ├── main.py                 # FastAPI app entry
│   ├── agents/
│   │   ├── manager.py          # hire/dismiss/assign
│   │   ├── runner.py           # asyncio coroutine per agent
│   │   └── roles.py            # role definitions + colors
│   ├── llm/
│   │   ├── router.py           # routing logic
│   │   └── backends/
│   │       ├── ollama.py
│   │       └── claude.py
│   ├── memory/
│   │   ├── vault.py            # read/write AgentVault
│   │   └── permissions.py      # enforce folder access rules
│   ├── tools/
│   │   ├── search.py           # SearXNG client + auto-spawn
│   │   ├── browser.py          # Playwright wrapper
│   │   └── terminal.py         # shell command executor
│   ├── ws/
│   │   └── handler.py          # WebSocket + Redis pub/sub
│   └── db/
│       └── models.py           # SQLAlchemy models
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── Office3D.svelte       # Threlte scene root
│   │   │   ├── AgentModel.svelte     # per-agent 3D model
│   │   │   ├── DeskMesh.svelte       # desk + chair mesh
│   │   │   ├── Pathfinder.ts         # A* grid + pathfinding.js
│   │   │   ├── HirePanel.svelte      # spawn UI
│   │   │   ├── AgentCard.svelte      # click-to-inspect
│   │   │   ├── ChatPanel.svelte      # per-agent + PM chat
│   │   │   └── LLMStatusBar.svelte   # backend health
│   │   ├── stores/
│   │   │   └── agents.ts             # Svelte store for agent state
│   │   └── App.svelte
│   └── static/
│       ├── models/             # GLTF low-poly assets
│       └── textures/           # pixel art PNGs
├── vault-init/
│   └── setup.py                # scaffolds AgentVault folder structure
│                               # and writes default instructions/{role}.md files
├── docker-compose.yml          # Redis + SearXNG (optional)
├── .env.example
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-29-pixel-agent-office-design.md
```

---

## 11. Non-Goals (explicit scope boundary)

- No mobile support
- No multi-user / authentication (single local user)
- No cloud deployment — runs entirely on local machine
- No vector database — agents retrieve memory via filesystem grep on the vault (sufficient for home scale; no semantic/embedding search needed)
- No RabbitMQ or Celery (asyncio is sufficient)
- No agent-to-agent communication except via vault + consult events (no direct API calls between agents)
