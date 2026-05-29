"""Post-session transcript summarization + Nova Lite analysis Celery task.

Uses synchronous SQLAlchemy + psycopg2 (NOT asyncpg) because Celery prefork
workers run in separate processes and cannot share the FastAPI async engine.

Red Team Fix #7: never use asyncio.run() + async engine inside a Celery task —
sync engine is the correct pattern here.
"""
import logging
from uuid import UUID

import botocore.exceptions
from pydantic import ValidationError

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def summarize_session(self, session_id: str) -> None:  # type: ignore[override]
    """Summarize + analyze session transcript.

    Steps:
    1. Extract heuristic summary (legacy, kept for prompt_builder context injection).
    2. Call Nova Lite for structured analysis.
    3. Persist analysis_results row.
    4. Upsert student_learning_profiles.
    5. Regenerate study_plans.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.config import settings
    from app.db.models.session import Session as SessionModel

    sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_url, pool_pre_ping=True)
    SyncSession = sessionmaker(engine)

    try:
        with SyncSession() as db:
            session = db.get(SessionModel, UUID(session_id))
            if not session:
                logger.warning("summarize_session: session %s not found", session_id)
                return
            if not session.transcript_json:
                logger.info("summarize_session: session %s has no transcript — skipping", session_id)
                return

            # Step 1: heuristic summary (used by prompt_builder for context injection)
            summary = _extract_summary(session.transcript_json)
            session.summary_json = summary
            db.flush()

            # Steps 2-5: Nova Lite analysis pipeline.
            # Retriable errors (Nova parse failure, AWS transient) propagate to Celery retry.
            # Non-retriable bugs (unexpected exceptions) are logged and swallowed so the
            # already-flushed summary_json is still committed.
            try:
                _run_analysis_pipeline(db, session)
            except (ValidationError, ValueError, botocore.exceptions.BotoCoreError) as exc:
                # Retriable: raise so Celery retries up to max_retries
                raise self.retry(exc=exc)
            except Exception as exc:
                logger.error(
                    "summarize_session: analysis pipeline non-retriable failure session=%s: %s",
                    session_id, exc,
                )

            db.commit()
            logger.info("summarize_session: session %s complete", session_id)
    except Exception as exc:
        logger.error("summarize_session failed for session %s: %s", session_id, exc)
        raise self.retry(exc=exc)
    finally:
        engine.dispose()


def _run_analysis_pipeline(db, session) -> None:
    """Run Nova Lite analysis and persist results. Wrapped non-fatally by caller."""
    from app.db.models.learning import AnalysisResult, StudyPlan
    from app.schemas.analysis import AnalysisOutput
    from app.services.analysis import nova_client, transcript_serializer
    from app.services.analysis import profile_updater, study_plan_generator

    # Serialize transcript + extract pre-metrics
    text, pre_metrics = transcript_serializer.serialize(session.transcript_json)
    if not text:
        logger.info("_run_analysis_pipeline: empty transcript for session %s", session.id)
        return

    # Call Nova Lite
    raw = nova_client.analyze_transcript(text)

    # Validate with Pydantic (raises ValidationError → Celery retry)
    validated = AnalysisOutput.model_validate(raw)

    # Merge pre-computed fluency metrics (wpm, avg response length)
    if pre_metrics.get("wpm") is not None:
        raw.setdefault("fluency_metrics", {})["wpm"] = pre_metrics["wpm"]
    if pre_metrics.get("avg_student_words"):
        raw.setdefault("fluency_metrics", {})["avg_response_length_words"] = pre_metrics["avg_student_words"]

    # Persist analysis_results (upsert: delete+insert on re-run for idempotency)
    from sqlalchemy import select, delete
    db.execute(delete(AnalysisResult).where(AnalysisResult.session_id == session.id))
    analysis_row = AnalysisResult(
        session_id=session.id,
        student_id=session.student_id,
        grammar_mistakes=validated.model_dump()["grammar_mistakes"],
        vocab_usage=validated.model_dump()["vocab_usage"],
        fluency_metrics={**validated.model_dump()["fluency_metrics"], **pre_metrics},
        band_estimate=validated.model_dump()["band_estimate"],
        raw_nova_output=raw,
    )
    db.add(analysis_row)
    db.flush()

    # Upsert learning profile
    profile = profile_updater.upsert_profile(
        db,
        student_id=session.student_id,
        analysis=validated.model_dump(),
        pre_metrics=pre_metrics,
    )

    # Regenerate study plan (upsert)
    plan_data = study_plan_generator.generate(profile)
    existing_plan = db.execute(
        select(StudyPlan).where(StudyPlan.student_id == session.student_id)
    ).scalar_one_or_none()
    if existing_plan:
        from datetime import datetime, timezone
        existing_plan.generated_plan = plan_data
        existing_plan.source_analysis_id = analysis_row.id
        existing_plan.generated_at = datetime.now(tz=timezone.utc)
    else:
        db.add(StudyPlan(
            student_id=session.student_id,
            source_analysis_id=analysis_row.id,
            generated_plan=plan_data,
        ))

    # Phase 2: Memory extraction (non-fatal — failure must not abort the analysis)
    try:
        from app.services.analysis import memory_extractor
        from app.services.memory_service import upsert_many_sync

        transcript_text, _ = transcript_serializer.serialize(session.transcript_json)
        if transcript_text:
            facts = memory_extractor.extract(transcript_text, str(session.student_id))
            if facts:
                upsert_many_sync(db, session.student_id, session.id, facts)
                logger.info(
                    "memory_extractor: stored %d facts for student %s",
                    len(facts), session.student_id,
                )
    except Exception as exc:
        logger.error(
            "summarize_session: memory extraction failed (non-fatal): %s", exc
        )

    # Phase 4: Grammar aggregation (non-fatal — failure must not abort analysis)
    try:
        from app.services.grammar.aggregator import aggregate as grammar_aggregate
        grammar_aggregate(db, session.student_id, analysis_row)
        logger.info("grammar_aggregator: processed session %s", session.id)
    except Exception as exc:
        logger.error("summarize_session: grammar aggregation failed (non-fatal): %s", exc)

    # Phase 5: Vocabulary fold (non-fatal)
    try:
        from app.services.vocab.vocab_service import upsert_usage as vocab_upsert
        from app.services.vocab.word_unlock_service import detect_and_award
        vocab_upsert(db, session.student_id, analysis_row)
        awarded = detect_and_award(db, session.student_id, analysis_row)
        if awarded:
            logger.info("word_unlock: awarded for words %s session=%s", awarded, session.id)
    except Exception as exc:
        logger.error("summarize_session: vocab fold failed (non-fatal): %s", exc)


def _extract_summary(transcript: dict) -> dict:
    """Heuristic summary — provides context for prompt_builder session injection."""
    turns: list[dict] = transcript.get("turns", [])
    total = len(turns)

    corrections: list[str] = []
    for turn in turns[-10:]:
        if turn.get("role") == "ASSISTANT":
            text: str = turn.get("text", "")
            if any(kw in text.lower() for kw in ("correct", "actually", "better to say", "should be")):
                corrections.append(text[:120])

    return {
        "summary": f"Session completed with {total} exchanges.",
        "topics_covered": [],
        "corrections_made": corrections,
        "student_strengths": [],
        "areas_to_improve": [],
    }
