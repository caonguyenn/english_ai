"""Student CRUD routes — profile, progress, history, audit log."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.db.models.student import Student
from app.schemas.auth import StudentProfile
from app.schemas.student import AuditLogEntry, StudentHistory, StudentProgress, StudentUpdate
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["students"])


def _assert_own(current: Student, student_id: UUID) -> None:
    if current.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/{student_id}", response_model=StudentProfile)
async def get_student(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> StudentProfile:
    _assert_own(current, student_id)
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentProfile.model_validate(student)


@router.put("/{student_id}", response_model=StudentProfile)
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> StudentProfile:
    _assert_own(current, student_id)
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    updated = await StudentService.update(db, student, name=body.name)
    return StudentProfile.model_validate(updated)


@router.get("/{student_id}/progress", response_model=StudentProgress)
async def get_progress(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> StudentProgress:
    _assert_own(current, student_id)
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return await StudentService.get_progress(db, student)


@router.get("/{student_id}/audit-log", response_model=list[AuditLogEntry])
async def get_audit_log(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogEntry]:
    _assert_own(current, student_id)
    return await StudentService.get_audit_log(db, student_id)


@router.get("/{student_id}/history", response_model=list[StudentHistory])
async def get_history(
    student_id: UUID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[StudentHistory]:
    _assert_own(current, student_id)
    return await StudentService.get_history(db, student_id, limit=limit, offset=offset)
