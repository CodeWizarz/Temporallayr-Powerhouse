"""
FastAPI middleware for request auditing and metrics.

Provides middleware for tracking request metrics and audit logging.
"""

from __future__ import annotations

import time
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from temporallayr.core.audit import AuditLogger
from temporallayr.monitoring.prometheus import track_request


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware that tracks request metrics and logs API calls for audit purposes.

    Tracks:
    - Request duration
    - API request counts by method, path, and status code
    - Audit log entries for each request
    """

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        t0 = time.time()
        tenant_id = request.headers.get("X-Tenant-Id", "unknown")

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            raise e
        finally:
            duration_ms = (time.time() - t0) * 1000

            AuditLogger.log_api_call(
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=duration_ms,
                tenant_id=tenant_id,
            )

            track_request(
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=duration_ms,
            )

        return response
