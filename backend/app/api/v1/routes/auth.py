"""Auth routes — register, me, confirm-placement."""
import base64
import json
import time
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_student, get_db, get_token_claims
from app.db.models.module import Module
from app.db.models.student import Student
from app.schemas.auth import ConfirmPlacementRequest, StudentProfile
from app.services.student_service import StudentService

router = APIRouter(prefix="/auth", tags=["auth"])


class DevLoginResponse(BaseModel):
    access_token: str
    profile: StudentProfile


def _make_dev_token(sub: str, email: str) -> str:
    """Build a fake unsigned JWT accepted by verify_token in development mode."""
    header = base64.urlsafe_b64encode(
        json.dumps({"alg": "RS256", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(
        json.dumps({
            "sub": sub,
            "email": email,
            "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DEV",
            "exp": int(time.time()) + 86400 * 7,
            "iat": int(time.time()),
        }).encode()
    ).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(b"devsig").rstrip(b"=").decode()
    return f"{header}.{payload}.{sig}"


@router.post("/dev-login", response_model=DevLoginResponse)
async def dev_login(db: AsyncSession = Depends(get_db)) -> DevLoginResponse:
    """Dev-only: create (or fetch) a test student + return a usable access token.
    Blocked in production."""
    if settings.ENVIRONMENT != "development":
        raise HTTPException(status_code=403, detail="Dev login not available in production")

    dev_sub = "dev-student-00000000"
    student = await StudentService.get_by_cognito_sub(db, dev_sub)
    if not student:
        try:
            student = await StudentService.create_from_token(
                db, sub=dev_sub, email="dev@example.com", name="Dev Student",
            )
        except IntegrityError:
            await db.rollback()
            student = await StudentService.get_by_cognito_sub(db, dev_sub)

    if not student:
        raise HTTPException(status_code=500, detail="Failed to create dev student")

    token = _make_dev_token(dev_sub, "dev@example.com")
    return DevLoginResponse(access_token=token, profile=StudentProfile.model_validate(student))


@router.post("/register", response_model=StudentProfile, status_code=201)
async def register(
    db: AsyncSession = Depends(get_db),
    claims: dict[str, Any] = Depends(get_token_claims),
) -> StudentProfile:
    """Create student row from Cognito JWT claims. Idempotent — safe to call multiple times."""
    existing = await StudentService.get_by_cognito_sub(db, claims["sub"])
    if existing:
        return StudentProfile.model_validate(existing)

    try:
        student = await StudentService.create_from_token(
            db,
            sub=claims["sub"],
            email=claims.get("email", ""),
            name=claims.get("name"),
        )
    except IntegrityError:
        # Race condition: two simultaneous register calls — re-fetch
        await db.rollback()
        student = await StudentService.get_by_cognito_sub(db, claims["sub"])
        if not student:
            raise HTTPException(status_code=500, detail="Registration failed")

    return StudentProfile.model_validate(student)


@router.get("/me", response_model=StudentProfile)
async def get_me(
    current: Student = Depends(get_current_student),
) -> StudentProfile:
    """Return authenticated student profile. No side effects."""
    return StudentProfile.model_validate(current)


@router.post("/confirm-placement", status_code=200)
async def confirm_placement(
    body: ConfirmPlacementRequest,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Set module and placement band after placement session completes.

    Red Team Fix #1: re-fetch student in THIS db session (current may be detached).
    Red Team Fix #5: idempotency guard — 409 if already completed.
    """
    student = await db.get(Student, current.id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.placement_completed_at is not None:
        raise HTTPException(status_code=409, detail="Placement already completed")

    module = await db.get(Module, body.module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not (0.0 <= body.placement_band <= 9.0):
        raise HTTPException(
            status_code=422, detail="placement_band must be between 0.0 and 9.0"
        )

    student.current_module_id = body.module_id
    student.placement_band = body.placement_band
    student.placement_completed_at = datetime.now(tz=timezone.utc)
    await db.commit()

    return {"status": "ok"}
