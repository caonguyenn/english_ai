"""WebSocket authentication via Cognito JWKS — first-message auth pattern.

Browser WebSocket API cannot set custom headers, so we accept the connection
first, then wait up to 5 s for the auth message before proceeding.
"""
import asyncio
import json
import logging
from typing import Any

import httpx
from jose import jwt, JWTError
from fastapi import WebSocket

from app.config import settings

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
    """Fetch JWKS from Cognito with 3 retries and exponential backoff.

    Dev fallback: if fetch fails and ENVIRONMENT=development, leaves
    _jwks_cache as None — authenticate_websocket handles the bypass.
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
                await asyncio.sleep(2**attempt)

    if settings.ENVIRONMENT == "development":
        logger.warning(
            "JWKS fetch failed in development mode — "
            "token signature verification disabled."
        )
        return

    raise RuntimeError(
        f"Failed to fetch JWKS after 3 attempts: {last_exc}"
    ) from last_exc


async def authenticate_websocket(websocket: WebSocket) -> dict[str, Any] | None:
    """Wait for first auth message and validate the JWT.

    Expected message: {"type": "auth", "token": "<AccessToken>", "session_id": 42}

    Returns extended JWT payload (claims + "_session_id") on success.
    Closes the connection with code 1008 and returns None on failure.
    """
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
    except asyncio.TimeoutError:
        await websocket.close(code=1008, reason="Auth timeout")
        return None
    except Exception:
        await websocket.close(code=1008, reason="Auth failed")
        return None

    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        await websocket.close(code=1008, reason="Invalid auth message format")
        return None

    if msg.get("type") != "auth" or not msg.get("token"):
        await websocket.close(code=1008, reason="Auth message required")
        return None

    if not msg.get("session_id"):
        await websocket.close(code=1008, reason="session_id required")
        return None

    token: str = msg["token"]

    try:
        payload = _decode_token(token)
    except Exception:
        await websocket.close(code=1008, reason="Auth failed")
        return None

    payload["_session_id"] = msg["session_id"]
    # Store raw token so downstream services (prompt_builder, tool_handler)
    # can call the REST API on behalf of this student.
    payload["_token"] = token
    return payload


def _decode_token(token: str) -> dict[str, Any]:
    """Decode and verify JWT. Dev bypass when _jwks_cache is None."""
    if not _jwks_cache:
        if settings.ENVIRONMENT == "development":
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
        raise RuntimeError("JWKS not cached — server not fully initialized")

    return jwt.decode(
        token,
        _jwks_cache,
        algorithms=["RS256"],
        audience=settings.COGNITO_APP_CLIENT_ID,
        issuer=ISSUER,
        options={"verify_at_hash": False, "verify_exp": True},
    )
