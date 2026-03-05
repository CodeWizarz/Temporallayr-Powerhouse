"""Transport accessor for backward compatibility."""

from __future__ import annotations

from temporallayr.sdk.client import get_sdk
from temporallayr.core.transport_http import AsyncHTTPTransport


def get_transport() -> AsyncHTTPTransport:
    sdk = get_sdk()
    if sdk is None:
        msg = "TemporalLayr SDK is not initialized. Call temporallayr.init(...)"
        raise RuntimeError(msg)
    return sdk.transport
