# tests/test_terminal.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.tools.terminal import TerminalResult, run_command


def test_terminal_result_fields():
    r = TerminalResult(stdout="out", stderr="err", returncode=0)
    assert r.stdout == "out"
    assert r.stderr == "err"
    assert r.returncode == 0


@pytest.mark.asyncio
async def test_run_command_success():
    mock_proc = MagicMock()
    mock_proc.communicate = AsyncMock(return_value=(b"hello\n", b""))
    mock_proc.returncode = 0

    with patch("backend.tools.terminal.asyncio.create_subprocess_shell",
               new_callable=AsyncMock, return_value=mock_proc):
        result = await run_command("echo hello")

    assert result.stdout == "hello\n"
    assert result.stderr == ""
    assert result.returncode == 0


@pytest.mark.asyncio
async def test_run_command_nonzero_exit():
    mock_proc = MagicMock()
    mock_proc.communicate = AsyncMock(return_value=(b"", b"not found\n"))
    mock_proc.returncode = 127

    with patch("backend.tools.terminal.asyncio.create_subprocess_shell",
               new_callable=AsyncMock, return_value=mock_proc):
        result = await run_command("bogus_cmd")

    assert result.returncode == 127
    assert "not found" in result.stderr


@pytest.mark.asyncio
async def test_run_command_timeout_kills_process():
    import asyncio

    mock_proc = MagicMock()
    mock_proc.kill = MagicMock()
    mock_proc.communicate = AsyncMock(return_value=(b"", b""))  # called after kill to drain
    mock_proc.returncode = None

    with patch("backend.tools.terminal.asyncio.create_subprocess_shell",
               new_callable=AsyncMock, return_value=mock_proc), \
         patch("backend.tools.terminal.asyncio.wait_for",
               new_callable=AsyncMock, side_effect=asyncio.TimeoutError()):
        result = await run_command("sleep 100", timeout=0.001)

    assert result.returncode == -1
    assert "timed out" in result.stderr.lower()
    mock_proc.kill.assert_called_once()
    mock_proc.communicate.assert_called()  # verify drain after kill
