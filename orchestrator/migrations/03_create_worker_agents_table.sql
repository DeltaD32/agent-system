-- Create worker_agents table
CREATE TABLE IF NOT EXISTS worker_agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'available',
    capabilities JSONB DEFAULT '[]'::jsonb,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_worker_agents_status ON worker_agents(status);
CREATE INDEX IF NOT EXISTS idx_worker_agents_last_heartbeat ON worker_agents(last_heartbeat);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_worker_agents_updated_at
    BEFORE UPDATE ON worker_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 