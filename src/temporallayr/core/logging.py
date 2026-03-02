"""
Structured JSON Logging Module.
Provides native logging formatters outputting JSON-lines mapping internal telemetry contexts globally.
"""

import logging
import json
import sys
from datetime import datetime, UTC
from typing import Any


class JSONFormatter(logging.Formatter):
    """
    Format standard python log records into a robust native JSON structure mapping context boundaries.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include exception traceback natively if generated
        if record.exc_info:
            log_obj["exc_info"] = self.formatException(record.exc_info)

        # Standard python 3.8+ LogRecord attributes to ignore traversing kwargs
        standard_keys = {
            "name",
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
            "taskName",
            "message",
        }

        # Map kwargs provided inside logger.info(msg, extra={"tenant_id": "X"}) dynamically.
        for key, value in record.__dict__.items():
            if key not in standard_keys:
                log_obj[key] = value

        return json.dumps(log_obj)


def configure_logging(level: str = "INFO") -> None:
    """
    Setups root logger to write standard JSON bounded formats to sys.stdout.
    Must be called at application startup lifecycle natively.
    """
    root_logger = logging.getLogger()

    # Strip existing default handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Convert string level directly
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(JSONFormatter())

    root_logger.addHandler(stdout_handler)

    # Optional debug safety bound internally so external noisy packages dont skew logs
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
