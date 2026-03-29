"""
ToolKit — bundles search, browser, and terminal tools for agent use.
Role-based permission map controls which tools each role may call.
"""
from dataclasses import dataclass
from typing import Callable, Awaitable
from backend.agents.roles import AgentRole

# Tools allowed per role (subset of: search, browse, terminal)
ROLE_TOOLS: dict[AgentRole, set[str]] = {
    AgentRole.PROJECT_MANAGER:          {"search"},
    AgentRole.CODER:                    {"terminal", "browse"},
    AgentRole.RESEARCHER:               {"search", "browse"},
    AgentRole.WRITER:                   {"search"},
    AgentRole.SYSADMIN:                 {"search", "browse", "terminal"},
    AgentRole.ANALYST:                  {"search", "browse"},
    AgentRole.ARCHIVIST:                {"search"},
    AgentRole.REVIEWER:                 {"search", "browse"},
    AgentRole.GRAPHIC_DESIGNER:         {"search", "browse"},
    AgentRole.MARKETING_SPECIALIST:     {"search"},
    AgentRole.DOCUMENTATION_SPECIALIST: {"search", "browse"},
}


@dataclass
class ToolKit:
    """Container for the three callable tools. Pass None to disable a tool."""
    search:   Callable[..., Awaitable] | None = None
    browse:   Callable[..., Awaitable] | None = None
    terminal: Callable[..., Awaitable] | None = None

    def allowed_for(self, role: AgentRole) -> set[str]:
        """Return names of tools that both exist in this kit and are permitted for role."""
        permitted = ROLE_TOOLS.get(role, set())
        available = {
            name for name in ("search", "browse", "terminal")
            if getattr(self, name) is not None
        }
        return permitted & available
