"""
Command line interface for the Temporallayr ingestion server.
"""

import argparse
import logging
import sys

from temporallayr.config import get_config
from temporallayr.core.logging import configure_logging

logger = logging.getLogger(__name__)

import uvicorn


def main() -> None:
    """Boot the FastAPI ingestion and validation engine."""
    parser = argparse.ArgumentParser(
        description="Temporallayr-Server production API.", prog="temporallayr-server"
    )

    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host IP to bind to.")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to.")

    args = parser.parse_args()

    config = get_config()
    configure_logging(level=config.log_level)

    # Defer to uvicorn API interface
    logger.info(f"Starting Temporallayr Server Engine on {args.host}:{args.port}")
    try:
        uvicorn.run("temporallayr.server.app:app", host=args.host, port=args.port)
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
