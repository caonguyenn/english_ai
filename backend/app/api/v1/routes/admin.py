"""Admin routes — student management, session history, audit log."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_admin
from app.db.models.level_audit import LevelAuditLog
from app.db.models.module import Module
from app.db.models.session import Session
from app.db.models.student import Student
from app.schemas.admin import AdminSessionResponse, AdminStudentEdit, AdminStudentResponse
from app.schemas.student import AuditLogEntry
from app.services.student_service import StudentService

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/students", response_model=list[AdminStudentResponse])
async def list_students(
    q: str | None = Query(default=None, description="Search by name or email"),
    module_id: int | None = Query(default=None),
    band_min: float | None = Query(default=None),
    band_max: float | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),  # Red Team Fix #12 — hard cap 100
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[AdminStudentResponse]:
    """List and search students. Paginated, max 100 per page."""
    query = select(Student)
    if q:
        query = query.where(
            Student.name.ilike(f"%{q}%") | Student.email.ilike(f"%{q}%")
        )
    if module_id is not None:
        query = query.where(Student.current_module_id == module_id)
    if band_min is not None:
        query = query.where(Student.placement_band >= band_min)
    if band_max is not None:
        query = query.where(Student.placement_band <= band_max)

    query = query.order_by(Student.id.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    students = result.scalars().all()
    return [AdminStudentResponse.model_validate(s) for s in students]


@router.get("/students/{student_id}", response_model=AdminStudentResponse)
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
) -> AdminStudentResponse:
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return AdminStudentResponse.model_validate(student)


@router.put("/students/{student_id}", response_model=AdminStudentResponse)
async def edit_student(
    student_id: int,
    body: AdminStudentEdit,
    db: AsyncSession = Depends(get_db),
    admin_claims: dict[str, Any] = Depends(require_admin),
) -> AdminStudentResponse:
    """Edit student fields. Writes LevelAuditLog for module changes.

    Red Team Fix #13: existence check + audit log for module change.
    """
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if body.name is not None:
        student.name = body.name

    if body.xp_total is not None:
        student.xp_total = body.xp_total

    if body.current_module_id is not None:
        module = await db.get(Module, body.current_module_id)
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        # Write audit log for admin-initiated module change
        db.add(
            LevelAuditLog(
                student_id=student.id,
                from_module_id=student.current_module_id or body.current_module_id,
                to_module_id=body.current_module_id,
                session_id=None,
                reason_text=f"Admin override by {admin_claims.get('sub', 'unknown')}",
                evidence_json={"admin_sub": admin_claims.get("sub")},
            )
        )
        student.current_module_id = body.current_module_id

    if body.placement_band is not None:
        if not (0.0 <= body.placement_band <= 9.0):
            raise HTTPException(
                status_code=422, detail="placement_band must be between 0.0 and 9.0"
            )
        student.placement_band = body.placement_band

    await db.commit()
    await db.refresh(student)
    return AdminStudentResponse.model_validate(student)


@router.get("/students/{student_id}/sessions", response_model=list[AdminSessionResponse])
async def get_student_sessions(
    student_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[AdminSessionResponse]:
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    result = await db.execute(
        select(Session)
        .where(Session.student_id == student_id)
        .order_by(Session.started_at.desc())
        .offset(offset)
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [AdminSessionResponse.model_validate(s) for s in sessions]


@router.get("/students/{student_id}/audit-log", response_model=list[AuditLogEntry])
async def get_student_audit_log(
    student_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogEntry]:
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return await StudentService.get_audit_log(db, student_id)
