"""Grammar practice endpoints."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_student, get_db
from app.db.models.grammar import GrammarExercise, StudentGrammarWeakness
from app.db.models.student import Student
from app.schemas.grammar import GrammarAnswerIn, GrammarAnswerResult, GrammarExerciseOut, GrammarWeaknessOut
from app.services.grammar import grammar_service

router = APIRouter(tags=["grammar"])


def _assert_own(current: Student, student_id: UUID) -> None:
    if current.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")


def _exercise_to_out(exercise: GrammarExercise) -> GrammarExerciseOut:
    """Convert exercise to client response — strip answer key."""
    q = exercise.question_json or {}
    return GrammarExerciseOut(
        id=exercise.id,
        student_id=exercise.student_id,
        category=exercise.category,
        prompt=q.get("prompt", ""),
        options=q.get("options", {}),
        answered_correctly=exercise.answered_correctly,
        created_at=exercise.created_at,
    )


@router.get("/students/{student_id}/grammar-weaknesses", response_model=list[GrammarWeaknessOut])
async def get_grammar_weaknesses(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[GrammarWeaknessOut]:
    _assert_own(current, student_id)
    weaknesses = await grammar_service.list_weaknesses(db, student_id)
    return [GrammarWeaknessOut.model_validate(w) for w in weaknesses]


@router.post("/students/{student_id}/grammar-exercises", response_model=GrammarExerciseOut | None)
async def create_grammar_exercise(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> GrammarExerciseOut | None:
    _assert_own(current, student_id)
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    from app.db.models.learning import StudentLearningProfile
    profile_result = await db.execute(
        select(StudentLearningProfile).where(StudentLearningProfile.student_id == student_id)
    )
    profile = profile_result.scalar_one_or_none()
    band = profile.overall_band if profile else None

    exercise = await grammar_service.create_exercise(db, student_id, band)
    if exercise is None:
        return None
    return _exercise_to_out(exercise)


@router.post("/grammar-exercises/{exercise_id}/answer", response_model=GrammarAnswerResult)
async def answer_grammar_exercise(
    exercise_id: UUID,
    body: GrammarAnswerIn,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> GrammarAnswerResult:
    exercise = await db.get(GrammarExercise, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    if exercise.student_id != current.id:
        raise HTTPException(status_code=403, detail="Access denied")

    student = await db.get(Student, current.id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    result = await grammar_service.grade_answer(db, exercise, body.selected, student)
    return GrammarAnswerResult(**result)
