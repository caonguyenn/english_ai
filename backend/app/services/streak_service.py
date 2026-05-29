"""Streak logic — pure date-delta helper + DB touch."""
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.gamification import Streak


def compute_streak(
    current_len: int,
    longest_len: int,
    last_date: date | None,
    today: date,
) -> tuple[int, int]:
    """Pure function: given existing streak state + today, return (new_current, new_longest).

    Rules:
    - same day as last_active_date → no-op (return unchanged)
    - consecutive day → current_len + 1
    - gap → reset to 1
    Always update longest if current exceeds it.
    """
    if last_date == today:
        return current_len, longest_len
    if last_date is not None:
        delta = (today - last_date).days
        new_current = current_len + 1 if delta == 1 else 1
    else:
        new_current = 1
    new_longest = max(longest_len, new_current)
    return new_current, new_longest


async def touch(db: AsyncSession, student_id: UUID) -> Streak:
    """Update (or create) the student's streak row. Call after any session completion."""
    today = datetime.now(tz=timezone.utc).date()
    result = await db.execute(select(Streak).where(Streak.student_id == student_id))
    streak = result.scalar_one_or_none()

    if streak is None:
        streak = Streak(student_id=student_id, current_len=1, longest_len=1, last_active_date=today)
        db.add(streak)
    else:
        new_current, new_longest = compute_streak(
            streak.current_len, streak.longest_len, streak.last_active_date, today
        )
        streak.current_len = new_current
        streak.longest_len = new_longest
        streak.last_active_date = today

    await db.flush()
    return streak
