import logging
import sys
from app.core.config import settings


def configure_logging() -> None:
    """Configure structured logging for the application."""
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    fmt = "%(asctime)s %(levelname)s %(name)s %(message)s"
    if settings.ENVIRONMENT == "development":
        fmt = "%(asctime)s %(levelname)-8s %(name)s - %(message)s"

    formatter = logging.Formatter(fmt, datefmt="%Y-%m-%dT%H:%M:%S")
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
