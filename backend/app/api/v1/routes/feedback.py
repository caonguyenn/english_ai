"""Feedback read endpoints — learning profile, per-session analysis, and memory list."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_student, get_db
from app.db.models.learning import AnalysisResult, StudentLearningProfile
from app.db.models.memory import StudentMemory
from app.db.models.session import Session as SessionModel
from app.db.models.student import Student
from app.schemas.feedback import (
    AnalysisOut,
    BandEstimate,
    FluencyMetrics,
    GrammarMistakeItem,
    MemoryOut,
    ProfileOut,
    VocabItem,
)

router = APIRouter(tags=["feedback"])


def _assert_own(current: Student, student_id: UUID) -> None:
    if current.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/students/{student_id}/profile", response_model=ProfileOut)
async def get_student_profile(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> ProfileOut:
    _assert_own(current, student_id)
    result = await db.execute(
        select(StudentLearningProfile).where(StudentLearningProfile.student_id == student_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return ProfileOut(student_id=student_id, status="pending")
    return ProfileOut(
        student_id=student_id,
        status="ready",
        overall_band=profile.overall_band,
        fluency_band=profile.fluency_band,
        grammar_band=profile.grammar_band,
        vocabulary_band=profile.vocabulary_band,
        strengths=profile.strengths or [],
        weaknesses=profile.weaknesses or [],
        sessions_analyzed=profile.sessions_analyzed,
        updated_at=profile.updated_at,
    )


@router.get("/sessions/{session_id}/analysis", response_model=AnalysisOut)
async def get_session_analysis(
    session_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> AnalysisOut:
    session = await db.get(SessionModel, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_own(current, session.student_id)

    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.session_id == session_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        return AnalysisOut(session_id=session_id, status="pending")

    # Parse grammar_mistakes — field names vary between Nova Lite tool schema and storage
    raw_grammar: list = analysis.grammar_mistakes or []
    grammar_items: list[GrammarMistakeItem] = []
    for item in raw_grammar:
        if isinstance(item, dict):
            grammar_items.append(GrammarMistakeItem(
                original=item.get("original", item.get("error", "")),
                corrected=item.get("corrected", item.get("correction", "")),
                reason=item.get("reason", item.get("explanation", "")),
                category=item.get("category"),
                severity=item.get("severity"),
            ))

    # Parse vocab_usage
    raw_vocab: list = analysis.vocab_usage or []
    vocab_items: list[VocabItem] = []
    for item in raw_vocab:
        if isinstance(item, dict):
            vocab_items.append(VocabItem(
                word=item.get("word", ""),
                frequency=item.get("frequency"),
            ))

    # Parse fluency_metrics
    fluency_raw: dict = analysis.fluency_metrics or {}
    fluency = FluencyMetrics(
        wpm=fluency_raw.get("wpm"),
        avg_response_length_words=fluency_raw.get("avg_response_length_words"),
        filler_count=fluency_raw.get("filler_count"),
    )

    # Parse band_estimate
    band_raw: dict = analysis.band_estimate or {}
    band = BandEstimate(
        fluency=band_raw.get("fluency"),
        grammar=band_raw.get("grammar"),
        vocabulary=band_raw.get("vocabulary"),
        overall=band_raw.get("overall"),
    )

    return AnalysisOut(
        session_id=session_id,
        status="ready",
        grammar_mistakes=grammar_items,
        vocab_usage=vocab_items,
        fluency_metrics=fluency,
        band_estimate=band,
        created_at=analysis.created_at,
    )


@router.get("/students/{student_id}/memories", response_model=list[MemoryOut])
async def get_student_memories(
    student_id: UUID,
    current: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[MemoryOut]:
    _assert_own(current, student_id)
    threshold: int = getattr(settings, "MEMORY_INJECT_MIN_CONFIDENCE", 60)
    result = await db.execute(
        select(StudentMemory)
        .where(
            StudentMemory.student_id == student_id,
            StudentMemory.confidence_score >= threshold,
        )
        .order_by(StudentMemory.confidence_score.desc())
        .limit(20)
    )
    memories = result.scalars().all()
    return [MemoryOut.model_validate(m) for m in memories]
