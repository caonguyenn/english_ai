"""Gamification read endpoints — streak and achievements."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.db.models.gamification import Streak
from app.db.models.student import Student
from app.schemas.gamification import AchievementOut, StreakOut
from app.services import achievement_service

router = APIRouter(tags=["gamification"])


def _assert_own(current: Student, student_id: UUID) -> None:
    if current.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/students/{student_id}/streak", response_model=StreakOut)
async def get_streak(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> StreakOut:
    _assert_own(current, student_id)
    result = await db.execute(select(Streak).where(Streak.student_id == student_id))
    streak = result.scalar_one_or_none()
    if not streak:
        return StreakOut(student_id=student_id, current_len=0, longest_len=0, last_active_date=None)
    return StreakOut(
        student_id=student_id,
        current_len=streak.current_len,
        longest_len=streak.longest_len,
        last_active_date=streak.last_active_date,
    )


@router.get("/students/{student_id}/achievements", response_model=list[AchievementOut])
async def get_achievements(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[AchievementOut]:
    _assert_own(current, student_id)
    items = await achievement_service.list_for_student(db, student_id)
    return [AchievementOut(**item) for item in items]
