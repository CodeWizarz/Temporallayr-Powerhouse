"""
Enterprise audit logging for compliance and traceability.
"""

import json
import os
import sys
from datetime import UTC, datetime
from typing import Any


class AuditLogger:
    """
    Structured JSON logger for capturing auditable system events natively.
    """

    @classmethod
    def _write_log(cls, entry: dict[str, Any]) -> None:
        """Route log to stdout or dedicated audit file if configured."""
        log_file = os.environ.get("TEMPORALLAYR_AUDIT_LOG_FILE")
        log_str = json.dumps(entry)

        if log_file:
            try:
                with open(log_file, "a", encoding="utf-8") as f:
                    f.write(log_str + "\n")
            except Exception as e:
                print(f"Failed to write audit log to {log_file}: {e}", file=sys.stderr)

        # Always mirror to stdout for standard cloud observability ingestion
        print(f"[AUDIT] {log_str}")

    @classmethod
    def log_api_call(
        cls,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        tenant_id: str = "unknown",
    ) -> None:
        """Log incoming API requests."""
        cls._write_log(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "event_type": "api_call",
                "method": method,
                "path": path,
                "status_code": status_code,
                "duration_ms": round(duration_ms, 2),
                "tenant_id": tenant_id,
            }
        )

    @classmethod
    def log_incident_change(
        cls, incident_id: str, action: str, tenant_id: str, details: dict[str, Any] | None = None
    ) -> None:
        """Log modifications to incident states (ack, resolve, escalate)."""
        cls._write_log(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "event_type": "incident_change",
                "incident_id": incident_id,
                "action": action,
                "tenant_id": tenant_id,
                "details": details or {},
            }
        )

    @classmethod
    def log_config_change(cls, key: str, value: str, source: str = "env") -> None:
        """Log environmental configuration bindings at startup or dynamically."""
        cls._write_log(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "event_type": "config_change",
                "key": key,
                "value": "***" if "SECRET" in key.upper() or "KEY" in key.upper() else value,
                "source": source,
            }
        )
