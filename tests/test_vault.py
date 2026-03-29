import pytest
import pytest_asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from vault_init.setup import scaffold_vault, ROLE_INSTRUCTIONS
from backend.agents.roles import AgentRole

def test_scaffold_creates_all_folders(tmp_path):
    scaffold_vault(tmp_path)
    assert (tmp_path / "shared").exists()
    assert (tmp_path / "shared" / "research").exists()
    assert (tmp_path / "instructions").exists()
    assert (tmp_path / "agents").exists()
    assert (tmp_path / "system").exists()

def test_scaffold_creates_instruction_files(tmp_path):
    scaffold_vault(tmp_path)
    assert (tmp_path / "instructions" / "coder.md").exists()
    assert (tmp_path / "instructions" / "project-manager.md").exists()
    assert (tmp_path / "instructions" / "reviewer.md").exists()
    assert (tmp_path / "instructions" / "graphic-designer.md").exists()
    assert (tmp_path / "instructions" / "marketing-specialist.md").exists()
    assert (tmp_path / "instructions" / "documentation-specialist.md").exists()

def test_instruction_files_have_guardrails(tmp_path):
    scaffold_vault(tmp_path)
    content = (tmp_path / "instructions" / "coder.md").read_text()
    assert "NEVER impersonate" in content
    assert "Permitted Tools" in content or "permitted tools" in content.lower()

def test_scaffold_does_not_overwrite_existing(tmp_path):
    scaffold_vault(tmp_path)
    existing = tmp_path / "instructions" / "coder.md"
    existing.write_text("custom content")
    scaffold_vault(tmp_path)  # second run must not overwrite
    assert existing.read_text() == "custom content"

def test_all_agent_folders_created(tmp_path):
    scaffold_vault(tmp_path)
    expected = [
        "project-manager", "coder", "researcher", "writer", "sysadmin",
        "analyst", "archivist", "reviewer", "graphic-designer",
        "marketing-specialist", "documentation-specialist",
    ]
    for slug in expected:
        assert (tmp_path / "agents" / slug).exists(), f"Missing agents/{slug}/"
        assert (tmp_path / "agents" / slug / "context.md").exists()
        assert (tmp_path / "agents" / slug / "session-log.md").exists()

def test_coder_has_extra_files(tmp_path):
    scaffold_vault(tmp_path)
    assert (tmp_path / "agents" / "coder" / "snippets.md").exists()
    assert (tmp_path / "agents" / "coder" / "toolchain.md").exists()

def test_role_instructions_covers_all_11_roles(tmp_path):
    scaffold_vault(tmp_path)
    expected_slugs = [
        "project-manager", "coder", "researcher", "writer", "sysadmin",
        "analyst", "archivist", "reviewer", "graphic-designer",
        "marketing-specialist", "documentation-specialist",
    ]
    for slug in expected_slugs:
        path = tmp_path / "instructions" / f"{slug}.md"
        assert path.exists(), f"Missing instructions/{slug}.md"
        content = path.read_text()
        assert len(content) > 200, f"instructions/{slug}.md seems too short"

from backend.memory.vault import VaultManager

@pytest_asyncio.fixture
async def vault(tmp_path):
    from vault_init.setup import scaffold_vault
    scaffold_vault(tmp_path)
    return VaultManager(tmp_path)

@pytest.mark.asyncio
async def test_coder_can_write_own_folder(vault):
    await vault.write(AgentRole.CODER, "agents/coder/context.md", "# Context\ntest")
    content = await vault.read(AgentRole.CODER, "agents/coder/context.md")
    assert "test" in content

@pytest.mark.asyncio
async def test_coder_cannot_write_others_folder(vault):
    with pytest.raises(PermissionError):
        await vault.write(AgentRole.CODER, "agents/researcher/context.md", "hacked")

@pytest.mark.asyncio
async def test_coder_cannot_read_others_folder(vault):
    with pytest.raises(PermissionError):
        await vault.read(AgentRole.CODER, "agents/researcher/context.md")

@pytest.mark.asyncio
async def test_reviewer_can_read_coder_folder(vault):
    await vault.write(AgentRole.CODER, "agents/coder/context.md", "coder context")
    content = await vault.read(AgentRole.REVIEWER, "agents/coder/context.md")
    assert "coder context" in content

@pytest.mark.asyncio
async def test_search_shared(vault):
    await vault.write(AgentRole.CODER, "shared/glossary.md", "# Glossary\nFastAPI: web framework")
    results = await vault.search(AgentRole.CODER, "FastAPI")
    assert len(results) > 0
    assert any("FastAPI" in r["content"] for r in results)
