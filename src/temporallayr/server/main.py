"""Primary ASGI entrypoint for TemporalLayr server runtime."""

from __future__ import annotations

from temporallayr.server.app import app as _app
from temporallayr.server.lifespan import server_lifespan

# Use centralized lifespan hooks that raise RuntimeError on startup failures.
_app.router.lifespan_context = server_lifespan

app = _app
