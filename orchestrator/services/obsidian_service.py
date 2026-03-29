"""
Obsidian Vault Service

Provides read/write access to a local Obsidian vault (a directory of
Markdown files with YAML front-matter).

The vault path is configured via the OBSIDIAN_VAULT_PATH environment
variable, which is bind-mounted into the container at runtime.
On all platforms the host path is set in .env:

  Linux / Mac : OBSIDIAN_VAULT_PATH=/home/user/Documents/MyVault
  Windows     : OBSIDIAN_VAULT_PATH=C:/Users/You/Documents/MyVault

Inside the container the vault is always mounted at /vault.
"""

import os
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiofiles
import aiofiles.os

logger = logging.getLogger(__name__)

# Inside the container the vault is always at /vault (see docker-compose)
VAULT_ROOT = Path(os.environ.get("VAULT_MOUNT", "/vault"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _note_path(relative: str) -> Path:
    """Resolve a relative note path safely inside VAULT_ROOT."""
    # Normalise: ensure .md extension
    if not relative.endswith(".md"):
        relative += ".md"
    # Prevent path traversal
    resolved = (VAULT_ROOT / relative).resolve()
    if not str(resolved).startswith(str(VAULT_ROOT.resolve())):
        raise ValueError(f"Path traversal attempt: {relative}")
    return resolved


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Split YAML front-matter from body. Returns (meta, body)."""
    meta: dict = {}
    body = content
    if content.startswith("---"):
        end = content.find("\n---", 3)
        if end != -1:
            fm_block = content[3:end].strip()
            body = content[end + 4:].lstrip("\n")
            for line in fm_block.splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()
    return meta, body


def _build_frontmatter(meta: dict) -> str:
    if not meta:
        return ""
    lines = ["---"]
    for k, v in meta.items():
        lines.append(f"{k}: {v}")
    lines.append("---\n")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def list_notes(folder: str = "") -> list[dict]:
    """Return all .md files under folder (relative to vault root)."""
    search_root = VAULT_ROOT / folder if folder else VAULT_ROOT
    notes = []
    try:
        for path in search_root.rglob("*.md"):
            rel = path.relative_to(VAULT_ROOT)
            stat = path.stat()
            notes.append({
                "path": str(rel),
                "name": path.stem,
                "folder": str(rel.parent) if rel.parent != Path(".") else "",
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
            })
    except FileNotFoundError:
        logger.warning(f"Vault root not found: {search_root}")
    return sorted(notes, key=lambda n: n["modified"], reverse=True)


async def read_note(relative_path: str) -> Optional[dict]:
    """Read a note and return {path, meta, body, content}."""
    try:
        path = _note_path(relative_path)
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            content = await f.read()
        meta, body = _parse_frontmatter(content)
        return {
            "path": relative_path,
            "meta": meta,
            "body": body,
            "content": content,
        }
    except FileNotFoundError:
        return None
    except Exception as e:
        logger.error(f"Error reading note {relative_path}: {e}")
        raise


async def write_note(
    relative_path: str,
    body: str,
    meta: Optional[dict] = None,
    overwrite: bool = True,
) -> dict:
    """Write (or create) a note. Auto-stamps updated_at in front-matter."""
    path = _note_path(relative_path)

    # Merge existing meta if not overwriting
    existing_meta: dict = {}
    if path.exists() and not overwrite:
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            existing = await f.read()
        existing_meta, _ = _parse_frontmatter(existing)

    merged_meta = {**existing_meta, **(meta or {})}
    merged_meta["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if "created" not in merged_meta:
        merged_meta["created"] = merged_meta["updated"]

    content = _build_frontmatter(merged_meta) + body

    # Ensure parent directory exists
    await aiofiles.os.makedirs(str(path.parent), exist_ok=True)

    async with aiofiles.open(path, "w", encoding="utf-8") as f:
        await f.write(content)

    logger.info(f"Wrote note: {relative_path}")
    return {"path": relative_path, "meta": merged_meta, "bytes": len(content)}


async def append_to_note(relative_path: str, text: str) -> dict:
    """Append text to an existing note (creates it if absent)."""
    existing = await read_note(relative_path)
    if existing:
        new_body = existing["body"].rstrip("\n") + "\n\n" + text
        return await write_note(relative_path, new_body, existing["meta"])
    return await write_note(relative_path, text)


async def search_vault(query: str, folder: str = "") -> list[dict]:
    """Full-text search across all notes. Returns list of {path, snippet}."""
    results = []
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    notes = await list_notes(folder)
    for note_meta in notes:
        note = await read_note(note_meta["path"])
        if note and pattern.search(note["content"]):
            # Extract a short snippet around the first match
            m = pattern.search(note["content"])
            start = max(0, m.start() - 80)
            end = min(len(note["content"]), m.end() + 80)
            snippet = "..." + note["content"][start:end] + "..."
            results.append({"path": note_meta["path"], "snippet": snippet})
    return results


async def delete_note(relative_path: str) -> bool:
    """Delete a note. Returns True if deleted, False if not found."""
    try:
        path = _note_path(relative_path)
        path.unlink()
        logger.info(f"Deleted note: {relative_path}")
        return True
    except FileNotFoundError:
        return False


async def log_agent_activity(agent_name: str, activity: str,
                               project: str = "General") -> None:
    """Append an agent activity entry to the project's activity log note."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    entry = f"- [{timestamp}] **{agent_name}**: {activity}"
    note_path = f"Projects/{project}/activity_log"
    await append_to_note(note_path, entry)
