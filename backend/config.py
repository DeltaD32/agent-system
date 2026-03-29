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
