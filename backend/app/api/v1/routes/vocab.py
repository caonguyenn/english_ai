"""Vocabulary read endpoints + internal word-unlock creation."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.db.models.student import Student
from app.db.models.vocab import StudentVocabulary, WordUnlock
from app.schemas.vocab import VocabularyOut, WordUnlockOut

router = APIRouter(tags=["vocab"])


def _assert_own(current: Student, student_id: UUID) -> None:
    if current.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/students/{student_id}/vocabulary", response_model=list[VocabularyOut])
async def get_vocabulary(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[VocabularyOut]:
    _assert_own(current, student_id)
    result = await db.execute(
        select(StudentVocabulary)
        .where(StudentVocabulary.student_id == student_id)
        .order_by(StudentVocabulary.last_used_at.desc())
        .limit(200)
    )
    return [VocabularyOut.model_validate(v) for v in result.scalars().all()]


@router.get("/students/{student_id}/word-unlocks", response_model=list[WordUnlockOut])
async def get_word_unlocks(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[WordUnlockOut]:
    _assert_own(current, student_id)
    result = await db.execute(
        select(WordUnlock)
        .where(WordUnlock.student_id == student_id)
        .order_by(WordUnlock.introduced_at.desc())
        .limit(100)
    )
    return [WordUnlockOut.model_validate(u) for u in result.scalars().all()]
