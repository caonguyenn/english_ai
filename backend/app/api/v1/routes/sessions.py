"""Session lifecycle routes — create, patch, scores, level-up."""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db, require_internal
from app.db.models.student import Student
from app.schemas.session import (
    LevelUpRequest,
    MAX_TRANSCRIPT_SIZE,
    SessionCreate,
    SessionPatch,
    SessionResponse,
    SkillScoreCreate,
)
from app.services.level_up_service import LevelUpService
from app.services.session_service import SessionService
from app.services.student_service import StudentService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await SessionService.create(db, student_id=current.id, data=body)
    return SessionResponse.model_validate(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = await SessionService.get(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != current.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return SessionResponse.model_validate(session)


@router.patch("/{session_id}", response_model=SessionResponse)
async def patch_session(
    session_id: int,
    body: SessionPatch,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """End a session. Validates ownership and transcript size.

    Red Team Fix #11: ownership check + 1 MB transcript limit.
    """
    session = await SessionService.get(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != current.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Enforce transcript size limit before persisting
    if body.transcript_json is not None:
        size = len(json.dumps(body.transcript_json).encode("utf-8"))
        if size > MAX_TRANSCRIPT_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"transcript_json exceeds 1 MB limit ({size} bytes)",
            )

    updated = await SessionService.end_session(db, session, body)

    # Fire async summarization — best-effort, never block the response
    if updated.transcript_json:
        try:
            from app.tasks.summarize import summarize_session
            summarize_session.delay(updated.id)
        except Exception:
            # Celery worker not running (common in dev) — skip silently
            pass

    return SessionResponse.model_validate(updated)


@router.post("/{session_id}/scores", status_code=201)
async def add_skill_score(
    session_id: int,
    body: SkillScoreCreate,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Append a skill score to a session. Ownership-checked.

    Red Team Fix #11: verify session belongs to current student.
    """
    session = await SessionService.get(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.student_id != current.id:
        raise HTTPException(status_code=403, detail="Access denied")

    score = await SessionService.add_skill_score(db, session_id=session_id, data=body)
    return {"id": score.id, "session_id": score.session_id, "skill": score.skill, "score": score.score}


@router.post(
    "/{session_id}/level-up",
    include_in_schema=False,  # not exposed in public OpenAPI
    dependencies=[Depends(require_internal)],
)
async def trigger_level_up(
    session_id: int,
    body: LevelUpRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Internal endpoint called by WS server after NovaSonic triggers level-up tool.

    Red Team Fix #9: protected by X-Internal-Secret header (require_internal dependency).
    Student identified by student_sub in body — NOT by auth token.
    """
    from app.db.models.module import Module

    student = await StudentService.get_by_cognito_sub(db, body.student_sub)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Capture from_module_id before validation mutates student
    from_module_id = student.current_module_id

    result = await LevelUpService.validate_and_execute(
        db,
        student=student,
        session_id=session_id,
        reason=body.reason,
        evidence=body.evidence,
    )

    # Enrich approved result with module titles and band for the WS → frontend event
    if result.get("approved"):
        from_module = await db.get(Module, from_module_id) if from_module_id else None
        new_module_id = result.get("new_module_id")
        to_module = await db.get(Module, new_module_id) if new_module_id else None
        result["from_module"] = from_module.title if from_module else ""
        result["to_module"] = to_module.title if to_module else ""
        result["new_band"] = to_module.band_min if to_module else 0

    return result
