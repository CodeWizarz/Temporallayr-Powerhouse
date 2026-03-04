"""Async HTTP transport with retry."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class HTTPTransport:
    """Async HTTP transport with exponential backoff and retries."""

    def __init__(
        self,
        server_url: str,
        api_key: str | None,
        max_retries: int = 3,
        base_backoff: float = 0.5,
        timeout: float = 10.0,
    ) -> None:
        self.server_url = server_url.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"
        self.max_retries = max_retries
        self.base_backoff = base_backoff
        self._client = httpx.AsyncClient(timeout=timeout)

    async def send_batch(self, batch: list[dict[str, Any]]) -> bool:
        """Send batch to ingest endpoint with retries and timeout."""
        if not batch:
            return True

        payload = {"events": batch}
        for attempt in range(self.max_retries + 1):
            try:
                response = await self._client.post(
                    f"{self.server_url}/v1/ingest",
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                return True
            except httpx.TimeoutException as e:
                logger.warning("Transport timeout on attempt %d: %s", attempt + 1, e)
            except Exception as e:
                logger.warning("Transport error on attempt %d: %s", attempt + 1, e)

            if attempt < self.max_retries:
                # Exponential backoff
                await asyncio.sleep(self.base_backoff * (2**attempt))

        logger.error("Failed to send batch after %d retries", self.max_retries)
        return False

    async def shutdown(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
