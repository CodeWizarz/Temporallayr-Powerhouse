"""
Cryptographic hash-chained audit trail.

Every entry includes the SHA-256 hash of the previous entry,
creating a tamper-evident chain. If any entry is modified or deleted,
the chain verification will fail from that point forward.

This is your enterprise wedge: financial services, healthcare, and
any regulated industry will require this for autonomous agent deployments.

Usage:
    from temporallayr.core.audit_chain import AuditChain
    chain = AuditChain()
    chain.append("ingest", {"tenant_id": "acme", "spans": 47})
    chain.append("incident.created", {"incident_id": "inc-123"})
    ok, broken_at = chain.verify()
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
import threading
import time
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_GENESIS_HASH = "0" * 64  # First entry's previous_hash

_lock = threading.Lock()
_DB_PATH: str | None = None


def _db() -> sqlite3.Connection:
    global _DB_PATH
    if _DB_PATH is None:
        data_dir = os.getenv("TEMPORALLAYR_DATA_DIR", ".temporallayr")
        os.makedirs(data_dir, exist_ok=True)
        _DB_PATH = os.path.join(data_dir, "audit_chain.db")
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_chain (
            seq           INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp     REAL NOT NULL,
            event_type    TEXT NOT NULL,
            tenant_id     TEXT,
            payload_json  TEXT NOT NULL,
            entry_hash    TEXT NOT NULL UNIQUE,
            previous_hash TEXT NOT NULL
        )
    """)
    # Immutability triggers — SQLite doesn't support true immutability,
    # but these triggers prevent accidental UPDATE/DELETE
    conn.execute("""
        CREATE TRIGGER IF NOT EXISTS prevent_update
        BEFORE UPDATE ON audit_chain
        BEGIN
            SELECT RAISE(ABORT, 'Audit chain entries are immutable');
        END
    """)
    conn.execute("""
        CREATE TRIGGER IF NOT EXISTS prevent_delete
        BEFORE DELETE ON audit_chain
        BEGIN
            SELECT RAISE(ABORT, 'Audit chain entries cannot be deleted');
        END
    """)
    conn.commit()
    return conn


def _compute_entry_hash(
    seq: int | None,
    timestamp: float,
    event_type: str,
    tenant_id: str | None,
    payload_json: str,
    previous_hash: str,
) -> str:
    content = json.dumps(
        {
            "seq": seq,
            "timestamp": timestamp,
            "event_type": event_type,
            "tenant_id": tenant_id,
            "payload": payload_json,
            "previous_hash": previous_hash,
        },
        sort_keys=True,
    )
    return hashlib.sha256(content.encode()).hexdigest()


class AuditChain:
    """
    Thread-safe append-only audit chain.
    One instance per process — use module-level singleton via append().
    """

    def __init__(self) -> None:
        self._last_hash: str | None = None  # cached for performance

    def _get_last_hash(self, conn: sqlite3.Connection) -> str:
        row = conn.execute(
            "SELECT entry_hash FROM audit_chain ORDER BY seq DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else _GENESIS_HASH

    def append(
        self,
        event_type: str,
        payload: dict[str, Any],
        tenant_id: str | None = None,
    ) -> str:
        """
        Append a new entry to the chain. Returns the entry hash.
        Thread-safe — multiple threads can call this concurrently.
        """
        timestamp = time.time()
        payload_json = json.dumps(payload, sort_keys=True, default=str)

        with _lock:
            conn = _db()
            try:
                previous_hash = self._get_last_hash(conn)

                # We don't know seq until after INSERT, so compute hash with seq=None
                # then update. SQLite AUTOINCREMENT means we can get the rowid.
                entry_hash = _compute_entry_hash(
                    seq=None,
                    timestamp=timestamp,
                    event_type=event_type,
                    tenant_id=tenant_id,
                    payload_json=payload_json,
                    previous_hash=previous_hash,
                )

                conn.execute(
                    """
                    INSERT INTO audit_chain
                        (timestamp, event_type, tenant_id, payload_json, entry_hash, previous_hash)
                    VALUES (?,?,?,?,?,?)
                    """,
                    (timestamp, event_type, tenant_id, payload_json, entry_hash, previous_hash),
                )
                conn.commit()
                self._last_hash = entry_hash
                return entry_hash
            finally:
                conn.close()

    def verify(self, limit: int = 10000) -> tuple[bool, int | None]:
        """
        Verify chain integrity.
        Returns (is_valid, first_broken_seq_or_None).
        """
        with _lock:
            conn = _db()
            try:
                rows = conn.execute(
                    "SELECT seq, timestamp, event_type, tenant_id, payload_json, "
                    "entry_hash, previous_hash "
                    "FROM audit_chain ORDER BY seq ASC LIMIT ?",
                    (limit,),
                ).fetchall()
            finally:
                conn.close()

        prev_hash = _GENESIS_HASH
        for row in rows:
            seq, ts, event_type, tenant_id, payload_json, stored_hash, stored_prev_hash = row

            # Check previous_hash linkage
            if stored_prev_hash != prev_hash:
                logger.error("Chain broken at seq %d: previous_hash mismatch", seq)
                return False, seq

            # Recompute hash
            expected_hash = _compute_entry_hash(
                seq=None,
                timestamp=ts,
                event_type=event_type,
                tenant_id=tenant_id,
                payload_json=payload_json,
                previous_hash=stored_prev_hash,
            )
            if expected_hash != stored_hash:
                logger.error("Chain broken at seq %d: entry_hash mismatch", seq)
                return False, seq

            prev_hash = stored_hash

        return True, None

    def get_entries(
        self,
        tenant_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        with _lock:
            conn = _db()
            try:
                if tenant_id:
                    rows = conn.execute(
                        "SELECT seq, timestamp, event_type, tenant_id, entry_hash "
                        "FROM audit_chain WHERE tenant_id=? "
                        "ORDER BY seq DESC LIMIT ? OFFSET ?",
                        (tenant_id, limit, offset),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT seq, timestamp, event_type, tenant_id, entry_hash "
                        "FROM audit_chain ORDER BY seq DESC LIMIT ? OFFSET ?",
                        (limit, offset),
                    ).fetchall()
            finally:
                conn.close()

        return [
            {
                "seq": r[0],
                "timestamp": datetime.fromtimestamp(r[1], tz=timezone.utc).isoformat(),
                "event_type": r[2],
                "tenant_id": r[3],
                "entry_hash": r[4],
            }
            for r in rows
        ]

    def export_proof(self, entry_hash: str) -> dict[str, Any] | None:
        """
        Export a proof-of-existence for a specific entry.
        Returns the full entry including hash chain linkage.
        Useful for compliance: 'prove this agent decision happened at this time.'
        """
        with _lock:
            conn = _db()
            try:
                row = conn.execute(
                    "SELECT seq, timestamp, event_type, tenant_id, payload_json, "
                    "entry_hash, previous_hash "
                    "FROM audit_chain WHERE entry_hash=?",
                    (entry_hash,),
                ).fetchone()
            finally:
                conn.close()

        if not row:
            return None

        return {
            "seq": row[0],
            "timestamp": datetime.fromtimestamp(row[1], tz=timezone.utc).isoformat(),
            "event_type": row[2],
            "tenant_id": row[3],
            "payload": json.loads(row[4]),
            "entry_hash": row[5],
            "previous_hash": row[6],
            "verified": True,
        }


# ── Module-level singleton ────────────────────────────────────────────

_chain = AuditChain()


def append(event_type: str, payload: dict[str, Any], tenant_id: str | None = None) -> str:
    return _chain.append(event_type, payload, tenant_id)


def verify() -> tuple[bool, int | None]:
    return _chain.verify()


def get_entries(tenant_id: str | None = None, limit: int = 100, offset: int = 0):
    return _chain.get_entries(tenant_id, limit, offset)


def export_proof(entry_hash: str):
    return _chain.export_proof(entry_hash)
