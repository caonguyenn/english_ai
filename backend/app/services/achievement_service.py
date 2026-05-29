"""Achievement checker — data-driven criteria evaluation."""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.gamification import Achievement, Streak, StudentAchievement
from app.db.models.session import Session


# Evaluator functions: (db, student_id, threshold) -> bool (all async)
async def _eval_session_count(db: AsyncSession, student_id: UUID, threshold: int) -> bool:
    result = await db.execute(
        select(func.count(Session.id)).where(Session.student_id == student_id)
    )
    return (result.scalar() or 0) >= threshold


async def _eval_streak(db: AsyncSession, student_id: UUID, threshold: int) -> bool:
    result = await db.execute(select(Streak).where(Streak.student_id == student_id))
    streak = result.scalar_one_or_none()
    return streak is not None and streak.current_len >= threshold


# Dispatch table — only non-deferred types need real evaluators
EVALUATORS = {
    "session_count": _eval_session_count,
    "streak": _eval_streak,
    # deferred types: mock_test_count, words_spoken, vocab_mastered — skip in checker
}


async def evaluate(db: AsyncSession, student_id: UUID) -> list[StudentAchievement]:
    """Check all non-deferred achievements and insert newly earned ones. Idempotent."""
    # Load already-earned achievement ids
    earned_result = await db.execute(
        select(StudentAchievement.achievement_id).where(StudentAchievement.student_id == student_id)
    )
    earned_ids = set(earned_result.scalars().all())

    # Load all achievements
    all_result = await db.execute(select(Achievement))
    achievements = all_result.scalars().all()

    newly_earned: list[StudentAchievement] = []
    for achievement in achievements:
        if achievement.id in earned_ids:
            continue  # already earned

        criteria = achievement.criteria_json or {}
        if criteria.get("deferred"):
            continue  # not yet active

        crit_type = criteria.get("type")
        threshold = int(criteria.get("threshold", 0))
        evaluator = EVALUATORS.get(crit_type)
        if evaluator is None:
            continue

        try:
            earned = await evaluator(db, student_id, threshold)
        except Exception:
            continue

        if earned:
            sa = StudentAchievement(
                student_id=student_id,
                achievement_id=achievement.id,
                earned_at=datetime.now(tz=timezone.utc),
            )
            db.add(sa)
            newly_earned.append(sa)

    await db.flush()
    return newly_earned


async def list_for_student(db: AsyncSession, student_id: UUID) -> list[dict]:
    """Return all achievements with earned/locked status overlay."""
    earned_result = await db.execute(
        select(StudentAchievement).where(StudentAchievement.student_id == student_id)
    )
    earned_map = {sa.achievement_id: sa.earned_at for sa in earned_result.scalars().all()}

    all_result = await db.execute(select(Achievement).order_by(Achievement.slug))
    achievements = all_result.scalars().all()

    return [
        {
            "id": str(a.id),
            "slug": a.slug,
            "title": a.title,
            "description": a.description,
            "criteria_json": a.criteria_json,
            "earned": a.id in earned_map,
            "earned_at": earned_map.get(a.id),
        }
        for a in achievements
    ]
