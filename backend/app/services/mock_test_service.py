"""Assemble mock test result from analysis_results + mock_test_results metadata."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.learning import AnalysisResult
from app.db.models.mock_test import MockTestResult
from app.schemas.mock_test import MockTestResultOut


async def get_mock_result(db: AsyncSession, session_id: UUID) -> MockTestResultOut:
    """Read analysis_results for this session and map to IELTS criterion names.

    Returns 'pending' state if Phase 1 analysis has not yet landed.
    """
    # Parallel lookups for analysis and mock metadata
    analysis_row = await db.execute(
        select(AnalysisResult).where(AnalysisResult.session_id == session_id)
    )
    analysis = analysis_row.scalar_one_or_none()

    meta_row = await db.execute(
        select(MockTestResult).where(MockTestResult.session_id == session_id)
    )
    meta = meta_row.scalar_one_or_none()

    if not analysis:
        return MockTestResultOut(session_id=session_id, status="pending")

    band_raw: dict = analysis.band_estimate or {}

    return MockTestResultOut(
        session_id=session_id,
        status="ready",
        band_overall=band_raw.get("overall"),
        # Phase 1 field names → IELTS Speaking criterion names
        fluency_coherence=band_raw.get("fluency"),
        lexical_resource=band_raw.get("vocabulary"),
        grammatical_range_accuracy=band_raw.get("grammar"),
        pronunciation=None,  # deferred — requires separate audio analysis
        parts_completed=meta.parts_completed if meta else None,
        cue_card_topic=meta.cue_card_topic if meta else None,
        premium=True,
    )
