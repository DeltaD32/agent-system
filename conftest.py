"""
Root conftest.py — makes vault-init importable as vault_init.
Python cannot import directories with hyphens in their names, so we load
the package explicitly and register it under the underscore alias.
"""
import sys
import importlib.util
from pathlib import Path

_project_root = Path(__file__).parent
_vault_init_dir = _project_root / "vault-init"

# Register the vault-init package under the Python-friendly name vault_init
if "vault_init" not in sys.modules:
    spec = importlib.util.spec_from_file_location(
        "vault_init",
        _vault_init_dir / "__init__.py",
        submodule_search_locations=[str(_vault_init_dir)],
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["vault_init"] = module
    spec.loader.exec_module(module)
