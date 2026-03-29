"""
Playwright browser wrapper — fetches pages, extracts text, saves screenshots.
"""
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)


@dataclass
class BrowseResult:
    url: str
    title: str
    text: str
    screenshot_path: str | None = None


async def browse(
    url: str,
    vault_root: Path | None = None,
    headful: bool = False,
    timeout_ms: int = 30_000,
) -> BrowseResult:
    """
    Fetch a page with Playwright, return title + body text.
    If vault_root is provided, saves a screenshot to shared/research/.
    Raises RuntimeError on navigation failure.
    """
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=not headful)
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            title = await page.title()
            text = await page.inner_text("body")

            screenshot_path: str | None = None
            if vault_root is not None:
                ts = datetime.now().strftime("%Y%m%d-%H%M%S")
                slug = re.sub(r"[^\w]", "-", url[:50]).strip("-")
                dest = vault_root / "shared" / "research" / f"{ts}-{slug}.png"
                dest.parent.mkdir(parents=True, exist_ok=True)
                await page.screenshot(path=str(dest))
                screenshot_path = str(dest)

            await browser.close()

    except Exception as exc:
        raise RuntimeError(f"Browse failed for {url}: {exc}") from exc

    return BrowseResult(
        url=url,
        title=title,
        text=text[:5000],  # cap at 5000 chars to keep prompts manageable
        screenshot_path=screenshot_path,
    )
