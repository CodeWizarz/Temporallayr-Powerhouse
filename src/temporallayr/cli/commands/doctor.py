import sys


def register(subparsers) -> None:
    doctor_parser = subparsers.add_parser(
        "doctor", help="Verify SDK configurations and server reachability natively."
    )
    doctor_parser.set_defaults(func=_run_doctor)


import logging

logger = logging.getLogger(__name__)


def _run_doctor(args) -> None:
    """Diagnose SDK environment, parse active configs, and verify server reachability natively."""
    from temporallayr.config import get_api_key, get_config, get_server_url, get_verify_ssl

    logger.info("Temporallayr Doctor Initiated")

    config = get_config()
    target_url = get_server_url().rstrip("/")

    logger.info("Target Server URL mapped", extra={"target_url": target_url})
    logger.info("Local Flush Interval resolved", extra={"flush_interval": config.flush_interval})
    logger.info("Local Max Queue Size resolved", extra={"queue_size": config.queue_size})

    api_key_str = get_api_key()
    api_key_masked = f"...{api_key_str[-4:]}" if api_key_str and len(api_key_str) > 4 else "NOT SET"
    logger.info("API Key resolution", extra={"api_key_found": api_key_masked})

    verify_ssl = get_verify_ssl()
    logger.info("SSL Verification explicit", extra={"ssl_enabled": verify_ssl})

    if not api_key_str:
        logger.error(
            "FAILED: No API key found. Run `temporallayr login` or set TEMPORALLAYR_API_KEY."
        )
        sys.exit(1)

    logger.info("Attempting handshake with TemporalLayr server...")
    try:
        import certifi
        import httpx

        headers = {"Authorization": f"Bearer {api_key_str}", "Content-Type": "application/json"}
        res = httpx.get(
            f"{target_url}/handshake",
            headers=headers,
            timeout=5.0,
            verify=certifi.where(),
        )
        payload = res.json()
        tenant_id = payload.get("tenant_id", "Unknown")
        logger.info(
            f"SUCCESS: Authenticated successfully against tenant '{tenant_id}'.",
            extra={"tenant_id": tenant_id},
        )
        logger.info("SUCCESS: SDK is ready to intercept telemetries.")
    except httpx.HTTPStatusError as e:
        logger.error(f"FAILED: Server rejected connection: HTTP {e.response.status_code}")
        logger.warning("Hint: Verify your API key.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"FAILED: Could not reach {target_url}: {e}", exc_info=True)
        logger.warning("Hint: Server might be offline or configured incorrectly.")
        sys.exit(1)
