"""Centralized SDK configuration."""

from __future__ import annotations

import os

from pydantic import BaseModel, Field


class TemporalLayrConfig(BaseModel):  # type: ignore[misc]
    api_key: str | None = None
    admin_key: str | None = None
    server_url: str = "http://localhost:8000"
    postgres_dsn: str | None = None
    tenant_id: str = "default"
    batch_size: int = Field(default=100, ge=1)
    flush_interval: float = Field(default=2.0, gt=0)
    debug_mode: bool = False
    rate_limit_enabled: bool = True
    log_level: str = "INFO"
    max_queue_size: int = Field(default=10000, ge=1)
    # Transport settings used by sdk_api.py
    timeout_seconds: float = Field(default=10.0, gt=0)
    max_retries: int = Field(default=3, ge=0)
    base_backoff: float = Field(default=0.2, gt=0)

    @classmethod
    def from_env(cls) -> TemporalLayrConfig:
        return cls(
            api_key=os.getenv("TEMPORALLAYR_API_KEY"),
            admin_key=os.getenv("TEMPORALLAYR_ADMIN_KEY"),
            server_url=os.getenv("TEMPORALLAYR_SERVER_URL", "http://localhost:8000"),
            postgres_dsn=os.getenv("TEMPORALLAYR_POSTGRES_DSN"),
            tenant_id=os.getenv("TEMPORALLAYR_TENANT_ID", "default"),
            batch_size=int(os.getenv("TEMPORALLAYR_BATCH_SIZE", "100")),
            flush_interval=float(os.getenv("TEMPORALLAYR_FLUSH_INTERVAL", "2.0")),
            debug_mode=(
                os.getenv("TEMPORALLAYR_DEBUG_MODE", "false").lower() in {"1", "true", "yes"}
            ),
            rate_limit_enabled=(
                os.getenv("TEMPORALLAYR_RATE_LIMIT_ENABLED", "true").lower() in {"1", "true", "yes"}
            ),
            log_level=os.getenv("TEMPORALLAYR_LOG_LEVEL", "INFO").upper(),
            max_queue_size=int(os.getenv("TEMPORALLAYR_MAX_QUEUE_SIZE", "10000")),
            timeout_seconds=float(os.getenv("TEMPORALLAYR_TIMEOUT_SECONDS", "10.0")),
            max_retries=int(os.getenv("TEMPORALLAYR_MAX_RETRIES", "3")),
            base_backoff=float(os.getenv("TEMPORALLAYR_BASE_BACKOFF", "0.2")),
        )


def resolve_config(
    explicit: TemporalLayrConfig | None = None, **kwargs: object
) -> TemporalLayrConfig:
    base = explicit or TemporalLayrConfig.from_env()
    updates = {k: v for k, v in kwargs.items() if v is not None}
    return TemporalLayrConfig(**base.model_dump() | updates)


def get_config() -> TemporalLayrConfig:
    return TemporalLayrConfig.from_env()


def get_server_url() -> str:
    return get_config().server_url


def get_api_key() -> str | None:
    return get_config().api_key


def get_tenant_id() -> str:
    return get_config().tenant_id


def get_verify_ssl() -> bool:
    return True
