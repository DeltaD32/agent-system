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
