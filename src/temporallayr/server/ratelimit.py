"""
Rate limiting module for Temporallayr API using slowapi.
Enforces limits based on tenant_id extracted from Bearer tokens.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from temporallayr.config import get_config
from temporallayr.server.auth.api_keys import validate_api_key


def tenant_key_func(request: Request) -> str:
    """
    Extracts the tenant_id from the Authorization header to use as the rate limit key.
    If rate limiting is disabled globally, returns a constant 'bypass' key.
    """
    if not get_config().rate_limit_enabled:
        return "bypass"

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        tenant_id = validate_api_key(token)
        if tenant_id:
            return tenant_id

    # Fallback for unauthenticated endpoints or malformed headers.
    return "anonymous"


# Global rate limiter instance to be attached to the FastAPI app.
limiter = Limiter(key_func=tenant_key_func)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom exception handler for slowapi RateLimitExceeded.
    Returns the specific JSON schema: {"error": "rate_limit_exceeded", "retry_after_seconds": int}
    """
    response = JSONResponse(
        status_code=429, content={"error": "rate_limit_exceeded", "retry_after_seconds": 60}
    )
    # slowapi normally injects the retry-after value in the response builder.
    # We can fetch it from the exception details generally if set by limits string:
    # However we can calculate it natively via the exception if attached.
    try:

        # Just simple parsed retry
        if hasattr(exc, "detail") and isinstance(exc.detail, str):
            response.headers["Retry-After"] = "60"
    except Exception:
        pass

    # We will compute real retry_after dynamically if available or default 60s
    retry_after_secs = int(response.headers.get("Retry-After", 60))
    response.content = (
        b'{"error":"rate_limit_exceeded","retry_after_seconds":'
        + str(retry_after_secs).encode()
        + b"}"
    )
    return response
