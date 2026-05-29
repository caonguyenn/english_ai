"""Unit tests for transcript_serializer — text output and fluency pre-metrics."""
import pytest
from app.services.analysis.transcript_serializer import serialize


def _make_transcript(turns: list[dict]) -> dict:
    return {"turns": turns}


def test_empty_transcript_returns_empty():
    text, metrics = serialize({})
    assert text == ""
    assert metrics["total_turns"] == 0
    assert metrics["wpm"] is None


def test_basic_serialization():
    transcript = _make_transcript([
        {"role": "ASSISTANT", "text": "Hello, how are you?", "ts": 0},
        {"role": "USER", "text": "I am fine thank you.", "ts": 5000},
    ])
    text, metrics = serialize(transcript)
    assert "TUTOR: Hello" in text
    assert "STUDENT: I am fine" in text
    assert metrics["student_turns"] == 1
    assert metrics["total_turns"] == 2


def test_wpm_computed_from_timestamps():
    # 4 words over 30 seconds = 8 wpm
    transcript = _make_transcript([
        {"role": "USER", "text": "one two three four", "ts": 0},
        {"role": "ASSISTANT", "text": "Good.", "ts": 30_000},
    ])
    _, metrics = serialize(transcript)
    assert metrics["wpm"] is not None
    assert metrics["wpm"] > 0


def test_wpm_none_when_no_timestamps():
    transcript = _make_transcript([
        {"role": "USER", "text": "hello world"},
        {"role": "ASSISTANT", "text": "hi"},
    ])
    _, metrics = serialize(transcript)
    assert metrics["wpm"] is None


def test_empty_text_turns_skipped():
    transcript = _make_transcript([
        {"role": "USER", "text": "", "ts": 0},
        {"role": "USER", "text": "real content", "ts": 1000},
    ])
    text, metrics = serialize(transcript)
    assert "real content" in text
    assert metrics["student_turns"] == 1


def test_truncation_prefix_added_when_over_limit():
    long_turn = "word " * 600  # 600 words per turn
    transcript = _make_transcript([
        {"role": "USER", "text": long_turn, "ts": i * 1000}
        for i in range(6)  # 3600 words total, should hit cap
    ])
    text, _ = serialize(transcript)
    assert "truncated" in text


def test_avg_student_words():
    transcript = _make_transcript([
        {"role": "USER", "text": "one two three"},       # 3 words
        {"role": "USER", "text": "four five six seven"}, # 4 words
    ])
    _, metrics = serialize(transcript)
    assert metrics["avg_student_words"] == 3.5
    assert metrics["student_turns"] == 2
