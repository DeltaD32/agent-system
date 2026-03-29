"""
SearXNG search client + auto-discovery.

Discovery order:
  1. localhost:8080
  2. 172.17.0.1:8080 (Docker bridge gateway)
  3. Spawn a searxng/searxng container via Docker SDK
  4. Return None if all fail
"""
import asyncio
import logging
from dataclasses import dataclass
import httpx

logger = logging.getLogger(__name__)

PROBE_URLS = [
    "http://localhost:8080",
    "http://172.17.0.1:8080",
]


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


class SearXNGClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def search(self, query: str, num_results: int = 10) -> list[SearchResult]:
        """Search SearXNG. Raises RuntimeError on failure."""
        params = {"q": query, "format": "json", "pageno": 1}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{self.base_url}/search", params=params)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"SearXNG search failed: {exc}") from exc
        except Exception as exc:
            raise RuntimeError(f"SearXNG search failed: {exc}") from exc
        return [
            SearchResult(
                title=r.get("title", ""),
                url=r.get("url", ""),
                snippet=r.get("content", ""),
            )
            for r in data.get("results", [])[:num_results]
        ]


async def _probe(url: str) -> bool:
    """Return True if SearXNG at url is reachable."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{url}/search", params={"q": "test", "format": "json"})
            return resp.status_code == 200
    except Exception:
        return False


async def _spawn_searxng() -> str | None:
    """Try to spawn a SearXNG container via Docker SDK. Returns URL or None."""
    try:
        import docker  # optional dependency
        client = docker.from_env()
        # Check if already running
        for container in client.containers.list():
            tags = container.image.tags
            if tags and "searxng/searxng" in tags[0]:
                ports = container.ports.get("8080/tcp")
                if ports:
                    host_port = ports[0]["HostPort"]
                    url = f"http://localhost:{host_port}"
                    if await _probe(url):
                        logger.info(f"Found existing SearXNG container at {url}")
                        client.close()
                        return url
        # Spawn new container
        logger.info("Spawning SearXNG container...")
        container = client.containers.run(
            "searxng/searxng:latest",
            detach=True,
            ports={"8080/tcp": 8080},
            remove=True,
        )
        # Wait up to 30s for it to be ready
        for _ in range(30):
            await asyncio.sleep(1)
            if await _probe("http://localhost:8080"):
                logger.info("SearXNG container ready at http://localhost:8080")
                client.close()
                return "http://localhost:8080"
        logger.warning("SearXNG container spawned but did not become ready in time")
        try:
            container.stop(timeout=5)
        except Exception:
            pass
        client.close()
        return None
    except ImportError:
        logger.warning("docker package not installed — cannot auto-spawn SearXNG")
        return None
    except Exception as exc:
        logger.warning(f"Could not spawn SearXNG container: {exc}")
        return None


async def discover_searxng() -> str | None:
    """Probe known URLs then spawn. Returns base URL or None."""
    for url in PROBE_URLS:
        if await _probe(url):
            logger.info(f"Found SearXNG at {url}")
            return url
    return await _spawn_searxng()
