"""FastAPI dependency functions for DB sessions and auth."""
from typing import Any, AsyncGenerator

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cognito import verify_token
from app.core.config import settings
from app.db.session import async_session
from app.db.models.student import Student


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session; always closes on exit."""
    async with async_session() as session:
        yield session


async def get_token_claims(request: Request) -> dict[str, Any]:
    """Extract and verify Bearer token; return JWT claims without a DB lookup.

    Used for routes where the student row may not exist yet (e.g. first-login
    / registration flow) or where we only need the sub/groups claim.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    try:
        return verify_token(auth[7:])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_student(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Student:
    """Verify Bearer token and return the Student ORM row.

    Raises 401 if token is missing/invalid, 404 if student row does not exist.
    """
    claims = await get_token_claims(request)
    sub: str = claims.get("sub", "")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

    result = await db.execute(select(Student).where(Student.cognito_sub == sub))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


async def require_admin(request: Request) -> dict[str, Any]:
    """Verify Bearer token and assert membership in the 'admin' Cognito group."""
    claims = await get_token_claims(request)
    groups: list[str] = claims.get("cognito:groups", [])
    if "admin" not in groups:
        raise HTTPException(status_code=403, detail="Admin access required")
    return claims


def require_internal(request: Request) -> None:
    """Validate the X-Internal-Secret header for service-to-service calls."""
    secret = request.headers.get("X-Internal-Secret", "")
    if not secret or secret != settings.INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Invalid internal secret")
