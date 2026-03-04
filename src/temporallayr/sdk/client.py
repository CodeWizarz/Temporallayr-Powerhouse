"""SDK client entry point using the new batching transport."""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine

from temporallayr.config import TemporalLayrConfig, resolve_config
from temporallayr.sdk.batching import SpanBatcher
from temporallayr.sdk.transport import HTTPTransport


class TemporalLayrSDK:
    def __init__(self, config: TemporalLayrConfig) -> None:
        if not config.tenant_id:
            raise ValueError("tenant_id is required")
        self.config = config

        # Setup modern SDK transport stack
        http_layer = HTTPTransport(
            server_url=config.server_url,
            api_key=config.api_key,
        )
        self.batcher = SpanBatcher(
            transport=http_layer,
            batch_size=50,
            flush_interval=5.0,
        )
        self._started = False

    async def start(self) -> None:
        """Initialize background transport."""
        if not self._started:
            self.batcher.start()
            self._started = True

    async def shutdown(self) -> None:
        """Flush pending events and kill transport."""
        if self._started:
            await self.batcher.shutdown()
            if hasattr(self.batcher.transport, "shutdown"):
                await self.batcher.transport.shutdown()
            self._started = False


# Global state
_sdk: TemporalLayrSDK | None = None
_background_tasks: set[asyncio.Task[None]] = set()


def _schedule(coro: Coroutine[object, object, None]) -> None:
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(coro)
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
    except RuntimeError:
        asyncio.run(coro)


def init(**kwargs: object) -> TemporalLayrSDK:
    """Initialize the SDK globally."""
    global _sdk
    explicit = kwargs.pop("explicit", None)
    config = resolve_config(
        explicit=explicit if isinstance(explicit, TemporalLayrConfig) else None, **kwargs
    )
    _sdk = TemporalLayrSDK(config)
    _schedule(_sdk.start())
    return _sdk


def get_sdk() -> TemporalLayrSDK | None:
    """Retrieve the global SDK instance."""
    return _sdk


def shutdown() -> None:
    """Shutdown the SDK globally."""
    if _sdk is None:
        return
    _schedule(_sdk.shutdown())
