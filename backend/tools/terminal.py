"""
Terminal executor — runs shell commands asynchronously with timeout.
"""
import asyncio
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TerminalResult:
    stdout: str
    stderr: str
    returncode: int


async def run_command(cmd: str, timeout: float = 30.0) -> TerminalResult:
    """
    Run a shell command and return stdout/stderr/returncode.
    Kills the process and returns returncode=-1 if timeout is exceeded.
    """
    proc = await asyncio.create_subprocess_shell(
        cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()   # drain pipes and reap zombie
        return TerminalResult(
            stdout="",
            stderr=f"Command timed out after {timeout}s",
            returncode=-1,
        )
    return TerminalResult(
        stdout=stdout_bytes.decode(errors="replace"),
        stderr=stderr_bytes.decode(errors="replace"),
        returncode=proc.returncode if proc.returncode is not None else 0,
    )
