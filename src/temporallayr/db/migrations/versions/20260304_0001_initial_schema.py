"""Initial SQL migration for PostgreSQL storage tables."""

from __future__ import annotations

UPGRADE_SQL = [
    """
    CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS traces (
        trace_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        fingerprint TEXT,
        trace_payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_traces_tenant_created ON traces (tenant_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_traces_fingerprint ON traces (fingerprint)",
    """
    CREATE TABLE IF NOT EXISTS spans (
        id BIGSERIAL PRIMARY KEY,
        trace_id TEXT NOT NULL REFERENCES traces(trace_id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        span_id TEXT NOT NULL,
        parent_span_id TEXT,
        name TEXT NOT NULL,
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        status TEXT,
        error TEXT,
        attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(trace_id, span_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans (trace_id)",
    "CREATE INDEX IF NOT EXISTS idx_spans_tenant_time ON spans (tenant_id, created_at DESC)",
    """
    CREATE TABLE IF NOT EXISTS quotas (
        tenant_id TEXT PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        daily_spans_limit BIGINT NOT NULL DEFAULT 100000,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        tenant_id TEXT,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log (tenant_id, created_at DESC)",
]

DOWNGRADE_SQL = [
    "DROP INDEX IF EXISTS idx_audit_log_tenant",
    "DROP INDEX IF EXISTS idx_audit_log_created",
    "DROP TABLE IF EXISTS audit_log",
    "DROP TABLE IF EXISTS quotas",
    "DROP INDEX IF EXISTS idx_spans_tenant_time",
    "DROP INDEX IF EXISTS idx_spans_trace",
    "DROP TABLE IF EXISTS spans",
    "DROP INDEX IF EXISTS idx_traces_fingerprint",
    "DROP INDEX IF EXISTS idx_traces_tenant_created",
    "DROP TABLE IF EXISTS traces",
    "DROP TABLE IF EXISTS tenants",
]


def upgrade_sql() -> list[str]:
    """Return SQL statements for applying migration."""
    return UPGRADE_SQL


def downgrade_sql() -> list[str]:
    """Return SQL statements for rolling back migration."""
    return DOWNGRADE_SQL
