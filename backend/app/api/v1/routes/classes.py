"""Class-level endpoints — stage definitions."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.schemas.lesson_stage import LessonStagesOut
from app.services.lesson_stage_service import get_stages

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("/{class_id}/stages", response_model=LessonStagesOut)
async def get_class_stages(
    class_id: UUID,
    current=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> LessonStagesOut:
    return await get_stages(db, class_id)
