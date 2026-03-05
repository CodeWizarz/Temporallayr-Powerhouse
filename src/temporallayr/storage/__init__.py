"""Storage backend implementations.

PostgresStore has been consolidated to temporallayr.core.store_postgres.
This module re-exports for backward compatibility.
"""

from temporallayr.core.store_postgres import PostgresStore

__all__ = ["PostgresStore"]
