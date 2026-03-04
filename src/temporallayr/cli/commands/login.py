import os
import sys
from typing import Any


def register(subparsers: Any) -> None:
    login_parser = subparsers.add_parser(
        "login", help="Set and securely save your TemporalLayr API Key."
    )
    login_parser.add_argument(
        "--key",
        type=str,
        help="API Key exclusively bypassing interactive prompt.",
        default=None,
    )
    login_parser.set_defaults(func=_run_login)


def _run_login(args: Any) -> None:
    """Interactively save the TemporalLayr API Key into temporallayr.yaml for the workspace."""
    import yaml  # type: ignore[import-untyped]

    print("=" * 40)
    print("Temporallayr Enterprise Login")
    print("=" * 40)

    api_key = args.key

    if not api_key:
        api_key = input("Enter your TemporalLayr API Key: ").strip()

    if not api_key:
        print("Error: API Key cannot be empty.", file=sys.stderr)
        sys.exit(1)

    config_path = "temporallayr.yaml"
    existing_config: dict[str, Any] = {}

    if os.path.exists(config_path):
        try:
            with open(config_path, encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
                if isinstance(loaded, dict):
                    existing_config = loaded
        except Exception:
            pass

    existing_config["api_key"] = api_key

    with open(config_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(existing_config, f, default_flow_style=False)

    print(f"✓ API Key securely saved to {os.path.abspath(config_path)}\n")
    print("Run `temporallayr doctor` to verify your connection.")
