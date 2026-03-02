import os
import sys


def register(subparsers) -> None:
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


import logging
from temporallayr.core.logging import configure_logging

logger = logging.getLogger(__name__)


def _run_login(args) -> None:
    """Interactively save the TemporalLayr API Key into temporallayr.yaml for the workspace."""
    import yaml

    logger.info("Temporallayr Enterprise Login Initialized")

    api_key = args.key

    if not api_key:
        api_key = input("Enter your TemporalLayr API Key: ").strip()

    if not api_key:
        logger.error("API Key cannot be empty.")
        sys.exit(1)

    config_path = "temporallayr.yaml"
    existing_config = {}

    if os.path.exists(config_path):
        try:
            with open(config_path, encoding="utf-8") as f:
                existing_config = yaml.safe_load(f) or {}
        except Exception:
            pass

    existing_config["api_key"] = api_key
    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(existing_config, f, default_flow_style=False)

    logger.info(
        "API Key securely saved to local workspace context configuration.",
        extra={"path": os.path.abspath(config_path)},
    )
    logger.info("Run `temporallayr doctor` to verify your connection.")
