"""Pick the recommended grammar category for the next exercise."""
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.grammar import GrammarExercise, StudentGrammarWeakness


async def pick_category(db: AsyncSession, student_id: UUID) -> str | None:
    """Return the highest-priority category that has no pending (unanswered) exercise.

    Priority = severity × frequency (descending).
    Returns None if no weaknesses exist yet.
    """
    weaknesses_result = await db.execute(
        select(StudentGrammarWeakness)
        .where(StudentGrammarWeakness.student_id == student_id)
        .order_by(
            (StudentGrammarWeakness.severity * StudentGrammarWeakness.frequency).desc()
        )
    )
    weaknesses = weaknesses_result.scalars().all()

    if not weaknesses:
        return None

    # Find categories that already have a pending exercise
    pending_result = await db.execute(
        select(GrammarExercise.category).where(
            and_(
                GrammarExercise.student_id == student_id,
                GrammarExercise.answered_correctly == None,  # noqa: E711
            )
        )
    )
    pending_categories = {row[0] for row in pending_result.all()}

    for weakness in weaknesses:
        if weakness.category not in pending_categories:
            return weakness.category

    # All weaknesses have pending exercises — return the top one anyway
    return weaknesses[0].category if weaknesses else None
