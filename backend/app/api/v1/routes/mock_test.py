"""Mock test result endpoint."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.db.models.session import Session as SessionModel
from app.db.models.student import Student
from app.schemas.mock_test import MockTestResultOut
from app.services.mock_test_service import get_mock_result

router = APIRouter(tags=["mock-test"])


def _assert_own(current: Student, student_id: UUID) -> None:
    if current.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/sessions/{session_id}/mock-result", response_model=MockTestResultOut)
async def get_mock_test_result(
    session_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> MockTestResultOut:
    """Return mock test results for a completed mock_test session.

    Returns status='pending' if Phase 1 analysis has not yet completed.
    """
    session = await db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_own(current, session.student_id)
    return await get_mock_result(db, session_id)
