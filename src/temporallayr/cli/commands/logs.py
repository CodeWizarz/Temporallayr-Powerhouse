import sys


def register(subparsers) -> None:
    logs_parser = subparsers.add_parser(
        "logs", help="Fetch remote executions from the telemetry server."
    )
    logs_parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of logs to fetch.",
    )
    logs_parser.set_defaults(func=_run_logs)


import logging

logger = logging.getLogger(__name__)


def _run_logs(args) -> None:
    """Read API key securely, fetch remote events natively, and display tabular graphs."""
    import httpx

    from temporallayr.config import get_api_key, get_server_url

    api_key_str = get_api_key()
    target_url = get_server_url().rstrip("/")
    if not api_key_str:
        logger.error("No API key found. Run `temporallayr login` first.")
        sys.exit(1)

    endpoint = f"{target_url}/v1/query"
    headers = {"Authorization": f"Bearer {api_key_str}"}
    params = {"limit": args.limit}

    logger.info(f"Fetching logs from {endpoint}...")
    try:
        import certifi

        with httpx.Client(verify=certifi.where()) as client:
            res = client.get(endpoint, headers=headers, params=params, timeout=10.0)
            res.raise_for_status()

            data = res.json()
            events = data.get("executions", data.get("events", []))

            if not events:
                logger.info("No executions found.")
                return

            for ev in events:
                eid = ev.get("id", "Unknown")[:36]
                created = ev.get("created_at", "Unknown")[:25]
                tenant = ev.get("tenant_id", "Unknown")[:13]
                nodes = len(ev.get("nodes", {}))
                logger.info(
                    "Execution Log",
                    extra={
                        "execution_id": eid,
                        "created_at": created,
                        "tenant_id": tenant,
                        "node_count": nodes,
                    },
                )

    except httpx.HTTPStatusError as e:
        logger.error(f"Server error: HTTP {e.response.status_code}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Could not fetch logs from server: {e}", exc_info=True)
        sys.exit(1)
