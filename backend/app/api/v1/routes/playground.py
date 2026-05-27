"""Playground topic listing route."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.db.models.playground_topic import PlaygroundTopic
from app.db.models.student import Student
from app.schemas.module import PlaygroundTopicResponse

router = APIRouter(prefix="/playground", tags=["playground"])


@router.get("/topics", response_model=list[PlaygroundTopicResponse])
async def list_topics(
    _: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[PlaygroundTopicResponse]:
    result = await db.execute(
        select(PlaygroundTopic).order_by(PlaygroundTopic.title.asc())
    )
    topics = result.scalars().all()
    return [PlaygroundTopicResponse.model_validate(t) for t in topics]
