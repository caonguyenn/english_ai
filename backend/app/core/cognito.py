"""JWKS fetch (cached at startup) + Cognito JWT verification."""
import asyncio
import logging
from typing import Any

import httpx
from jose import jwt, JWTError
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

JWKS_URL = (
    f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com"
    f"/{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
)
ISSUER = (
    f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com"
    f"/{settings.COGNITO_USER_POOL_ID}"
)

_jwks_cache: dict[str, Any] | None = None


async def fetch_jwks() -> None:
    """Fetch JWKS with 3 retries and exponential backoff.

    Dev fallback: if Cognito is not configured and ENVIRONMENT=development,
    logs a warning and leaves _jwks_cache as None — verify_token handles this.
    """
    global _jwks_cache
    last_exc: Exception | None = None

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(JWKS_URL)
                resp.raise_for_status()
                _jwks_cache = resp.json()
                logger.info("JWKS fetched and cached successfully")
                return
        except Exception as exc:
            last_exc = exc
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)

    # All retries exhausted
    if settings.ENVIRONMENT == "development":
        logger.warning(
            "JWKS fetch failed in development mode — token signature verification disabled. "
            "Set COGNITO_USER_POOL_ID correctly to enable full auth."
        )
        return

    raise RuntimeError(f"Failed to fetch JWKS after 3 attempts: {last_exc}") from last_exc


async def refresh_jwks_background() -> None:
    """Refresh JWKS every 24 h to handle Cognito key rotation."""
    while True:
        await asyncio.sleep(86_400)
        try:
            await fetch_jwks()
        except Exception as exc:
            # Keep stale cache rather than crash — next refresh will retry
            logger.error("Background JWKS refresh failed: %s", exc)


def verify_token(token: str) -> dict[str, Any]:
    """Verify a Cognito AccessToken or IdToken.

    Returns the decoded JWT payload.

    Dev bypass: when _jwks_cache is None and ENVIRONMENT=development,
    decodes the token WITHOUT signature verification so local dev works
    without a real Cognito pool. NEVER reachable in production because
    fetch_jwks raises on startup if JWKS cannot be loaded.
    """
    if not _jwks_cache:
        if settings.ENVIRONMENT == "development":
            try:
                return jwt.decode(
                    token,
                    key=None,  # type: ignore[arg-type]
                    algorithms=["RS256"],
                    options={
                        "verify_signature": False,
                        "verify_exp": False,
                        "verify_aud": False,
                    },
                )
            except JWTError as exc:
                raise HTTPException(status_code=401, detail="Invalid token format") from exc
        raise RuntimeError("JWKS not cached — server not fully initialized")

    try:
        return jwt.decode(
            token,
            _jwks_cache,
            algorithms=["RS256"],
            audience=settings.COGNITO_APP_CLIENT_ID,
            issuer=ISSUER,
            options={"verify_at_hash": False, "verify_exp": True},
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
