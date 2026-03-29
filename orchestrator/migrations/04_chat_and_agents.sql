-- Migration 04: Chat history and agent registry
-- Compatible with PostgreSQL 13+

-- Chat messages (persistent history)
CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT         NOT NULL,
    agent_events JSONB       DEFAULT '[]',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages (created_at DESC);

-- Agent registry (persistent across restarts)
CREATE TABLE IF NOT EXISTS agent_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    role            VARCHAR(50)  NOT NULL,
    status          VARCHAR(30)  NOT NULL DEFAULT 'idle',
    desk_col        INTEGER      NOT NULL DEFAULT 0,
    desk_row        INTEGER      NOT NULL DEFAULT 0,
    color           VARCHAR(10)  NOT NULL DEFAULT '#88aaff',
    prefer_remote   BOOLEAN      NOT NULL DEFAULT FALSE,
    current_task    JSONB,
    task_history    JSONB        DEFAULT '[]',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_registry_role   ON agent_registry (role);
CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON agent_registry (status);

-- Vault activity log (mirrors obsidian notes for quick querying)
CREATE TABLE IF NOT EXISTS vault_activity (
    id          BIGSERIAL    PRIMARY KEY,
    agent_name  VARCHAR(100) NOT NULL,
    note_path   TEXT         NOT NULL,
    action      VARCHAR(20)  NOT NULL CHECK (action IN ('read', 'write', 'delete', 'search')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_activity_created ON vault_activity (created_at DESC);
