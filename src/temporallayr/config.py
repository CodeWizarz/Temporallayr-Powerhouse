"""Centralized SDK + server configuration."""

from __future__ import annotations

import os
from pydantic import BaseModel, Field


class TemporalLayrConfig(BaseModel):
    # SDK fields
    api_key: str | None = None
    server_url: str = "http://localhost:8000"
    tenant_id: str = "default"
    batch_size: int = Field(default=100, ge=1)
    flush_interval: float = Field(default=2.0, gt=0)
    debug_mode: bool = False
    max_queue_size: int = Field(default=10000, ge=1)
    timeout_seconds: float = Field(default=10.0, gt=0)
    max_retries: int = Field(default=3, ge=0)
    base_backoff: float = Field(default=0.2, gt=0)

    # Server / admin fields
    admin_key: str | None = None
    log_level: str = "INFO"

    # Postgres (optional)
    postgres_dsn: str | None = None

    # ClickHouse (optional) — defaults safe for ClickHouse Cloud (TLS on)
    clickhouse_host: str | None = None
    clickhouse_port: int = 8443
    clickhouse_db: str = "default"
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_secure: bool = True   # FIXED: default True for ClickHouse Cloud

    # OTLP export (optional)
    otlp_endpoint: str | None = None
    otlp_api_key: str | None = None

    @classmethod
    def from_env(cls) -> "TemporalLayrConfig":
        return cls(
            api_key=os.getenv("TEMPORALLAYR_API_KEY"),
            server_url=os.getenv("TEMPORALLAYR_SERVER_URL", "http://localhost:8000"),
            tenant_id=os.getenv("TEMPORALLAYR_TENANT_ID", "default"),
            batch_size=int(os.getenv("TEMPORALLAYR_BATCH_SIZE", "100")),
            flush_interval=float(os.getenv("TEMPORALLAYR_FLUSH_INTERVAL", "2.0")),
            debug_mode=os.getenv("TEMPORALLAYR_DEBUG_MODE", "false").lower() in {"1", "true", "yes"},
            max_queue_size=int(os.getenv("TEMPORALLAYR_MAX_QUEUE_SIZE", "10000")),
            timeout_seconds=float(os.getenv("TEMPORALLAYR_TIMEOUT_SECONDS", "10.0")),
            max_retries=int(os.getenv("TEMPORALLAYR_MAX_RETRIES", "3")),
            base_backoff=float(os.getenv("TEMPORALLAYR_BASE_BACKOFF", "0.2")),
            admin_key=os.getenv("TEMPORALLAYR_ADMIN_KEY"),
            log_level=os.getenv("TEMPORALLAYR_LOG_LEVEL", "INFO").upper(),
            postgres_dsn=os.getenv("TEMPORALLAYR_POSTGRES_DSN"),
            clickhouse_host=os.getenv("TEMPORALLAYR_CLICKHOUSE_HOST"),
            clickhouse_port=int(os.getenv("TEMPORALLAYR_CLICKHOUSE_PORT", "8443")),
            clickhouse_db=os.getenv("TEMPORALLAYR_CLICKHOUSE_DB", "default"),
            clickhouse_user=os.getenv("TEMPORALLAYR_CLICKHOUSE_USER", "default"),
            clickhouse_password=os.getenv("TEMPORALLAYR_CLICKHOUSE_PASSWORD", ""),
            clickhouse_secure=os.getenv("TEMPORALLAYR_CLICKHOUSE_SECURE", "true").lower() != "false",
            otlp_endpoint=os.getenv("TEMPORALLAYR_OTLP_ENDPOINT"),
            otlp_api_key=os.getenv("TEMPORALLAYR_OTLP_API_KEY"),
        )


def resolve_config(explicit: TemporalLayrConfig | None = None, **kwargs: object) -> TemporalLayrConfig:
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
