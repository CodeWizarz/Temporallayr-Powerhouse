import sys

import certifi
import httpx


def register(subparsers) -> None:
    doctor_parser = subparsers.add_parser(
        "doctor", help="Verify SDK configurations and server reachability natively."
    )
    doctor_parser.set_defaults(func=_run_doctor)


def _run_doctor(args) -> None:
    """Diagnose SDK environment, parse active configs, and verify server reachability natively."""
    from temporallayr.config import get_api_key, get_config, get_server_url, get_verify_ssl

    print("=" * 40)
    print("Temporallayr Doctor")
    print("=" * 40)

    config = get_config()
    target_url = get_server_url().rstrip("/")

    print(f"1. Target Server URL: {target_url}")
    print(f"2. Local Flush Interval: {config.flush_interval}s")
    print(f"3. Local Max Queue Size: {config.max_queue_size}")

    api_key_str = get_api_key()
    api_key_masked = f"...{api_key_str[-4:]}" if api_key_str and len(api_key_str) > 4 else "NOT SET"
    print(f"4. API Key Found: {api_key_masked}")

    verify_ssl = get_verify_ssl()
    print(f"5. SSL Verification: {'ENABLED' if verify_ssl else 'DISABLED'}")

    if not api_key_str:
        print("\n✗ FAILED: No API key found. Run `temporallayr login` or set TEMPORALLAYR_API_KEY.")
        sys.exit(1)

    print("\nAttempting handshake with TemporalLayr server...")
    try:
        headers = {"Authorization": f"Bearer {api_key_str}", "Content-Type": "application/json"}
        res = httpx.get(
            f"{target_url}/handshake",
            headers=headers,
            timeout=5.0,
            verify=certifi.where(),
        )
        res.raise_for_status()
        payload = res.json()
        tenant_id = payload.get("tenant_id", "Unknown")
        print(f"✓ SUCCESS: Authenticated successfully against tenant '{tenant_id}'.")
        print("✓ SUCCESS: SDK is ready to intercept telemetries.")
    except httpx.HTTPStatusError as e:
        print(f"\n✗ FAILED: Server rejected connection: HTTP {e.response.status_code}")
        print("Hint: Verify your API key.")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ FAILED: Could not reach {target_url}: {e}")
        print("Hint: Server might be offline or configured incorrectly.")
        sys.exit(1)
