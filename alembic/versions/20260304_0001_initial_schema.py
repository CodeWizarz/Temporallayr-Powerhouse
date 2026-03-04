"""Initial schema for traces, spans, tenants, quotas, and audit logs.

Revision ID: 20260304_0001
Revises:
Create Date: 2026-03-04 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260304_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("tenant_id", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("tenant_id"),
    )

    op.create_table(
        "traces",
        sa.Column("trace_id", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Text(), nullable=False),
        sa.Column("fingerprint", sa.Text(), nullable=True),
        sa.Column("trace_payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("trace_id"),
    )
    op.create_index(
        "idx_traces_tenant_created", "traces", ["tenant_id", "created_at"], unique=False
    )
    op.create_index("idx_traces_fingerprint", "traces", ["fingerprint"], unique=False)

    op.create_table(
        "spans",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("trace_id", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Text(), nullable=False),
        sa.Column("span_id", sa.Text(), nullable=False),
        sa.Column("parent_span_id", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("attributes", sa.JSON(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(["trace_id"], ["traces.trace_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trace_id", "span_id", name="uq_spans_trace_span"),
    )
    op.create_index("idx_spans_trace", "spans", ["trace_id"], unique=False)
    op.create_index("idx_spans_tenant_time", "spans", ["tenant_id", "created_at"], unique=False)

    op.create_table(
        "quotas",
        sa.Column("tenant_id", sa.Text(), nullable=False),
        sa.Column(
            "daily_spans_limit", sa.BigInteger(), nullable=False, server_default=sa.text("100000")
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.tenant_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("tenant_id"),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_log_created", "audit_log", ["created_at"], unique=False)
    op.create_index("idx_audit_log_tenant", "audit_log", ["tenant_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_audit_log_tenant", table_name="audit_log")
    op.drop_index("idx_audit_log_created", table_name="audit_log")
    op.drop_table("audit_log")

    op.drop_table("quotas")

    op.drop_index("idx_spans_tenant_time", table_name="spans")
    op.drop_index("idx_spans_trace", table_name="spans")
    op.drop_table("spans")

    op.drop_index("idx_traces_fingerprint", table_name="traces")
    op.drop_index("idx_traces_tenant_created", table_name="traces")
    op.drop_table("traces")

    op.drop_table("tenants")
