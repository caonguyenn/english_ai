"""Orchestrate weakness queries, exercise creation, and grading."""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.grammar import GrammarExercise, StudentGrammarWeakness
from app.db.models.student import Student
from app.services.grammar.decision_engine import pick_category
from app.services.grammar.exercise_generator import generate


async def list_weaknesses(db: AsyncSession, student_id: UUID) -> list[StudentGrammarWeakness]:
    """Return weaknesses ordered by priority (severity × frequency desc)."""
    result = await db.execute(
        select(StudentGrammarWeakness)
        .where(StudentGrammarWeakness.student_id == student_id)
        .order_by(
            desc(StudentGrammarWeakness.severity * StudentGrammarWeakness.frequency)
        )
    )
    return list(result.scalars().all())


async def create_exercise(db: AsyncSession, student_id: UUID, band: float | None) -> GrammarExercise | None:
    """Select top category, generate exercise, persist, return (without answer key)."""
    category = await pick_category(db, student_id)
    if category is None:
        return None

    payload = generate(category, band)
    exercise = GrammarExercise(
        student_id=student_id,
        category=category,
        question_json=payload.model_dump(),  # stores answer key server-side
    )
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    return exercise


async def grade_answer(
    db: AsyncSession, exercise: GrammarExercise, selected: str, student: Student
) -> dict:
    """Grade the answer, award XP on correct, return result."""
    if exercise.answered_correctly is not None:
        # Already answered — idempotent
        correct_option = exercise.question_json["answer"]
        return {
            "correct": exercise.answered_correctly,
            "correct_option": correct_option,
            "explanation": exercise.question_json.get("explanation", ""),
            "xp_awarded": 0,
        }

    correct_option = exercise.question_json["answer"]
    is_correct = selected.upper() == correct_option.upper()

    exercise.answered_correctly = is_correct
    exercise.answered_at = datetime.now(tz=timezone.utc)
    xp_awarded = 0

    if is_correct:
        from app.core.config import settings
        base_xp = getattr(settings, "GRAMMAR_BASE_XP", 10)
        multiplier = getattr(settings, "RECOMMENDED_XP_MULTIPLIER", 2.0)
        xp_awarded = int(base_xp * multiplier)
        student.xp_total = (student.xp_total or 0) + xp_awarded

    await db.commit()
    await db.refresh(exercise)

    return {
        "correct": is_correct,
        "correct_option": correct_option,
        "explanation": exercise.question_json.get("explanation", ""),
        "xp_awarded": xp_awarded,
    }
