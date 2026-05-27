"""EnglishAI WebSocket server entry point — port 8080.

Run with:
    uvicorn main:app --reload --port 8080

This is a SEPARATE process from the REST backend (port 8000).
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.auth import fetch_jwks
from app.routes.session_ws import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Fetch JWKS at startup so token verification is ready before first connection."""
    logger.info("WS server starting — fetching JWKS...")
    await fetch_jwks()
    logger.info("WS server ready")
    yield
    logger.info("WS server shutting down")


app = FastAPI(title="EnglishAI WebSocket Server", version="1.0.0", lifespan=lifespan)

app.include_router(router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
