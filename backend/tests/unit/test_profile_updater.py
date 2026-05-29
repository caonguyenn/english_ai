"""Unit tests for profile_updater rolling average logic (no DB)."""
from app.services.analysis.profile_updater import _ema, _merge_list, _merge_mistake_frequencies, _merge_vocab_mastery


def test_ema_first_value():
    assert _ema(None, 5.5) == 5.5


def test_ema_blends():
    # alpha=0.3: 0.3*6 + 0.7*5 = 1.8 + 3.5 = 5.3
    result = _ema(5.0, 6.0)
    assert result == 5.3


def test_ema_caps_precision():
    result = _ema(5.123456, 6.0)
    assert len(str(result).split(".")[-1]) <= 2


def test_merge_list_deduplicates():
    result = _merge_list(["a", "b"], ["b", "c"])
    assert result == ["a", "b", "c"]


def test_merge_list_caps_at_max():
    existing = [str(i) for i in range(8)]
    new_items = ["x", "y", "z"]
    result = _merge_list(existing, new_items, max_items=10)
    assert len(result) == 10


def test_merge_list_handles_none():
    result = _merge_list(None, ["a", "b"])
    assert result == ["a", "b"]


def test_merge_mistake_frequencies_accumulates():
    existing = {"tense": 2, "article": 1}
    mistakes = [
        {"category": "tense", "original": "", "corrected": "", "severity": "minor"},
        {"category": "preposition", "original": "", "corrected": "", "severity": "minor"},
    ]
    result = _merge_mistake_frequencies(existing, mistakes)
    assert result["tense"] == 3
    assert result["preposition"] == 1
    assert result["article"] == 1


def test_merge_mistake_frequencies_from_empty():
    result = _merge_mistake_frequencies(None, [{"category": "tense", "original": "", "corrected": "", "severity": "minor"}])
    assert result == {"tense": 1}


def test_merge_vocab_mastery_increments():
    existing = {"nevertheless": 2}
    vocab = [{"word": "nevertheless", "cefr_level": "C1", "used_correctly": True, "mastery_signal": "secure"}]
    result = _merge_vocab_mastery(existing, vocab)
    assert result["nevertheless"] == 5  # 2 + 3 (secure)


def test_merge_vocab_mastery_skips_incorrect():
    vocab = [{"word": "serendipity", "cefr_level": "C2", "used_correctly": False, "mastery_signal": "emerging"}]
    result = _merge_vocab_mastery(None, vocab)
    assert "serendipity" not in result
