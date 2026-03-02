"""SDK lifecycle management."""

from __future__ import annotations

import asyncio
from collections.abc import Coroutine

from temporallayr.config import TemporalLayrConfig, resolve_config
from temporallayr.core.transport_http import AsyncHTTPTransport


class TemporalLayrSDK:
    def __init__(self, config: TemporalLayrConfig) -> None:
        if not config.tenant_id:
            raise ValueError("tenant_id is required")
        self.config = config
        self.transport = AsyncHTTPTransport(
            server_url=config.server_url,
            api_key=config.api_key,
            flush_interval=config.flush_interval,
            batch_size=config.batch_size,
            max_queue_size=config.max_queue_size,
        )
        self._started = False

    async def start(self) -> None:
        if not self._started:
            await self.transport.start()
            self._started = True

    async def shutdown(self) -> None:
        if self._started:
            await self.transport.shutdown()
            self._started = False


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
    global _sdk
    explicit = kwargs.pop("explicit", None)
    config = resolve_config(
        explicit=explicit if isinstance(explicit, TemporalLayrConfig) else None, **kwargs
    )
    _sdk = TemporalLayrSDK(config)
    _schedule(_sdk.start())
    return _sdk


def get_sdk() -> TemporalLayrSDK | None:
    return _sdk


def shutdown() -> None:
    if _sdk is None:
        return
    _schedule(_sdk.shutdown())
