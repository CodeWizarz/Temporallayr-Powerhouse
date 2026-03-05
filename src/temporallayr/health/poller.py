import asyncio
import logging
from collections.abc import Awaitable, Callable

from temporallayr.health.store import get_health_store

logger = logging.getLogger(__name__)


class HealthPoller:
    """Background worker to periodically poll internal service health."""

    def __init__(self, interval_seconds: int = 60):
        self.interval_seconds = interval_seconds
        self._task: asyncio.Task | None = None
        self._checks: dict[str, Callable[[], Awaitable[bool]]] = {}
        self.running = False

    def register_check(self, service_name: str, check_func: Callable[[], Awaitable[bool]]) -> None:
        """Register an async function that returns True if healthy."""
        self._checks[service_name] = check_func

    def start(self) -> None:
        """Start the background polling task."""
        if self._task is not None or self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("Health poller started, interval=%ds", self.interval_seconds)

    def stop(self) -> None:
        """Stop the background polling task."""
        self.running = False
        if self._task is not None:
            self._task.cancel()
            self._task = None

    async def _poll_loop(self) -> None:
        store = get_health_store()
        while self.running:
            try:
                # Run compaction daily, but we can just run it every poll to keep it simple and cheap
                store.compact(days=30)

                # Check all services
                for service, check_func in self._checks.items():
                    try:
                        is_healthy = await check_func()
                        status = "up" if is_healthy else "down"
                        store.record_health(service, status)
                    except Exception as e:
                        store.record_health(service, "down", error=str(e))

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Health poller loop error: %s", str(e))

            await asyncio.sleep(self.interval_seconds)


# Global poller instance
_poller = None


def get_health_poller() -> HealthPoller:
    global _poller
    if _poller is None:
        _poller = HealthPoller(interval_seconds=60)
    return _poller
