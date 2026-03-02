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


def _run_logs(args) -> None:
    """Read API key securely, fetch remote events natively, and display tabular graphs."""
    import httpx

    from temporallayr.config import get_api_key, get_server_url

    api_key_str = get_api_key()
    target_url = get_server_url().rstrip("/")
    if not api_key_str:
        print("✗ No API key found. Run `temporallayr login` first.", file=sys.stderr)
        sys.exit(1)

    endpoint = f"{target_url}/v1/query"
    headers = {"Authorization": f"Bearer {api_key_str}"}
    params = {"limit": args.limit}

    print(f"Fetching logs from {endpoint}...")
    try:
        import certifi

        with httpx.Client(verify=certifi.where()) as client:
            res = client.get(endpoint, headers=headers, params=params, timeout=10.0)
            res.raise_for_status()

            data = res.json()
            events = data.get("executions", data.get("events", []))

            if not events:
                print("No executions found.")
                return

            print("\n" + "=" * 100)
            print(f"{'EXECUTION ID':<38} | {'CREATED AT':<27} | {'TENANT':<15} | {'NODES'}")
            print("-" * 100)

            for ev in events:
                eid = ev.get("id", "Unknown")[:36]
                created = ev.get("created_at", "Unknown")[:25]
                tenant = ev.get("tenant_id", "Unknown")[:13]
                nodes = len(ev.get("nodes", {}))
                print(f"{eid:<38} | {created:<27} | {tenant:<15} | {nodes}")

            print("=" * 100)

    except httpx.HTTPStatusError as e:
        print(f"✗ Server error: HTTP {e.response.status_code}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"✗ Could not fetch logs from server: {e}", file=sys.stderr)
        sys.exit(1)
