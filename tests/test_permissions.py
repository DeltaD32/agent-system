import pytest
from backend.agents.roles import AgentRole
from backend.memory.permissions import can_read, can_write, VaultPath

def test_all_agents_can_read_shared():
    for role in AgentRole:
        assert can_read(role, VaultPath.SHARED)

def test_all_agents_can_write_shared():
    for role in AgentRole:
        assert can_write(role, VaultPath.SHARED)

def test_agents_cannot_read_others_private():
    assert not can_read(AgentRole.CODER, VaultPath.AGENTS_OTHER)
    assert not can_read(AgentRole.WRITER, VaultPath.AGENTS_OTHER)

def test_pm_can_read_others_private():
    assert can_read(AgentRole.PROJECT_MANAGER, VaultPath.AGENTS_OTHER)

def test_archivist_can_read_others_private():
    assert can_read(AgentRole.ARCHIVIST, VaultPath.AGENTS_OTHER)

def test_reviewer_can_read_others_private():
    assert can_read(AgentRole.REVIEWER, VaultPath.AGENTS_OTHER)

def test_reviewer_cannot_write_system():
    assert not can_write(AgentRole.REVIEWER, VaultPath.SYSTEM)

def test_pm_can_write_system():
    assert can_write(AgentRole.PROJECT_MANAGER, VaultPath.SYSTEM)
