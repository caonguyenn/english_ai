"""Integration test for the full summarize_session analysis pipeline.

Mocks Nova Lite — tests DB persistence end-to-end with a real sync SQLAlchemy session.
"""
import json
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.models import *  # noqa: F401,F403 — registers all models with Base


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def db_engine():
    sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
    engine = create_engine(sync_url, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture()
def db(db_engine):
    SyncSession = sessionmaker(db_engine)
    with SyncSession() as session:
        yield session
        session.rollback()


@pytest.fixture()
def sample_student(db):
    from app.db.models.student import Student
    student = Student(
        cognito_sub=f"test-sub-analysis-{__import__('uuid').uuid4().hex[:8]}",
        email="analysis_test@example.com",
        name="Analysis Tester",
        xp_total=100,
    )
    db.add(student)
    db.flush()
    return student


@pytest.fixture()
def sample_session(db, sample_student):
    from app.db.models.session import Session as SessionModel, SessionType
    import datetime
    session = SessionModel(
        student_id=sample_student.id,
        session_type=SessionType.class_,
        started_at=datetime.datetime.now(tz=datetime.timezone.utc),
        transcript_json={
            "turns": [
                {"role": "ASSISTANT", "text": "Hello! How are you today?", "ts": 0},
                {"role": "USER", "text": "I am fine. Yesterday I go to the market.", "ts": 5000},
                {"role": "ASSISTANT", "text": "Good! Actually, you should say 'went' — past tense.", "ts": 8000},
                {"role": "USER", "text": "Oh I see. I went to market. Thank you very much.", "ts": 12000},
            ]
        },
    )
    db.add(session)
    db.flush()
    return session


# ---------------------------------------------------------------------------
# Mock Nova response
# ---------------------------------------------------------------------------

_MOCK_NOVA_RESPONSE = {
    "grammar_mistakes": [
        {
            "category": "tense",
            "original": "I go yesterday",
            "corrected": "I went yesterday",
            "severity": "moderate",
            "explanation": "Simple past required for completed past actions",
        }
    ],
    "vocab_usage": [
        {
            "word": "market",
            "cefr_level": "A2",
            "used_correctly": True,
            "mastery_signal": "developing",
        }
    ],
    "fluency_metrics": {
        "coherence_score": 65,
        "discourse_markers": [],
        "self_corrections": 1,
        "avg_response_length_words": 8.0,
    },
    "band_estimate": {
        "overall": 4.5,
        "fluency": 5.0,
        "grammar": 4.0,
        "vocabulary": 5.0,
        "pronunciation": None,
        "estimate_note": "text-derived; pronunciation excluded",
    },
    "strengths": ["attempted self-correction"],
    "weaknesses": ["tense consistency"],
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_analysis_pipeline_persists_results(db, sample_session):
    from app.db.models.learning import AnalysisResult, StudentLearningProfile, StudyPlan
    from app.services.analysis import nova_client, transcript_serializer
    from app.services.analysis import profile_updater, study_plan_generator
    from app.schemas.analysis import AnalysisOutput
    from sqlalchemy import delete

    with patch.object(nova_client, "analyze_transcript", return_value=_MOCK_NOVA_RESPONSE):
        text, pre_metrics = transcript_serializer.serialize(sample_session.transcript_json)
        assert text  # non-empty

        raw = nova_client.analyze_transcript(text)
        validated = AnalysisOutput.model_validate(raw)

        # Persist analysis
        db.execute(delete(AnalysisResult).where(AnalysisResult.session_id == sample_session.id))
        analysis_row = AnalysisResult(
            session_id=sample_session.id,
            student_id=sample_session.student_id,
            grammar_mistakes=validated.model_dump()["grammar_mistakes"],
            vocab_usage=validated.model_dump()["vocab_usage"],
            fluency_metrics={**validated.model_dump()["fluency_metrics"], **pre_metrics},
            band_estimate=validated.model_dump()["band_estimate"],
            raw_nova_output=raw,
        )
        db.add(analysis_row)
        db.flush()

        # Verify row exists
        fetched = db.execute(
            select(AnalysisResult).where(AnalysisResult.session_id == sample_session.id)
        ).scalar_one()
        assert fetched.band_estimate["overall"] == 4.5
        assert fetched.band_estimate["pronunciation"] is None
        assert len(fetched.grammar_mistakes) == 1

        # Upsert profile
        profile = profile_updater.upsert_profile(
            db,
            student_id=sample_session.student_id,
            analysis=validated.model_dump(),
            pre_metrics=pre_metrics,
        )
        assert profile.overall_band == 4.5
        assert profile.sessions_analyzed == 1
        assert "tense" in profile.mistake_frequencies

        # Generate study plan
        plan_data = study_plan_generator.generate(profile)
        assert "focus_areas" in plan_data
        assert plan_data["current_band"] == 4.5
        assert plan_data["target_band"] == 5.0


def test_idempotency_overwrites_previous_analysis(db, sample_session):
    """Re-running analysis on the same session must overwrite, not duplicate."""
    from app.db.models.learning import AnalysisResult
    from app.services.analysis import nova_client, transcript_serializer
    from app.schemas.analysis import AnalysisOutput
    from sqlalchemy import delete, func

    with patch.object(nova_client, "analyze_transcript", return_value=_MOCK_NOVA_RESPONSE):
        for _ in range(2):
            text, _ = transcript_serializer.serialize(sample_session.transcript_json)
            raw = nova_client.analyze_transcript(text)
            validated = AnalysisOutput.model_validate(raw)
            db.execute(delete(AnalysisResult).where(AnalysisResult.session_id == sample_session.id))
            db.add(AnalysisResult(
                session_id=sample_session.id,
                student_id=sample_session.student_id,
                grammar_mistakes=validated.model_dump()["grammar_mistakes"],
                vocab_usage=validated.model_dump()["vocab_usage"],
                fluency_metrics=validated.model_dump()["fluency_metrics"],
                band_estimate=validated.model_dump()["band_estimate"],
                raw_nova_output=raw,
            ))
            db.flush()

    count = db.execute(
        select(func.count(AnalysisResult.id)).where(AnalysisResult.session_id == sample_session.id)
    ).scalar_one()
    assert count == 1


def test_serializer_includes_tutor_lines(sample_session):
    from app.services.analysis.transcript_serializer import serialize
    text, metrics = serialize(sample_session.transcript_json)
    assert "TUTOR:" in text
    assert "STUDENT:" in text
    assert metrics["wpm"] is not None  # timestamps present in fixture
