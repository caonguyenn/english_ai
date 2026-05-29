"""Unit tests for AnalysisOutput Pydantic schema validation."""
import pytest
from pydantic import ValidationError
from app.schemas.analysis import AnalysisOutput, BandEstimate, GrammarMistake


def _valid_payload() -> dict:
    return {
        "grammar_mistakes": [
            {
                "category": "tense",
                "original": "I go yesterday",
                "corrected": "I went yesterday",
                "severity": "moderate",
                "explanation": "Past tense required",
            }
        ],
        "vocab_usage": [
            {
                "word": "nevertheless",
                "cefr_level": "C1",
                "used_correctly": True,
                "mastery_signal": "secure",
            }
        ],
        "fluency_metrics": {
            "coherence_score": 72,
            "discourse_markers": ["however", "therefore"],
            "self_corrections": 2,
            "avg_response_length_words": 18.5,
        },
        "band_estimate": {
            "overall": 5.5,
            "fluency": 6.0,
            "grammar": 5.0,
            "vocabulary": 6.0,
            "pronunciation": None,
            "estimate_note": "text-derived; pronunciation excluded",
        },
        "strengths": ["good vocabulary range"],
        "weaknesses": ["tense consistency"],
    }


def test_valid_payload_parses():
    result = AnalysisOutput.model_validate(_valid_payload())
    assert result.band_estimate.overall == 5.5
    assert result.band_estimate.pronunciation is None
    assert len(result.grammar_mistakes) == 1


def test_band_rounds_to_half_increment():
    payload = _valid_payload()
    payload["band_estimate"]["overall"] = 5.3  # should round to 5.5
    result = AnalysisOutput.model_validate(payload)
    assert result.band_estimate.overall == 5.5


def test_pronunciation_always_null():
    payload = _valid_payload()
    payload["band_estimate"]["pronunciation"] = None
    result = AnalysisOutput.model_validate(payload)
    assert result.band_estimate.pronunciation is None


def test_invalid_severity_raises():
    payload = _valid_payload()
    payload["grammar_mistakes"][0]["severity"] = "severe"  # invalid
    with pytest.raises(ValidationError):
        AnalysisOutput.model_validate(payload)


def test_band_out_of_range_raises():
    payload = _valid_payload()
    payload["band_estimate"]["overall"] = 10.0  # > 9
    with pytest.raises(ValidationError):
        AnalysisOutput.model_validate(payload)


def test_empty_mistakes_and_vocab_allowed():
    payload = _valid_payload()
    payload["grammar_mistakes"] = []
    payload["vocab_usage"] = []
    result = AnalysisOutput.model_validate(payload)
    assert result.grammar_mistakes == []


def test_missing_required_field_raises():
    payload = _valid_payload()
    del payload["fluency_metrics"]
    with pytest.raises(ValidationError):
        AnalysisOutput.model_validate(payload)
