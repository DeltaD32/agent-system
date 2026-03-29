from backend.agents.roles import AgentRole, ROLE_CONFIG, role_vault_folder

def test_all_roles_have_config():
    for role in AgentRole:
        cfg = ROLE_CONFIG[role]
        assert "color" in cfg
        assert "default_llm" in cfg
        assert "display_name" in cfg

def test_pm_defaults_to_claude():
    assert ROLE_CONFIG[AgentRole.PROJECT_MANAGER]["default_llm"] == "claude_api"

def test_archivist_defaults_to_local():
    assert ROLE_CONFIG[AgentRole.ARCHIVIST]["default_llm"] == "local_ollama"

def test_role_slug_matches_vault_folder():
    assert role_vault_folder(AgentRole.CODER) == "coder"
    assert role_vault_folder(AgentRole.PROJECT_MANAGER) == "project-manager"
    assert role_vault_folder(AgentRole.GRAPHIC_DESIGNER) == "graphic-designer"
    assert role_vault_folder(AgentRole.MARKETING_SPECIALIST) == "marketing-specialist"
    assert role_vault_folder(AgentRole.DOCUMENTATION_SPECIALIST) == "documentation-specialist"
