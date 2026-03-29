# tests/test_browser.py
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from backend.tools.browser import BrowseResult, browse


def test_browse_result_fields():
    r = BrowseResult(url="http://x.com", title="X", text="content")
    assert r.url == "http://x.com"
    assert r.screenshot_path is None


@pytest.mark.asyncio
async def test_browse_returns_result():
    mock_page = AsyncMock()
    mock_page.goto = AsyncMock()
    mock_page.title = AsyncMock(return_value="Test Page")
    mock_page.inner_text = AsyncMock(return_value="Page body content here")
    mock_page.screenshot = AsyncMock()

    mock_browser = AsyncMock()
    mock_browser.new_page = AsyncMock(return_value=mock_page)
    mock_browser.close = AsyncMock()

    mock_chromium = AsyncMock()
    mock_chromium.launch = AsyncMock(return_value=mock_browser)

    mock_playwright = MagicMock()
    mock_playwright.chromium = mock_chromium
    mock_playwright.__aenter__ = AsyncMock(return_value=mock_playwright)
    mock_playwright.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.tools.browser.async_playwright", return_value=mock_playwright):
        result = await browse("http://example.com")

    assert isinstance(result, BrowseResult)
    assert result.url == "http://example.com"
    assert result.title == "Test Page"
    assert "Page body content" in result.text
    assert result.screenshot_path is None


@pytest.mark.asyncio
async def test_browse_saves_screenshot_when_vault_root_given(tmp_path):
    mock_page = AsyncMock()
    mock_page.goto = AsyncMock()
    mock_page.title = AsyncMock(return_value="Title")
    mock_page.inner_text = AsyncMock(return_value="body text")
    mock_page.screenshot = AsyncMock()

    mock_browser = AsyncMock()
    mock_browser.new_page = AsyncMock(return_value=mock_page)
    mock_browser.close = AsyncMock()

    mock_chromium = AsyncMock()
    mock_chromium.launch = AsyncMock(return_value=mock_browser)

    mock_playwright = MagicMock()
    mock_playwright.chromium = mock_chromium
    mock_playwright.__aenter__ = AsyncMock(return_value=mock_playwright)
    mock_playwright.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.tools.browser.async_playwright", return_value=mock_playwright):
        result = await browse("http://example.com", vault_root=tmp_path)

    assert result.screenshot_path is not None
    assert "shared/research" in result.screenshot_path
    mock_page.screenshot.assert_called_once()


@pytest.mark.asyncio
async def test_browse_raises_on_navigation_error():
    mock_page = AsyncMock()
    mock_page.goto = AsyncMock(side_effect=Exception("Navigation failed"))

    mock_browser = AsyncMock()
    mock_browser.new_page = AsyncMock(return_value=mock_page)
    mock_browser.close = AsyncMock()

    mock_chromium = AsyncMock()
    mock_chromium.launch = AsyncMock(return_value=mock_browser)

    mock_playwright = MagicMock()
    mock_playwright.chromium = mock_chromium
    mock_playwright.__aenter__ = AsyncMock(return_value=mock_playwright)
    mock_playwright.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.tools.browser.async_playwright", return_value=mock_playwright):
        with pytest.raises(RuntimeError, match="Browse failed"):
            await browse("http://example.com")

    mock_browser.close.assert_called_once()
