from dataclasses import dataclass

@dataclass
class LLMResponse:
    text: str
    backend: str          # "local_ollama" | "remote_ollama_1" | "claude_api" etc.
    model: str
    tokens_used: int = 0
