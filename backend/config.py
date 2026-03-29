from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", frozen=False)

    ollama_local: str = "http://localhost:11434"
    ollama_remotes: list[str] = []
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    local_model: str = "llama3"
    vault_path: Path = Path.home() / "Documents" / "AgentVault"
    redis_url: str = "redis://localhost:6379"
    db_path: str = "./agent-office.db"
    max_concurrent_agents: int = 6
    playwright_headful: bool = False
    searxng_url: Optional[str] = None   # set from .env or auto-discovered at startup

    ollama_remote_1: Optional[str] = None
    ollama_remote_2: Optional[str] = None
    ollama_remote_3: Optional[str] = None
    ollama_remote_4: Optional[str] = None

    def model_post_init(self, _context) -> None:
        remotes = [
            self.ollama_remote_1,
            self.ollama_remote_2,
            self.ollama_remote_3,
            self.ollama_remote_4,
        ]
        self.ollama_remotes = [r for r in remotes if r]

settings = Settings()
