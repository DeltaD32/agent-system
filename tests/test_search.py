# tests/test_search.py
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from backend.tools.search import SearchResult, SearXNGClient, discover_searxng, _probe

def test_search_result_fields():
    r = SearchResult(title="T", url="http://x.com", snippet="S")
    assert r.title == "T"
    assert r.url == "http://x.com"
    assert r.snippet == "S"

@pytest.mark.asyncio
async def test_searxng_client_search_success():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "results": [
            {"title": "Result A", "url": "http://a.com", "content": "Snippet A"},
            {"title": "Result B", "url": "http://b.com", "content": "Snippet B"},
        ]
    }
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("backend.tools.search.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        client = SearXNGClient("http://localhost:8080")
        results = await client.search("python asyncio")

    assert len(results) == 2
    assert isinstance(results[0], SearchResult)
    assert results[0].title == "Result A"
    assert results[0].url == "http://a.com"
    assert results[0].snippet == "Snippet A"

@pytest.mark.asyncio
async def test_searxng_client_search_http_error_raises():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(
        side_effect=httpx.ConnectError("refused")
    )
    with patch("backend.tools.search.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        client = SearXNGClient("http://localhost:8080")
        with pytest.raises(RuntimeError, match="SearXNG search failed"):
            await client.search("test")

@pytest.mark.asyncio
async def test_probe_returns_true_on_200():
    mock_resp = MagicMock(status_code=200)
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    with patch("backend.tools.search.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        assert await _probe("http://localhost:8080") is True

@pytest.mark.asyncio
async def test_probe_returns_false_on_connection_error():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=Exception("refused"))
    with patch("backend.tools.search.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        assert await _probe("http://localhost:8080") is False

@pytest.mark.asyncio
async def test_discover_searxng_returns_url_when_localhost_reachable():
    with patch("backend.tools.search._probe", new_callable=AsyncMock, return_value=True):
        url = await discover_searxng()
    assert url == "http://localhost:8080"

@pytest.mark.asyncio
async def test_discover_searxng_falls_through_to_docker_gateway():
    probe_calls = []
    async def fake_probe(url):
        probe_calls.append(url)
        return url == "http://172.17.0.1:8080"
    with patch("backend.tools.search._probe", side_effect=fake_probe), \
         patch("backend.tools.search._spawn_searxng", new_callable=AsyncMock, return_value=None):
        url = await discover_searxng()
    assert url == "http://172.17.0.1:8080"
    assert "http://localhost:8080" in probe_calls

@pytest.mark.asyncio
async def test_discover_searxng_returns_none_when_all_fail():
    with patch("backend.tools.search._probe", new_callable=AsyncMock, return_value=False), \
         patch("backend.tools.search._spawn_searxng", new_callable=AsyncMock, return_value=None):
        url = await discover_searxng()
    assert url is None
