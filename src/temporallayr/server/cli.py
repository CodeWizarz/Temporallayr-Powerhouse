"""
Command line interface for the Temporallayr ingestion server.
"""

import argparse
import sys

import uvicorn


def main() -> None:
    """Boot the FastAPI ingestion and validation engine."""
    parser = argparse.ArgumentParser(
        description="Temporallayr-Server production API.", prog="temporallayr-server"
    )

    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host IP to bind to.")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to.")

    args = parser.parse_args()

    # Defer to uvicorn API interface
    print(f"Starting Temporallayr Server Engine on {args.host}:{args.port}")
    try:
        uvicorn.run("temporallayr.server.app:app", host=args.host, port=args.port)
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
