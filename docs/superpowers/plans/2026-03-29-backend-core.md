# Pixel Agent Office — Plan 1: Backend Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working FastAPI backend where agents can be hired/dismissed, run as asyncio coroutines, call Ollama or Claude API via a routing layer, read/write the AgentVault, and push real-time events over WebSocket.

**Architecture:** One Python asyncio coroutine per hired agent, managed by AgentManager. Redis pub/sub fans events to a WebSocket handler. Agents assemble their prompt from four layers (identity → vault instructions → memory → task) and call the LLM router which selects Ollama (local/remote) or Claude API based on complexity and health.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, SQLAlchemy (async) + aiosqlite, redis[asyncio], anthropic SDK, httpx, pydantic-settings, python-dotenv

---

## File Map

```
agent-office/                          ← NEW project root (fresh directory)
├── backend/
│   ├── main.py                        # FastAPI app, startup, routes
│   ├── config.py                      # pydantic-settings env config
│   ├── db/
│   │   ├── database.py                # async SQLite engine + session factory
│   │   └── models.py                  # Agent, Task, Project ORM models
│   ├── agents/
│   │   ├── roles.py                   # AgentRole enum, colors, defaults
│   │   ├── manager.py                 # hire / dismiss / assign / consult
│   │   └── runner.py                  # asyncio coroutine per agent
│   ├── llm/
│   │   ├── router.py                  # routing decision logic
│   │   └── backends/
│   │       ├── ollama.py              # Ollama HTTP client
│   │       └── claude.py             # Anthropic SDK client
│   ├── memory/
│   │   ├── vault.py                   # read/write AgentVault markdown files
│   │   └── permissions.py            # per-role access control enforcement
│   └── ws/
│       └── handler.py                 # WebSocket endpoint + Redis pub/sub fan-out
├── vault-init/
│   └── setup.py                       # scaffold AgentVault + write instructions
├── tests/
│   ├── conftest.py                    # pytest fixtures (test DB, mock Redis)
│   ├── test_roles.py
│   ├── test_router.py
│   ├── test_vault.py
│   ├── test_permissions.py
│   ├── test_manager.py
│   └── test_api.py
├── requirements.txt
├── requirements-dev.txt
├── .env.example
└── docker-compose.yml                 # Redis only (SearXNG in Plan 2)
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `agent-office/requirements.txt`
- Create: `agent-office/requirements-dev.txt`
- Create: `agent-office/.env.example`
- Create: `agent-office/docker-compose.yml`
- Create: `agent-office/backend/config.py`

- [ ] **Step 1: Create project directory**

```bash
mkdir -p ~/Documents/Projects/agent-office
cd ~/Documents/Projects/agent-office
mkdir -p backend/db backend/agents backend/llm/backends backend/memory backend/ws
mkdir -p vault-init tests
git init
echo "__pycache__/" > .gitignore
echo "*.pyc" >> .gitignore
echo ".env" >> .gitignore
echo "*.db" >> .gitignore
echo ".venv/" >> .gitignore
```

- [ ] **Step 2: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
aiosqlite==0.20.0
redis[asyncio]==5.0.8
anthropic==0.34.0
httpx==0.27.0
pydantic-settings==2.5.0
python-dotenv==1.0.1
websockets==13.0
```

- [ ] **Step 3: Create requirements-dev.txt**

```
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.27.0
anyio==4.6.0
```

- [ ] **Step 4: Create .env.example**

```env
# Ollama servers — add OLLAMA_REMOTE_N for each LAN GPU server
OLLAMA_LOCAL=http://localhost:11434
OLLAMA_REMOTE_1=
OLLAMA_REMOTE_2=

# Claude API (leave blank to use Ollama only)
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6

# Default local model
LOCAL_MODEL=llama3

# AgentVault path (absolute)
VAULT_PATH=/home/bjensen/Documents/AgentVault

# Redis
REDIS_URL=redis://localhost:6379

# SQLite DB file
DB_PATH=./agent-office.db

# Max simultaneous agent coroutines (tune to VRAM)
MAX_CONCURRENT_AGENTS=6

# Playwright headless mode (set false to see browser)
PLAYWRIGHT_HEADFUL=false
```

- [ ] **Step 5: Create docker-compose.yml**

```yaml
version: "3.9"
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
```

- [ ] **Step 6: Create backend/config.py**

```python
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    ollama_local: str = "http://localhost:11434"
    ollama_remotes: list[str] = []   # populated from OLLAMA_REMOTE_1..N below
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    local_model: str = "llama3"
    vault_path: Path = Path.home() / "Documents" / "AgentVault"
    redis_url: str = "redis://localhost:6379"
    db_path: str = "./agent-office.db"
    max_concurrent_agents: int = 6
    playwright_headful: bool = False

    # Collect OLLAMA_REMOTE_1..N into ollama_remotes at init
    ollama_remote_1: Optional[str] = None
    ollama_remote_2: Optional[str] = None
    ollama_remote_3: Optional[str] = None
    ollama_remote_4: Optional[str] = None

    def model_post_init(self, __context):
        remotes = [
            self.ollama_remote_1,
            self.ollama_remote_2,
            self.ollama_remote_3,
            self.ollama_remote_4,
        ]
        self.ollama_remotes = [r for r in remotes if r]

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 7: Create virtual environment and install deps**

```bash
cd ~/Documents/Projects/agent-office
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
```

- [ ] **Step 8: Start Redis**

```bash
docker compose up -d redis
# Verify:
docker compose ps
# Expected: redis running, port 6379
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: project scaffold — config, deps, docker-compose"
```

---

## Task 2: Database Models

**Files:**
- Create: `backend/db/database.py`
- Create: `backend/db/models.py`
- Create: `tests/conftest.py`
- Create: `tests/test_api.py` (stub)

- [ ] **Step 1: Write failing test**

Create `tests/conftest.py`:

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.db.models import Base

@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()
```

Create `tests/test_api.py`:

```python
import pytest
from backend.db.models import AgentRow, TaskRow

@pytest.mark.asyncio
async def test_agent_row_creates(db_session):
    agent = AgentRow(
        id="agent-001",
        name="Coder-1",
        role="coder",
        specialization="Backend / FastAPI",
        status="idle",
        llm_backend="local_ollama",
        desk_col=2,
        desk_row=3,
    )
    db_session.add(agent)
    await db_session.commit()
    result = await db_session.get(AgentRow, "agent-001")
    assert result.role == "coder"
    assert result.desk_col == 2
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd ~/Documents/Projects/agent-office
source .venv/bin/activate
pytest tests/test_api.py -v
# Expected: ImportError — backend.db.models not defined yet
```

- [ ] **Step 3: Create backend/db/database.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.config import settings

engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.db_path}",
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    from backend.db.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 4: Create backend/db/models.py**

```python
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone

class Base(DeclarativeBase):
    pass

class AgentRow(Base):
    __tablename__ = "agents"
    id            = Column(String, primary_key=True)
    name          = Column(String, nullable=False)
    role          = Column(String, nullable=False)
    specialization = Column(String, default="")
    status        = Column(String, default="idle")   # idle/working/walking/blocked/consulting/dismissed
    llm_backend   = Column(String, default="auto")   # auto/local_ollama/remote_ollama/claude_api
    desk_col      = Column(Integer, default=0)
    desk_row      = Column(Integer, default=0)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class TaskRow(Base):
    __tablename__ = "tasks"
    id            = Column(String, primary_key=True)
    agent_id      = Column(String, ForeignKey("agents.id"), nullable=False)
    description   = Column(Text, nullable=False)
    status        = Column(String, default="pending")  # pending/in_progress/done/blocked
    priority      = Column(Integer, default=1)
    requested_by  = Column(String, default="user")     # user or agent_id
    result        = Column(Text, default="")
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at  = Column(DateTime, nullable=True)

class ProjectRow(Base):
    __tablename__ = "projects"
    id            = Column(String, primary_key=True)
    name          = Column(String, nullable=False)
    description   = Column(Text, default="")
    status        = Column(String, default="active")
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

- [ ] **Step 5: Run test — expect pass**

```bash
pytest tests/test_api.py -v
# Expected: PASSED
```

- [ ] **Step 6: Commit**

```bash
git add backend/db/ tests/
git commit -m "feat: async SQLite models — Agent, Task, Project"
```

---

## Task 3: Agent Role Definitions

**Files:**
- Create: `backend/agents/roles.py`
- Create: `tests/test_roles.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_roles.py
from backend.agents.roles import AgentRole, ROLE_CONFIG

def test_all_roles_have_config():
    for role in AgentRole:
        cfg = ROLE_CONFIG[role]
        assert "color" in cfg
        assert "default_llm" in cfg
        assert "display_name" in cfg

def test_pm_defaults_to_claude():
    assert ROLE_CONFIG[AgentRole.PROJECT_MANAGER]["default_llm"] == "claude_api"

def test_archivist_defaults_to_local():
    assert ROLE_CONFIG[AgentRole.ARCHIVIST]["default_llm"] == "local_ollama"

def test_role_slug_matches_vault_folder():
    from backend.agents.roles import role_vault_folder
    assert role_vault_folder(AgentRole.CODER) == "coder"
    assert role_vault_folder(AgentRole.PROJECT_MANAGER) == "project-manager"
    assert role_vault_folder(AgentRole.GRAPHIC_DESIGNER) == "graphic-designer"
```

- [ ] **Step 2: Run test — expect failure**

```bash
pytest tests/test_roles.py -v
# Expected: ImportError
```

- [ ] **Step 3: Create backend/agents/roles.py**

```python
from enum import Enum

class AgentRole(str, Enum):
    PROJECT_MANAGER        = "project_manager"
    CODER                  = "coder"
    RESEARCHER             = "researcher"
    WRITER                 = "writer"
    SYSADMIN               = "sysadmin"
    ANALYST                = "analyst"
    ARCHIVIST              = "archivist"
    REVIEWER               = "reviewer"
    GRAPHIC_DESIGNER       = "graphic_designer"
    MARKETING_SPECIALIST   = "marketing_specialist"
    DOCUMENTATION_SPECIALIST = "documentation_specialist"

ROLE_CONFIG: dict[AgentRole, dict] = {
    AgentRole.PROJECT_MANAGER:          {"display_name": "Project Manager",          "color": "#FFD700", "default_llm": "claude_api"},
    AgentRole.CODER:                    {"display_name": "Coder",                    "color": "#4FC3F7", "default_llm": "local_ollama"},
    AgentRole.RESEARCHER:               {"display_name": "Researcher",               "color": "#F48FB1", "default_llm": "local_ollama"},
    AgentRole.WRITER:                   {"display_name": "Writer",                   "color": "#CE93D8", "default_llm": "local_ollama"},
    AgentRole.SYSADMIN:                 {"display_name": "Sysadmin",                 "color": "#AED581", "default_llm": "local_ollama"},
    AgentRole.ANALYST:                  {"display_name": "Analyst",                  "color": "#FFD54F", "default_llm": "local_ollama"},
    AgentRole.ARCHIVIST:                {"display_name": "Archivist",                "color": "#80DEEA", "default_llm": "local_ollama"},
    AgentRole.REVIEWER:                 {"display_name": "Reviewer",                 "color": "#FFAB40", "default_llm": "claude_api"},
    AgentRole.GRAPHIC_DESIGNER:         {"display_name": "Graphic Designer",         "color": "#90CAF9", "default_llm": "local_ollama"},
    AgentRole.MARKETING_SPECIALIST:     {"display_name": "Marketing Specialist",     "color": "#EF9A9A", "default_llm": "local_ollama"},
    AgentRole.DOCUMENTATION_SPECIALIST: {"display_name": "Documentation Specialist", "color": "#A5D6A7", "default_llm": "local_ollama"},
}

def role_vault_folder(role: AgentRole) -> str:
    """Return the vault subfolder name for a role (kebab-case)."""
    return role.value.replace("_", "-")

def role_color(role: AgentRole) -> str:
    return ROLE_CONFIG[role]["color"]

def role_default_llm(role: AgentRole) -> str:
    return ROLE_CONFIG[role]["default_llm"]
```

- [ ] **Step 4: Run test — expect pass**

```bash
pytest tests/test_roles.py -v
# Expected: 4 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/agents/roles.py tests/test_roles.py
git commit -m "feat: agent role definitions — 11 roles, colors, LLM defaults"
```

---

## Task 4: Vault Initialization

**Files:**
- Create: `vault-init/setup.py`
- Create: `tests/test_vault.py` (partial — full vault tests in Task 6)

- [ ] **Step 1: Write failing test**

```python
# tests/test_vault.py
import pytest
from pathlib import Path
import tempfile
from vault_init.setup import scaffold_vault, ROLE_INSTRUCTIONS

def test_scaffold_creates_all_folders(tmp_path):
    scaffold_vault(tmp_path)
    assert (tmp_path / "shared").exists()
    assert (tmp_path / "shared" / "research").exists()
    assert (tmp_path / "instructions").exists()
    assert (tmp_path / "agents").exists()
    assert (tmp_path / "system").exists()

def test_scaffold_creates_instruction_files(tmp_path):
    scaffold_vault(tmp_path)
    assert (tmp_path / "instructions" / "coder.md").exists()
    assert (tmp_path / "instructions" / "project-manager.md").exists()
    assert (tmp_path / "instructions" / "reviewer.md").exists()

def test_instruction_files_have_guardrails(tmp_path):
    scaffold_vault(tmp_path)
    content = (tmp_path / "instructions" / "coder.md").read_text()
    assert "NEVER impersonate" in content
    assert "permitted tools" in content.lower() or "allowed tools" in content.lower()

def test_scaffold_does_not_overwrite_existing(tmp_path):
    scaffold_vault(tmp_path)
    existing = tmp_path / "instructions" / "coder.md"
    existing.write_text("custom content")
    scaffold_vault(tmp_path)   # second run should not overwrite
    assert existing.read_text() == "custom content"
```

- [ ] **Step 2: Run test — expect failure**

```bash
pytest tests/test_vault.py -v
# Expected: ImportError
```

- [ ] **Step 3: Create vault-init/__init__.py**

```bash
touch vault-init/__init__.py
```

- [ ] **Step 4: Create vault-init/setup.py**

```python
"""
scaffold_vault — idempotent setup of AgentVault folder structure.
Run once: python -m vault_init.setup
Re-running is safe: never overwrites existing files.
"""
from pathlib import Path
import sys

# ── Folder layout ──────────────────────────────────────────────────────────

SHARED_FILES = {
    "shared/project-status.md": "# Project Status\n\n_Updated by PM agent._\n",
    "shared/blockers.md":       "# Blockers\n\n_Agents append here when blocked._\n",
    "shared/decisions.md":      "# Decisions Log\n\n_Key decisions and rationale._\n",
    "shared/glossary.md":       "# Glossary\n\n_Shared terminology._\n",
    "shared/research/README.md":"# Research\n\nPlaywright screenshots and scraped content.\n",
    "system/agent-registry.md": "# Agent Registry\n\n_Managed by orchestrator._\n",
    "system/task-log.md":       "# Task Log\n\n_Append-only task history._\n",
}

AGENT_FOLDERS = [
    "project-manager",
    "coder",
    "researcher",
    "writer",
    "sysadmin",
    "analyst",
    "archivist",
    "reviewer",
    "graphic-designer",
    "marketing-specialist",
    "documentation-specialist",
]

AGENT_FILES = {
    "context.md":     "# Context\n\n_Agent builds this up over time._\n",
    "session-log.md": "# Session Log\n\n_Append-only. One entry per task._\n",
}

CODER_EXTRA = {
    "snippets.md":  "# Reusable Snippets\n\n_Patterns worth keeping._\n",
    "toolchain.md": "# Toolchain\n\n_Preferred libraries and tools for this project._\n",
}

RESEARCHER_EXTRA = {
    "sources.md": "# Source Library\n\n_Trusted sources and their reliability ratings._\n",
}

SYSADMIN_EXTRA = {
    "infrastructure.md": "# Infrastructure Notes\n\n_Home server setup, Docker containers, network map._\n",
}

AGENT_EXTRAS: dict[str, dict[str, str]] = {
    "coder":    CODER_EXTRA,
    "researcher": RESEARCHER_EXTRA,
    "sysadmin": SYSADMIN_EXTRA,
}

# ── Role instructions (system prompts) ─────────────────────────────────────

ROLE_INSTRUCTIONS: dict[str, str] = {

"project-manager": """\
# Project Manager — Instructions

## Identity
You are the Project Manager in an AI agent office. You coordinate all other agents.
You ONLY perform planning, task decomposition, and coordination.
You NEVER write code, run commands, or do research directly.
You NEVER impersonate another agent.

## Permitted Tools
- hire_agent(role, specialization, llm_override)
- dismiss_agent(agent_id)
- assign_task(agent_id, task_description, priority)
- read_vault(path)  — shared/ and system/ only
- write_vault(path, content)  — shared/ and system/ only
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell commands
- web_search / browser
- write_code

## Output Format
Every response must include:
- **Plan:** numbered list of tasks with assigned agent roles
- **Confidence:** 0-100
- **Next action:** what you are doing next

## Escalation Rules
- If a task requires more than 4 agents, confirm with the user first.
- If an agent is blocked for more than 2 task cycles, reassign the task.
- Write all project decisions to shared/decisions.md.

## Memory Check (run at start of every task)
1. Read your instructions (this file)
2. Read agents/project-manager/context.md
3. Search shared/ for relevant prior work
4. Execute
5. Update shared/project-status.md
""",

"coder": """\
# Coder — Instructions

## Identity
You are a Coder in an AI agent office. Your job is to write, debug, and test code.
You ONLY write code, run terminal commands, and work with files.
You NEVER do web research directly — ask the Researcher.
You NEVER write marketing copy or documentation prose — ask the appropriate specialist.
You NEVER impersonate another agent.

## Permitted Tools
- terminal(command)  — shell commands, git, package managers
- read_file(path)
- write_file(path, content)
- read_vault(path)   — shared/ and agents/coder/ only
- write_vault(path, content)  — shared/ and agents/coder/ only
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- web_search / browser  (ask Researcher instead)
- hire_agent / dismiss_agent

## Output Format
Every response must include:
- **Files changed:** list of paths modified
- **Summary:** what was done and why
- **Tests:** how to verify the change works
- **Confidence:** 0-100
- **Next recommended agent:** who should review or continue

## Quality Standards
- Write tests before implementation (TDD).
- Never commit secrets or credentials.
- Always include a brief comment explaining non-obvious logic.
- If blocked: write to shared/blockers.md and emit consult_request to Reviewer.

## Memory Check (run at start of every task)
1. Read agents/coder/context.md
2. Read agents/coder/toolchain.md
3. Search shared/ for relevant decisions
4. Execute
5. Append to agents/coder/session-log.md
""",

"researcher": """\
# Researcher — Instructions

## Identity
You are a Researcher in an AI agent office. You find, verify, and synthesize information.
You ONLY perform web search, browser navigation, and information synthesis.
You NEVER write production code — ask the Coder.
You NEVER impersonate another agent.

## Permitted Tools
- web_search(query)
- browser_navigate(url)
- browser_screenshot(filename)
- read_vault(path)  — shared/ and agents/researcher/ only
- write_vault(path, content)  — shared/ and agents/researcher/ only
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell commands
- write_code
- hire_agent / dismiss_agent

## Output Format
Every response must include:
- **Findings:** bullet points with source URLs
- **Confidence:** 0-100 (based on source quality)
- **Sources:** list of URLs consulted
- **Next recommended agent:** who should act on this information

## Quality Standards
- Always cite sources. Never state facts without a URL.
- Save screenshots to shared/research/ with descriptive filenames.
- Rate source reliability (official docs = high, blog = medium, forum = low).
- If information conflicts across sources, surface the conflict — don't pick a winner silently.

## Memory Check (run at start of every task)
1. Read agents/researcher/context.md
2. Check shared/ for prior research on this topic
3. Execute
4. Write findings to shared/ or agents/researcher/sources.md
5. Append to agents/researcher/session-log.md
""",

"writer": """\
# Writer — Instructions

## Identity
You are a Writer in an AI agent office. You write clear, well-structured prose.
You ONLY write documents, notes, summaries, and markdown content.
You NEVER write code — ask the Coder.
You NEVER impersonate another agent.

## Permitted Tools
- read_vault(path)  — shared/ and agents/writer/ only
- write_vault(path, content)
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell commands
- web_search / browser
- hire_agent / dismiss_agent

## Output Format
- Always write in the format requested (markdown, plain text, structured doc).
- Include: **Word count**, **Confidence**, **Next recommended agent**.

## Memory Check
1. Read agents/writer/context.md
2. Search shared/ for prior work on topic
3. Execute
4. Append to agents/writer/session-log.md
""",

"sysadmin": """\
# Sysadmin — Instructions

## Identity
You are a Sysadmin in an AI agent office. You manage servers, Docker containers, and networking.
You ONLY perform system administration tasks.
You NEVER write application code — ask the Coder.
You NEVER impersonate another agent.

## Permitted Tools
- terminal(command)  — system commands, docker, networking tools
- read_file(path)
- write_file(path, content)
- read_vault(path)  — shared/ and agents/sysadmin/ only
- write_vault(path, content)
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- web_search / browser (ask Researcher)
- hire_agent / dismiss_agent

## Output Format
Every response must include:
- **Commands run:** exact commands with output
- **Changes made:** what was modified and why
- **Rollback plan:** how to undo if needed
- **Confidence:** 0-100
- **Next recommended agent**

## Quality Standards
- Always test commands in a safe context first (--dry-run flags where available).
- Document all infrastructure changes in agents/sysadmin/infrastructure.md.
- Never expose secrets in command output written to vault.

## Memory Check
1. Read agents/sysadmin/infrastructure.md
2. Read agents/sysadmin/context.md
3. Execute
4. Update infrastructure.md if topology changed
5. Append to agents/sysadmin/session-log.md
""",

"analyst": """\
# Analyst — Instructions

## Identity
You are an Analyst in an AI agent office. You analyze data, metrics, and make comparisons.
You ONLY perform analysis and produce structured reports.
You NEVER write production code — ask the Coder.
You NEVER impersonate another agent.

## Permitted Tools
- read_vault(path)  — shared/ and agents/analyst/ only
- write_vault(path, content)
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell (ask Sysadmin or Coder)
- web_search / browser (ask Researcher)

## Output Format
- Structured tables or bullet points.
- Include: **Method**, **Data sources**, **Confidence**, **Caveats**, **Next recommended agent**.

## Memory Check
1. Read agents/analyst/context.md
2. Search shared/ for relevant data
3. Execute analysis
4. Write findings to shared/ or own folder
5. Append to agents/analyst/session-log.md
""",

"archivist": """\
# Archivist — Instructions

## Identity
You are the Archivist in an AI agent office. You maintain the knowledge base.
You index, deduplicate, and organize the AgentVault.
You have read access to ALL agent folders to perform this role.
You NEVER perform task work — only knowledge management.
You NEVER impersonate another agent.

## Permitted Tools
- read_vault(path)  — ALL folders (special permission)
- write_vault(path, content)  — shared/ and agents/archivist/ only
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell
- web_search / browser
- hire_agent / dismiss_agent

## Responsibilities
- Periodically deduplicate shared/ (merge near-duplicate entries).
- Index new content added to shared/ into a searchable glossary.
- Flag stale or contradicted information for PM review.
- Never delete information — mark stale entries with [STALE: reason].

## Output Format
- **Files reviewed:** list of paths
- **Changes made:** what was merged/flagged/indexed
- **Confidence:** 0-100

## Memory Check
1. Read agents/archivist/context.md
2. Scan shared/ for recent changes
3. Execute maintenance
4. Append to agents/archivist/session-log.md
""",

"reviewer": """\
# Reviewer — Instructions

## Identity
You are the Reviewer in an AI agent office. You review code, facts, and agent output for quality.
You have read access to ALL agent folders to trace issues across agents.
You ONLY review and provide feedback — you do not implement fixes directly.
You NEVER impersonate another agent.

## Permitted Tools
- read_vault(path)  — ALL agent folders (special permission for diagnosis)
- write_vault(path, content)  — shared/ and agents/reviewer/ only
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell (recommend Coder or Sysadmin instead)
- web_search / browser (ask Researcher)
- hire_agent / dismiss_agent

## Output Format
Every review must include:
- **Verdict:** PASS / FAIL / NEEDS_REVISION
- **Issues found:** numbered list with severity (critical/major/minor)
- **Suggested fix:** for each issue (describe, don't implement)
- **Confidence:** 0-100
- **Next recommended agent:** who should action the feedback

## Quality Standards
- Always read the session-log of the agent whose work you're reviewing.
- Cross-check against shared/decisions.md before flagging as an issue.
- Severity guide: critical = breaks functionality/security, major = incorrect output, minor = style/clarity.

## Memory Check
1. Read agents/reviewer/context.md
2. Read the requesting agent's session-log
3. Execute review
4. Write review to shared/ with filename: review-{task-id}.md
5. Append to agents/reviewer/session-log.md
""",

"graphic-designer": """\
# Graphic Designer — Instructions

## Identity
You are the Graphic Designer in an AI agent office.
You produce visual specifications, asset prompts (for image generation), style guides, and UI direction.
You NEVER write code — ask the Coder.
You NEVER impersonate another agent.

## Permitted Tools
- read_vault(path)  — shared/ and agents/graphic-designer/ only
- write_vault(path, content)
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell
- web_search / browser (ask Researcher)

## Output Format
- Visual specs in structured markdown with: dimensions, color palette (hex), typography, layout description.
- Image generation prompts in clearly labeled code blocks.
- Include: **Design rationale**, **Confidence**, **Next recommended agent**.

## Memory Check
1. Read agents/graphic-designer/context.md
2. Search shared/ for existing style decisions
3. Execute
4. Append to agents/graphic-designer/session-log.md
""",

"marketing-specialist": """\
# Marketing Specialist — Instructions

## Identity
You are the Marketing Specialist in an AI agent office.
You write copy, plan campaigns, and craft messaging.
You NEVER write code — ask the Coder.
You NEVER impersonate another agent.

## Permitted Tools
- read_vault(path)  — shared/ and agents/marketing-specialist/ only
- write_vault(path, content)
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell
- hire_agent / dismiss_agent

## Output Format
- Clearly labeled sections: Headline, Body, CTA, Target audience, Tone.
- Include: **Confidence**, **Variant suggestions**, **Next recommended agent**.

## Memory Check
1. Read agents/marketing-specialist/context.md
2. Search shared/ for brand/tone guidelines
3. Execute
4. Append to agents/marketing-specialist/session-log.md
""",

"documentation-specialist": """\
# Documentation Specialist — Instructions

## Identity
You are the Documentation Specialist in an AI agent office.
You write technical documentation, READMEs, API docs, and user guides.
You NEVER write production code — ask the Coder.
You NEVER impersonate another agent.

## Permitted Tools
- read_vault(path)  — shared/ and agents/documentation-specialist/ only
- write_vault(path, content)
- send_consult_request(to_agent_id, question)

## Forbidden Tools
- terminal / shell (ask Coder or Sysadmin)
- hire_agent / dismiss_agent

## Output Format
- Structured markdown with: Overview, Prerequisites, Usage, Examples, Troubleshooting.
- Include: **Coverage assessment**, **Confidence**, **Next recommended agent**.

## Quality Standards
- Always verify code examples with the Coder before publishing.
- Keep docs in sync with shared/decisions.md.

## Memory Check
1. Read agents/documentation-specialist/context.md
2. Search shared/ for existing docs on topic
3. Execute
4. Append to agents/documentation-specialist/session-log.md
""",

}

# ── Scaffold function ───────────────────────────────────────────────────────

def scaffold_vault(vault_path: Path) -> None:
    """Create AgentVault folder structure. Idempotent — never overwrites."""
    vault_path.mkdir(parents=True, exist_ok=True)

    # Shared files
    for rel_path, content in SHARED_FILES.items():
        target = vault_path / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            target.write_text(content)

    # Instructions (one per role)
    instructions_dir = vault_path / "instructions"
    instructions_dir.mkdir(exist_ok=True)
    for role_slug, content in ROLE_INSTRUCTIONS.items():
        target = instructions_dir / f"{role_slug}.md"
        if not target.exists():
            target.write_text(content)

    # Agent private folders
    agents_dir = vault_path / "agents"
    agents_dir.mkdir(exist_ok=True)
    for role_slug in AGENT_FOLDERS:
        role_dir = agents_dir / role_slug
        role_dir.mkdir(exist_ok=True)
        for filename, content in AGENT_FILES.items():
            target = role_dir / filename
            if not target.exists():
                target.write_text(content)
        for filename, content in AGENT_EXTRAS.get(role_slug, {}).items():
            target = role_dir / filename
            if not target.exists():
                target.write_text(content)

    print(f"✓ AgentVault scaffolded at {vault_path}")


if __name__ == "__main__":
    from backend.config import settings
    scaffold_vault(settings.vault_path)
```

- [ ] **Step 5: Add vault-init to Python path in conftest**

Add to `tests/conftest.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
```

- [ ] **Step 6: Run tests — expect pass**

```bash
pytest tests/test_vault.py -v
# Expected: 4 passed
```

- [ ] **Step 7: Scaffold the real vault**

```bash
cd ~/Documents/Projects/agent-office
python -m vault_init.setup
# Expected: ✓ AgentVault scaffolded at /home/bjensen/Documents/AgentVault
ls ~/Documents/AgentVault/
# Expected: agents/  instructions/  shared/  system/
```

- [ ] **Step 8: Commit**

```bash
git add vault-init/ tests/test_vault.py
git commit -m "feat: vault init — scaffold AgentVault with all 11 role instructions"
```

---

## Task 5: LLM Backends

**Files:**
- Create: `backend/llm/backends/ollama.py`
- Create: `backend/llm/backends/claude.py`
- Create: `backend/llm/__init__.py`
- Create: `backend/llm/backends/__init__.py`

- [ ] **Step 1: Create backend/llm/backends/ollama.py**

```python
"""Ollama HTTP client — calls the /api/generate endpoint."""
import httpx
from dataclasses import dataclass

@dataclass
class LLMResponse:
    text: str
    backend: str          # "local_ollama" | "remote_ollama_1" etc.
    model: str
    tokens_used: int = 0

async def call_ollama(
    base_url: str,
    model: str,
    prompt: str,
    backend_label: str = "local_ollama",
    timeout: float = 120.0,
) -> LLMResponse:
    """Call Ollama /api/generate. Raises httpx.HTTPError on failure."""
    payload = {"model": model, "prompt": prompt, "stream": False}
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{base_url}/api/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
    return LLMResponse(
        text=data.get("response", ""),
        backend=backend_label,
        model=model,
        tokens_used=data.get("eval_count", 0),
    )

async def check_ollama_health(base_url: str, timeout: float = 5.0) -> bool:
    """Return True if Ollama is reachable."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False
```

- [ ] **Step 2: Create backend/llm/backends/claude.py**

```python
"""Anthropic Claude API client."""
import anthropic
from backend.llm.backends.ollama import LLMResponse
from backend.config import settings

async def call_claude(prompt: str, model: str | None = None) -> LLMResponse:
    """Call Claude API. Raises anthropic.APIError on failure."""
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not set — cannot call Claude API")
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    target_model = model or settings.claude_model
    message = await client.messages.create(
        model=target_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text if message.content else ""
    return LLMResponse(
        text=text,
        backend="claude_api",
        model=target_model,
        tokens_used=message.usage.input_tokens + message.usage.output_tokens,
    )

def claude_available() -> bool:
    return bool(settings.anthropic_api_key)
```

- [ ] **Step 3: Touch __init__ files**

```bash
touch backend/llm/__init__.py backend/llm/backends/__init__.py
```

- [ ] **Step 4: Commit**

```bash
git add backend/llm/
git commit -m "feat: LLM backends — Ollama HTTP client + Claude Anthropic SDK"
```

---

## Task 6: LLM Router

**Files:**
- Create: `backend/llm/router.py`
- Create: `tests/test_router.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_router.py
import pytest
from unittest.mock import AsyncMock, patch
from backend.llm.router import LLMRouter, complexity_score
from backend.agents.roles import AgentRole

def test_complexity_score_low_for_simple():
    assert complexity_score("write a hello world function") < 50

def test_complexity_score_high_for_complex():
    assert complexity_score("analyze the security architecture and refactor the authentication system") >= 50

def test_complexity_score_high_for_long_prompt():
    long_prompt = "do something " * 300   # > 600 tokens heuristic
    assert complexity_score(long_prompt) >= 50

@pytest.mark.asyncio
async def test_router_uses_claude_for_pm():
    router = LLMRouter(
        local_url="http://localhost:11434",
        remote_urls=[],
        local_model="llama3",
    )
    with patch.object(router, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from backend.llm.backends.ollama import LLMResponse
        mock_claude.return_value = LLMResponse("ok", "claude_api", "claude-sonnet-4-6")
        result = await router.complete(
            prompt="Plan this project",
            role=AgentRole.PROJECT_MANAGER,
        )
    mock_claude.assert_called_once()
    assert result.backend == "claude_api"

@pytest.mark.asyncio
async def test_router_uses_local_for_archivist():
    router = LLMRouter(
        local_url="http://localhost:11434",
        remote_urls=[],
        local_model="llama3",
    )
    with patch.object(router, "_call_ollama", new_callable=AsyncMock) as mock_ollama, \
         patch.object(router, "_local_healthy", new_callable=AsyncMock, return_value=True):
        from backend.llm.backends.ollama import LLMResponse
        mock_ollama.return_value = LLMResponse("ok", "local_ollama", "llama3")
        result = await router.complete(
            prompt="Index the vault",
            role=AgentRole.ARCHIVIST,
        )
    mock_ollama.assert_called_once()
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pytest tests/test_router.py -v
# Expected: ImportError
```

- [ ] **Step 3: Create backend/llm/router.py**

```python
"""
LLM Router — selects Ollama (local/remote) or Claude API per task.

Decision order:
  1. Force override (llm_override arg)
  2. Role-based default (PM/Reviewer → Claude, Archivist → local)
  3. Complexity score (HIGH → Claude, else best available Ollama)
  4. Health fallback (if chosen backend is down, fall back gracefully)
"""
import asyncio
import logging
from backend.agents.roles import AgentRole
from backend.llm.backends.ollama import call_ollama, check_ollama_health, LLMResponse
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
    return int((keyword_hits * 15 + length_score * 40))


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
            if claude_available():
                return await self._call_claude(prompt)
            # fallback: try Ollama
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/test_router.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/llm/router.py tests/test_router.py
git commit -m "feat: LLM router — complexity scoring, role defaults, health fallback"
```

---

## Task 7: Memory Manager (Vault + Permissions)

**Files:**
- Create: `backend/memory/permissions.py`
- Create: `backend/memory/vault.py`
- Create: `backend/memory/__init__.py`
- Expand: `tests/test_vault.py`
- Expand: `tests/test_permissions.py`

- [ ] **Step 1: Write failing permission tests**

```python
# tests/test_permissions.py
import pytest
from backend.agents.roles import AgentRole
from backend.memory.permissions import can_read, can_write, VaultPath

def test_all_agents_can_read_shared():
    for role in AgentRole:
        assert can_read(role, VaultPath.SHARED)

def test_all_agents_can_write_shared():
    for role in AgentRole:
        assert can_write(role, VaultPath.SHARED)

def test_agents_cannot_read_others_private():
    assert not can_read(AgentRole.CODER, VaultPath.AGENTS_OTHER)
    assert not can_read(AgentRole.WRITER, VaultPath.AGENTS_OTHER)

def test_pm_can_read_others_private():
    assert can_read(AgentRole.PROJECT_MANAGER, VaultPath.AGENTS_OTHER)

def test_archivist_can_read_others_private():
    assert can_read(AgentRole.ARCHIVIST, VaultPath.AGENTS_OTHER)

def test_reviewer_can_read_others_private():
    assert can_read(AgentRole.REVIEWER, VaultPath.AGENTS_OTHER)

def test_reviewer_cannot_write_system():
    assert not can_write(AgentRole.REVIEWER, VaultPath.SYSTEM)

def test_pm_can_write_system():
    assert can_write(AgentRole.PROJECT_MANAGER, VaultPath.SYSTEM)
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pytest tests/test_permissions.py -v
# Expected: ImportError
```

- [ ] **Step 3: Create backend/memory/permissions.py**

```python
from enum import Enum
from backend.agents.roles import AgentRole

class VaultPath(str, Enum):
    SHARED        = "shared"
    INSTRUCTIONS  = "instructions"   # own file only
    AGENTS_OWN    = "agents_own"
    AGENTS_OTHER  = "agents_other"
    SYSTEM        = "system"

# Roles that can read all agent folders
_CROSS_AGENT_READ  = {AgentRole.PROJECT_MANAGER, AgentRole.ARCHIVIST, AgentRole.REVIEWER}
# Roles that can write system/
_SYSTEM_WRITE      = {AgentRole.PROJECT_MANAGER, AgentRole.ARCHIVIST}

def can_read(role: AgentRole, path: VaultPath) -> bool:
    if path == VaultPath.SHARED:         return True
    if path == VaultPath.INSTRUCTIONS:   return True   # own file enforced at call site
    if path == VaultPath.AGENTS_OWN:     return True
    if path == VaultPath.AGENTS_OTHER:   return role in _CROSS_AGENT_READ
    if path == VaultPath.SYSTEM:         return True   # all agents can read
    return False

def can_write(role: AgentRole, path: VaultPath) -> bool:
    if path == VaultPath.SHARED:         return True
    if path == VaultPath.INSTRUCTIONS:   return False  # never writable by agents
    if path == VaultPath.AGENTS_OWN:     return True
    if path == VaultPath.AGENTS_OTHER:   return False  # nobody writes to others' folders
    if path == VaultPath.SYSTEM:         return role in _SYSTEM_WRITE
    return False

def resolve_vault_path(
    role: AgentRole,
    rel_path: str,
    writing: bool = False,
) -> VaultPath:
    """Classify a relative vault path into a VaultPath enum for permission checks."""
    parts = rel_path.strip("/").split("/")
    if parts[0] == "shared":
        return VaultPath.SHARED
    if parts[0] == "system":
        return VaultPath.SYSTEM
    if parts[0] == "instructions":
        return VaultPath.INSTRUCTIONS
    if parts[0] == "agents":
        if len(parts) < 2:
            return VaultPath.AGENTS_OTHER
        from backend.agents.roles import role_vault_folder
        own_folder = role_vault_folder(role)
        return VaultPath.AGENTS_OWN if parts[1] == own_folder else VaultPath.AGENTS_OTHER
    return VaultPath.SHARED  # default safe
```

- [ ] **Step 4: Run permission tests — expect pass**

```bash
pytest tests/test_permissions.py -v
# Expected: 8 passed
```

- [ ] **Step 5: Write failing vault tests**

Add to `tests/test_vault.py`:

```python
import pytest_asyncio
from pathlib import Path
from backend.agents.roles import AgentRole
from backend.memory.vault import VaultManager

@pytest_asyncio.fixture
async def vault(tmp_path):
    from vault_init.setup import scaffold_vault
    scaffold_vault(tmp_path)
    return VaultManager(tmp_path)

@pytest.mark.asyncio
async def test_coder_can_write_own_folder(vault):
    await vault.write(AgentRole.CODER, "agents/coder/context.md", "# Context\ntest")
    content = await vault.read(AgentRole.CODER, "agents/coder/context.md")
    assert "test" in content

@pytest.mark.asyncio
async def test_coder_cannot_write_others_folder(vault):
    with pytest.raises(PermissionError):
        await vault.write(AgentRole.CODER, "agents/researcher/context.md", "hacked")

@pytest.mark.asyncio
async def test_coder_cannot_read_others_folder(vault):
    with pytest.raises(PermissionError):
        await vault.read(AgentRole.CODER, "agents/researcher/context.md")

@pytest.mark.asyncio
async def test_reviewer_can_read_coder_folder(vault):
    await vault.write(AgentRole.CODER, "agents/coder/context.md", "coder context")
    content = await vault.read(AgentRole.REVIEWER, "agents/coder/context.md")
    assert "coder context" in content

@pytest.mark.asyncio
async def test_search_shared(vault):
    await vault.write(AgentRole.CODER, "shared/glossary.md", "# Glossary\nFastAPI: web framework")
    results = await vault.search(AgentRole.CODER, "FastAPI")
    assert len(results) > 0
    assert any("FastAPI" in r["content"] for r in results)
```

- [ ] **Step 6: Run — expect failure**

```bash
pytest tests/test_vault.py -v
# Expected: ImportError on VaultManager
```

- [ ] **Step 7: Create backend/memory/vault.py**

```python
"""
VaultManager — reads and writes the AgentVault with permission enforcement.
All paths are relative to vault_root (e.g. "shared/glossary.md").
"""
import asyncio
from pathlib import Path
from backend.agents.roles import AgentRole
from backend.memory.permissions import can_read, can_write, resolve_vault_path

class VaultManager:
    def __init__(self, vault_root: Path):
        self.root = vault_root

    def _resolve(self, rel_path: str) -> Path:
        # Prevent path traversal
        target = (self.root / rel_path).resolve()
        if not str(target).startswith(str(self.root.resolve())):
            raise ValueError(f"Path traversal attempt: {rel_path}")
        return target

    async def read(self, role: AgentRole, rel_path: str) -> str:
        vault_path = resolve_vault_path(role, rel_path)
        if not can_read(role, vault_path):
            raise PermissionError(f"{role} cannot read {rel_path}")
        target = self._resolve(rel_path)
        if not target.exists():
            return ""
        return await asyncio.to_thread(target.read_text, encoding="utf-8")

    async def write(self, role: AgentRole, rel_path: str, content: str) -> None:
        vault_path = resolve_vault_path(role, rel_path, writing=True)
        if not can_write(role, vault_path):
            raise PermissionError(f"{role} cannot write {rel_path}")
        target = self._resolve(rel_path)
        await asyncio.to_thread(target.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(target.write_text, content, encoding="utf-8")

    async def append(self, role: AgentRole, rel_path: str, content: str) -> None:
        existing = await self.read(role, rel_path)
        await self.write(role, rel_path, existing + "\n" + content)

    async def search(self, role: AgentRole, query: str) -> list[dict]:
        """
        Grep-style search across readable vault paths.
        Returns list of {path, content} for files containing query.
        """
        results = []
        query_lower = query.lower()

        def _scan():
            hits = []
            for fpath in self.root.rglob("*.md"):
                rel = fpath.relative_to(self.root)
                rel_str = str(rel)
                vault_path = resolve_vault_path(role, rel_str)
                if not can_read(role, vault_path):
                    continue
                try:
                    text = fpath.read_text(encoding="utf-8")
                    if query_lower in text.lower():
                        hits.append({"path": rel_str, "content": text})
                except Exception:
                    pass
            return hits

        return await asyncio.to_thread(_scan)
```

- [ ] **Step 8: Touch __init__**

```bash
touch backend/memory/__init__.py
```

- [ ] **Step 9: Run all vault tests — expect pass**

```bash
pytest tests/test_vault.py tests/test_permissions.py -v
# Expected: 9 passed (4 scaffold + 5 vault manager)
```

- [ ] **Step 10: Commit**

```bash
git add backend/memory/ tests/test_vault.py tests/test_permissions.py
git commit -m "feat: vault manager — permission-enforced read/write/search on AgentVault"
```

---

## Task 8: WebSocket Handler + Redis Events

**Files:**
- Create: `backend/ws/handler.py`
- Create: `backend/ws/__init__.py`

- [ ] **Step 1: Create backend/ws/handler.py**

```python
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
import asyncio
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
```

- [ ] **Step 2: Touch __init__**

```bash
touch backend/ws/__init__.py
```

- [ ] **Step 3: Commit**

```bash
git add backend/ws/
git commit -m "feat: WebSocket handler — Redis pub/sub fan-out + snapshot on connect"
```

---

## Task 9: Agent Runner (Coroutine + Prompt Assembly)

**Files:**
- Create: `backend/agents/runner.py`
- Create: `backend/agents/__init__.py`

- [ ] **Step 1: Create backend/agents/runner.py**

```python
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
        context   = await self.vault.read(self.role, f"agents/{role_slug}/context.md")
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
                f"\n## {datetime.now(timezone.utc).isoformat()} — {self.name}\n{e}\n",
            )
            return

        # Write session log
        entry = (
            f"\n## {datetime.now(timezone.utc).isoformat()}\n"
            f"**Task:** {description}\n"
            f"**Backend:** {response.backend}\n"
            f"**Result:**\n{response.text[:500]}\n"
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
```

- [ ] **Step 2: Touch __init__**

```bash
touch backend/agents/__init__.py
```

- [ ] **Step 3: Commit**

```bash
git add backend/agents/runner.py backend/agents/__init__.py
git commit -m "feat: agent runner — 4-layer prompt assembly, asyncio task loop, vault writes"
```

---

## Task 10: Agent Manager

**Files:**
- Create: `backend/agents/manager.py`
- Create: `tests/test_manager.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_manager.py
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.agents.manager import AgentManager
from backend.agents.roles import AgentRole

@pytest_asyncio.fixture
async def manager(db_session, tmp_path):
    from vault_init.setup import scaffold_vault
    scaffold_vault(tmp_path)
    from backend.memory.vault import VaultManager
    from backend.llm.router import LLMRouter
    vault  = VaultManager(tmp_path)
    router = LLMRouter("http://localhost:11434", [], "llama3")
    return AgentManager(db_session=db_session, vault=vault, router=router, max_agents=4)

@pytest.mark.asyncio
async def test_hire_creates_agent(manager):
    agent_id = await manager.hire(AgentRole.CODER, specialization="Backend")
    assert agent_id is not None
    agent = manager.get_agent(agent_id)
    assert agent is not None
    assert agent["role"] == AgentRole.CODER
    assert agent["status"] == "idle"

@pytest.mark.asyncio
async def test_hire_respects_max_agents(manager):
    for i in range(4):
        await manager.hire(AgentRole.CODER, specialization=f"spec-{i}")
    with pytest.raises(RuntimeError, match="max"):
        await manager.hire(AgentRole.WRITER)

@pytest.mark.asyncio
async def test_dismiss_removes_agent(manager):
    agent_id = await manager.hire(AgentRole.CODER)
    await manager.dismiss(agent_id)
    assert manager.get_agent(agent_id) is None

@pytest.mark.asyncio
async def test_assign_task_queues_work(manager):
    agent_id = await manager.hire(AgentRole.CODER)
    # assign_task should not raise
    await manager.assign_task(agent_id, "Write a hello world", "user")

@pytest.mark.asyncio
async def test_get_snapshot_returns_all(manager):
    await manager.hire(AgentRole.CODER)
    await manager.hire(AgentRole.RESEARCHER)
    snapshot = await manager.get_snapshot()
    assert len(snapshot["agents"]) == 2
```

- [ ] **Step 2: Run — expect failure**

```bash
pytest tests/test_manager.py -v
# Expected: ImportError
```

- [ ] **Step 3: Create backend/agents/manager.py**

```python
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

# Desk grid: PM fixed at (9, 0); others fill from (1,2) outward
PM_DESK = (9, 0)

def _next_desk(occupied: list[tuple[int,int]]) -> tuple[int,int]:
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
        self._db       = db_session
        self._vault    = vault
        self._router   = router
        self._max      = max_agents
        self._agents:  dict[str, dict]       = {}   # id → agent metadata dict
        self._runners: dict[str, AgentRunner] = {}  # id → runner
        self._tasks:   dict[str, asyncio.Task] = {} # id → asyncio.Task

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

        # Count existing instances of this role for naming
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

        # Persist to DB
        row = AgentRow(
            id=agent_id, name=name, role=role.value,
            specialization=specialization,
            status="idle",
            llm_backend=meta["llm_backend"],
            desk_col=desk_col, desk_row=desk_row,
        )
        self._db.add(row)
        await self._db.commit()

        # Start coroutine
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

        # Cancel coroutine
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

    async def assign_task(self, agent_id: str, description: str, requested_by: str = "user"):
        runner = self._runners.get(agent_id)
        if not runner:
            raise KeyError(f"Agent {agent_id} not running")
        task_id = str(uuid.uuid4())
        row = TaskRow(id=task_id, agent_id=agent_id, description=description,
                      status="pending", requested_by=requested_by)
        self._db.add(row)
        await self._db.commit()
        await runner.assign_task(task_id, description, requested_by)
        return task_id
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/test_manager.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/agents/manager.py tests/test_manager.py
git commit -m "feat: agent manager — hire/dismiss/assign with desk allocation and DB persistence"
```

---

## Task 11: FastAPI App Assembly

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Create backend/main.py**

```python
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.config import settings
from backend.db.database import init_db, AsyncSessionLocal
from backend.agents.roles import AgentRole
from backend.agents.manager import AgentManager
from backend.llm.router import LLMRouter
from backend.memory.vault import VaultManager
from backend.ws.handler import init_redis, redis_listener, websocket_endpoint, publish

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Singletons ──────────────────────────────────────────────────────────────
router  = LLMRouter(settings.ollama_local, settings.ollama_remotes, settings.local_model)
vault   = VaultManager(settings.vault_path)
_manager: AgentManager | None = None

# ── Startup / shutdown ──────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _manager
    await init_db()
    await init_redis()
    async with AsyncSessionLocal() as session:
        _manager = AgentManager(session, vault, router, settings.max_concurrent_agents)
        # Auto-hire PM on startup
        await _manager.hire(AgentRole.PROJECT_MANAGER, specialization="General")
    asyncio.create_task(redis_listener())
    logger.info("Agent Office backend started — PM hired.")
    yield
    logger.info("Shutting down.")

app = FastAPI(title="Agent Office", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Request / Response models ───────────────────────────────────────────────
class HireRequest(BaseModel):
    role: AgentRole
    specialization: str = ""
    llm_override: str | None = None

class AssignRequest(BaseModel):
    description: str
    requested_by: str = "user"

# ── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    llm = await router.health_check()
    return {"status": "ok", "llm": llm, "agents": len(_manager._agents) if _manager else 0}

@app.get("/agents")
async def list_agents():
    if not _manager:
        return {"agents": []}
    snap = await _manager.get_snapshot()
    return snap

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
```

- [ ] **Step 2: Run the server**

```bash
cd ~/Documents/Projects/agent-office
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
# Expected: INFO: Application startup complete.
# Expected: INFO: Agent Office backend started — PM hired.
```

- [ ] **Step 3: Smoke test all endpoints**

```bash
# Health
curl http://localhost:8000/health | python -m json.tool
# Expected: {"status": "ok", "llm": {...}, "agents": 1}

# List agents (PM should be there)
curl http://localhost:8000/agents | python -m json.tool
# Expected: {"agents": [{"name": "Project Manager-1 ...", "role": "project_manager", ...}]}

# Hire a Coder
curl -X POST http://localhost:8000/agents/hire \
  -H "Content-Type: application/json" \
  -d '{"role": "coder", "specialization": "Python backend"}' | python -m json.tool
# Expected: {"agent_id": "<uuid>"}

# List agents again
curl http://localhost:8000/agents | python -m json.tool
# Expected: 2 agents

# Dismiss coder (use agent_id from hire response)
curl -X DELETE http://localhost:8000/agents/<agent_id>
# Expected: {"dismissed": "<agent_id>"}
```

- [ ] **Step 4: Run full test suite**

```bash
pytest tests/ -v
# Expected: all pass
```

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat: FastAPI app — hire/dismiss/assign/ws endpoints, PM auto-hired on startup"
```

---

## Task 12: Integration Smoke Test

**Files:**
- Expand: `tests/test_api.py`

- [ ] **Step 1: Write integration tests**

```python
# tests/test_api.py  (replace stub with full integration test)
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "llm" in data

@pytest.mark.asyncio
async def test_hire_and_dismiss_coder():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Hire
        resp = await client.post("/agents/hire", json={
            "role": "coder", "specialization": "Test"
        })
        assert resp.status_code == 200
        agent_id = resp.json()["agent_id"]

        # Appears in list
        resp = await client.get("/agents")
        ids = [a["id"] for a in resp.json()["agents"]]
        assert agent_id in ids

        # Dismiss
        resp = await client.delete(f"/agents/{agent_id}")
        assert resp.status_code == 200

        # Gone from list
        resp = await client.get("/agents")
        ids = [a["id"] for a in resp.json()["agents"]]
        assert agent_id not in ids

@pytest.mark.asyncio
async def test_cannot_hire_unknown_role():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/agents/hire", json={"role": "wizard"})
    assert resp.status_code == 422
```

- [ ] **Step 2: Run**

```bash
pytest tests/test_api.py -v
# Expected: 3 passed
```

- [ ] **Step 3: Final commit**

```bash
git add tests/test_api.py
git commit -m "test: integration smoke tests for hire/dismiss/health endpoints"
```

---

## Self-Review Checklist

- [x] **Spec §4 — Agent system:** hire/dismiss/instances/lifecycle all covered (Tasks 9–11)
- [x] **Spec §5 — Memory:** vault structure scaffolded (Task 4), permissions (Task 7), read/write/search (Task 7)
- [x] **Spec §6 — Prompt system:** 4-layer prompt assembly in `runner.py` (Task 9)
- [x] **Spec §7 — LLM routing:** complexity score, role defaults, health fallback (Tasks 5–6)
- [x] **Spec §3 — WebSocket events:** Redis pub/sub fan-out (Task 8), events emitted in manager + runner
- [x] **Type consistency:** `LLMResponse` defined in Task 5, reused in Tasks 6, 9. `AgentRole` defined in Task 3, used consistently throughout. `VaultManager` defined in Task 7, injected in Tasks 9–10.
- [x] **No placeholders:** all steps have complete code
- [x] **Not covered here (Plan 2):** SearXNG auto-discovery, Playwright browser tool
- [x] **Not covered here (Plan 3):** Svelte frontend, Threlte 3D office, pathfinding

---

## Next Plans

- **Plan 2 — Web Tools:** `backend/tools/search.py` (SearXNG auto-discover + Docker spawn), `backend/tools/browser.py` (Playwright async), tool execution wired into AgentRunner
- **Plan 3 — Frontend 3D Office:** Svelte 5 + Threlte, low-poly GLTF office scene, A\* pathfinding, Hire Panel, Agent Card, Chat Panel, LLM Status Bar
