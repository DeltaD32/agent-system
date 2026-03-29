from enum import Enum
from typing import TypedDict


class RoleConfig(TypedDict):
    display_name: str
    color: str
    default_llm: str


class AgentRole(str, Enum):
    PROJECT_MANAGER          = "project_manager"
    CODER                    = "coder"
    RESEARCHER               = "researcher"
    WRITER                   = "writer"
    SYSADMIN                 = "sysadmin"
    ANALYST                  = "analyst"
    ARCHIVIST                = "archivist"
    REVIEWER                 = "reviewer"
    GRAPHIC_DESIGNER         = "graphic_designer"
    MARKETING_SPECIALIST     = "marketing_specialist"
    DOCUMENTATION_SPECIALIST = "documentation_specialist"

ROLE_CONFIG: dict[AgentRole, RoleConfig] = {
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
    """Return vault subfolder name for a role (kebab-case)."""
    return role.value.replace("_", "-")

def role_color(role: AgentRole) -> str:
    """Return the hex color string for a role."""
    return ROLE_CONFIG[role]["color"]

def role_default_llm(role: AgentRole) -> str:
    """Return the default LLM backend key for a role (e.g. 'local_ollama', 'claude_api')."""
    return ROLE_CONFIG[role]["default_llm"]
