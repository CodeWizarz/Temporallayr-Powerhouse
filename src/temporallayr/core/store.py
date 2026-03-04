"""
ExecutionStore abstraction and default implementations.
"""

import abc
from datetime import datetime
from pathlib import Path

from temporallayr.models.execution import ExecutionGraph


class ExecutionStore(abc.ABC):
    @abc.abstractmethod
    def save_execution(self, graph: ExecutionGraph) -> None: ...

    @abc.abstractmethod
    def bulk_save_executions(self, graphs: list[ExecutionGraph]) -> None: ...

    @abc.abstractmethod
    def load_execution(self, graph_id: str, tenant_id: str) -> ExecutionGraph: ...

    @abc.abstractmethod
    def list_executions(self, tenant_id: str) -> list[str]: ...

    @abc.abstractmethod
    def delete_old_executions(self, cutoff: datetime) -> int: ...


class LocalJSONStore(ExecutionStore):
    BASE_DIR = Path(".temporallayr")
    EXECUTIONS_DIR = BASE_DIR / "executions"

    def __init__(self) -> None:
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        self.EXECUTIONS_DIR.mkdir(parents=True, exist_ok=True)

    def save_execution(self, graph: ExecutionGraph) -> None:
        tenant_dir = self.EXECUTIONS_DIR / graph.tenant_id
        tenant_dir.mkdir(parents=True, exist_ok=True)
        (tenant_dir / f"{graph.id}.json").write_text(
            graph.model_dump_json(indent=2), encoding="utf-8"
        )

    def bulk_save_executions(self, graphs: list[ExecutionGraph]) -> None:
        for graph in graphs:
            self.save_execution(graph)

    def load_execution(self, reference: str, tenant_id: str) -> ExecutionGraph:
        path = Path(reference)
        if path.exists():
            content = path.read_text(encoding="utf-8")
            graph = ExecutionGraph.model_validate_json(content)
            if graph.tenant_id != tenant_id:
                raise FileNotFoundError(f"Execution not found for tenant {tenant_id}")
            return graph
        tenant_dir = self.EXECUTIONS_DIR / tenant_id
        for p in [tenant_dir / f"{reference}.json", tenant_dir / reference]:
            if p.exists():
                content = p.read_text(encoding="utf-8")
                graph = ExecutionGraph.model_validate_json(content)
                if graph.tenant_id != tenant_id:
                    raise FileNotFoundError(f"Execution not found for tenant {tenant_id}")
                return graph
        raise FileNotFoundError(f"Could not resolve {reference} for tenant {tenant_id}")

    def list_executions(self, tenant_id: str) -> list[str]:
        tenant_dir = self.EXECUTIONS_DIR / tenant_id
        if not tenant_dir.exists():
            return []
        return [p.stem for p in tenant_dir.glob("*.json")]

    def delete_old_executions(self, cutoff: datetime) -> int:
        deleted = 0
        if not self.EXECUTIONS_DIR.exists():
            return deleted
        for tenant_dir in self.EXECUTIONS_DIR.iterdir():
            if not tenant_dir.is_dir():
                continue
            for filepath in tenant_dir.glob("*.json"):
                try:
                    graph = ExecutionGraph.model_validate_json(filepath.read_text(encoding="utf-8"))
                    if graph.created_at < cutoff:
                        filepath.unlink()
                        deleted += 1
                except Exception as e:
                    print(f"GC error for {filepath}: {e}")
        return deleted


# Lazy singleton — avoids circular import when api_keys.py imports SQLiteStore directly
_default_store: ExecutionStore | None = None


def set_default_store(store: ExecutionStore) -> None:
    global _default_store
    _default_store = store


def get_default_store() -> ExecutionStore:
    global _default_store
    if _default_store is None:
        import os

        if os.getenv("TEMPORALLAYR_POSTGRES_DSN"):
            from temporallayr.core.store_postgres import PostgresStore

            _default_store = PostgresStore()
        else:
            from temporallayr.core.store_sqlite import SQLiteStore

            _default_store = SQLiteStore()
    return _default_store
