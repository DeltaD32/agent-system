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
