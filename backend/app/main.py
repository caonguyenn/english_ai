import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.cognito import fetch_jwks, refresh_jwks_background
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    configure_logging()
    await fetch_jwks()
    refresh_task = asyncio.create_task(refresh_jwks_background())
    yield
    refresh_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(
    title="EnglishAI REST API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins in development, tighten in production
_origins = ["*"] if settings.ENVIRONMENT == "development" else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router)


@app.get("/health", tags=["infra"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
