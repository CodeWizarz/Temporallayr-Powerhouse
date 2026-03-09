"""
Resilience patterns: Circuit Breaker and Retry Logic.

Based on patterns from ClickHouse and industry best practices.
"""

import asyncio
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, TypeVar

import httpx

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    success_threshold: int = 2
    timeout_seconds: float = 30.0
    half_open_max_calls: int = 3


@dataclass
class CircuitBreaker:
    name: str
    config: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _failure_count: int = field(default=0, init=False)
    _success_count: int = field(default=0, init=False)
    _last_failure_time: float = field(default=0, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    @property
    def state(self) -> CircuitState:
        return self._state

    def is_available(self) -> bool:
        if self._state == CircuitState.CLOSED:
            return True
        if self._state == CircuitState.OPEN:
            if time.time() - self._last_failure_time >= self.config.timeout_seconds:
                return True
            return False
        return True

    async def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        async with self._lock:
            if not self.is_available():
                raise CircuitBreakerOpenError(f"Circuit breaker '{self.name}' is OPEN")

            if self._state == CircuitState.OPEN:
                self._state = CircuitState.HALF_OPEN
                logger.info(f"Circuit breaker '{self.name}' transitioning to HALF_OPEN")

        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure()
            raise e

    async def _on_success(self) -> None:
        async with self._lock:
            self._failure_count = 0
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.config.success_threshold:
                    self._state = CircuitState.CLOSED
                    self._success_count = 0
                    logger.info(f"Circuit breaker '{self.name}' CLOSED")

    async def _on_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                logger.warning(f"Circuit breaker '{self.name}' OPEN after half-open failure")
            elif self._failure_count >= self.config.failure_threshold:
                self._state = CircuitState.OPEN
                logger.warning(
                    f"Circuit breaker '{self.name}' OPEN after {self._failure_count} failures"
                )


class CircuitBreakerOpenError(Exception):
    pass


@dataclass
class RetryConfig:
    max_attempts: int = 3
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 30.0
    exponential_base: float = 2.0
    jitter: bool = True


async def retry_with_backoff(
    func: Callable[..., T],
    config: RetryConfig | None = None,
    *args: Any,
    **kwargs: Any,
) -> T:
    """Retry a function with exponential backoff."""
    if config is None:
        config = RetryConfig()

    last_exception: Exception | None = None

    for attempt in range(config.max_attempts):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        except Exception as e:
            last_exception = e

            if attempt == config.max_attempts - 1:
                break

            delay = min(
                config.base_delay_seconds * (config.exponential_base**attempt),
                config.max_delay_seconds,
            )

            if config.jitter:
                import random

                delay = delay * (0.5 + random.random())

            logger.warning(
                f"Retry attempt {attempt + 1}/{config.max_attempts} failed: {e}. "
                f"Retrying in {delay:.2f}s..."
            )
            await asyncio.sleep(delay)

    raise last_exception


class ResilientHttpClient:
    """HTTP client with circuit breaker and retry logic."""

    def __init__(
        self,
        base_url: str = "",
        timeout: float = 30.0,
        circuit_breaker_config: CircuitBreakerConfig | None = None,
        retry_config: RetryConfig | None = None,
    ):
        self.base_url = base_url
        self.timeout = timeout
        self.circuit_breaker = CircuitBreaker(
            name="http_client",
            config=circuit_breaker_config or CircuitBreakerConfig(),
        )
        self.retry_config = retry_config or RetryConfig()
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "ResilientHttpClient":
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
        )
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self._client:
            await self._client.aclose()

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        async def _get():
            return await self._client.get(url, **kwargs)  # type: ignore

        return await self.circuit_breaker.call(retry_with_backoff, self.retry_config, _get)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        async def _post():
            return await self._client.post(url, **kwargs)  # type: ignore

        return await self.circuit_breaker.call(retry_with_backoff, self.retry_config, _post)

    async def put(self, url: str, **kwargs: Any) -> httpx.Response:
        async def _put():
            return await self._client.put(url, **kwargs)  # type: ignore

        return await self.circuit_breaker.call(retry_with_backoff, self.retry_config, _put)

    async def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        async def _delete():
            return await self._client.delete(url, **kwargs)  # type: ignore

        return await self.circuit_breaker.call(retry_with_backoff, self.retry_config, _delete)
