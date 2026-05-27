"""Post-session transcript summarization Celery task.

Uses synchronous SQLAlchemy + psycopg2 (NOT asyncpg) because Celery prefork
workers run in separate processes and cannot share the FastAPI async engine.

Red Team Fix #7: never use asyncio.run() + async engine inside a Celery task —
sync engine is the correct pattern here.
"""
import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def summarize_session(self, session_id: int) -> None:  # type: ignore[override]
    """Summarize session transcript and store summary_json.

    Args:
        session_id: PK of the sessions table row to summarize.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.config import settings
    from app.db.models.session import Session as SessionModel

    # Strip asyncpg driver — use plain psycopg2 for sync access
    sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_url, pool_pre_ping=True)
    SyncSession = sessionmaker(engine)

    try:
        with SyncSession() as db:
            session = db.get(SessionModel, session_id)
            if not session:
                logger.warning("summarize_session: session %s not found", session_id)
                return
            if not session.transcript_json:
                logger.info(
                    "summarize_session: session %s has no transcript — skipping",
                    session_id,
                )
                return

            summary = _extract_summary(session.transcript_json)
            session.summary_json = summary
            db.commit()
            logger.info("summarize_session: session %s summarized", session_id)
    except Exception as exc:
        logger.error("summarize_session failed for session %s: %s", session_id, exc)
        raise self.retry(exc=exc)
    finally:
        engine.dispose()


def _extract_summary(transcript: dict) -> dict:
    """MVP heuristic summarization — extract corrections and key info from turns.

    Phase 7+ can replace this with a Bedrock text model call for richer output.
    """
    turns: list[dict] = transcript.get("turns", [])
    total = len(turns)

    corrections: list[str] = []
    for turn in turns[-10:]:  # Focus on last 10 turns for recency
        if turn.get("role") == "ASSISTANT":
            text: str = turn.get("text", "")
            # Simple heuristic: AI references a correction keyword
            if any(kw in text.lower() for kw in ("correct", "actually", "better to say", "should be")):
                corrections.append(text[:120])

    return {
        "summary": f"Session completed with {total} exchanges.",
        "topics_covered": [],
        "corrections_made": corrections,
        "student_strengths": [],
        "areas_to_improve": [],
    }
