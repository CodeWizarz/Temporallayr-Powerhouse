import json
import os
import threading
from datetime import UTC, datetime, timedelta
from typing import Any


class HealthStore:
    """A simple JSON-based store for health metrics with retention policies."""

    def __init__(self, file_path: str = "health_history.json"):
        self.file_path = file_path
        self._lock = threading.Lock()
        self._cache: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        """Load the history from disk."""
        if not os.path.exists(self.file_path):
            self._cache = []
            return
        try:
            with open(self.file_path, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    self._cache = data
        except Exception:
            self._cache = []

    def _save(self) -> None:
        """Save the history to disk."""
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self._cache, f)
        except Exception:
            pass

    def record_health(self, service: str, status: str, error: str | None = None) -> None:
        """Record a single health check ping."""
        entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "service": service,
            "status": status,
        }
        if error:
            entry["error"] = error

        with self._lock:
            self._cache.append(entry)
            self._save()

    def get_history(self) -> list[dict[str, Any]]:
        """Return the complete history."""
        with self._lock:
            return list(self._cache)

    def compact(self, days: int = 30) -> None:
        """Remove entries older than `days`."""
        cutoff = datetime.now(UTC) - timedelta(days=days)
        with self._lock:
            original_len = len(self._cache)
            self._cache = [
                entry
                for entry in self._cache
                if datetime.fromisoformat(entry["timestamp"]) >= cutoff
            ]
            if len(self._cache) != original_len:
                self._save()


# Global store instance
_store = None


def get_health_store() -> HealthStore:
    global _store
    if _store is None:
        data_dir = os.environ.get("TEMPORALLAYR_DATA_DIR", ".")
        _store = HealthStore(os.path.join(data_dir, "health_history.json"))
    return _store
