# Learning Intelligence Specification

## Purpose

The Learning Intelligence System is the core differentiator of EnglishAI.

Its purpose is to continuously analyze student conversations and build a long-term understanding of:

* English proficiency
* Vocabulary mastery
* Grammar weaknesses
* Pronunciation quality
* Fluency development
* Learning interests
* IELTS band progression

Unlike traditional LMS systems, EnglishAI adapts lessons based on actual speaking performance.

---

## Status: Phase 1 Complete

**Phase 1 (Analysis Engine)** delivered 2026-05-29. All components deployed:
- Nova Lite integration via boto3 `converse()` with JSON-schema enforcement
- Transcript serializer + fluency metrics (wpm, hesitation, response length from turn timestamps)
- Rolling student profile updates (EMA for bands, merged strengths/weaknesses)
- Study plan generation (target band, focus areas, daily tips)
- 27/27 unit + integration tests passing; code review fixes applied
- Pending: real-session manual verification (requires live AWS credentials + Celery worker)

Phases 2, 4, 5, 7, 8 now unblocked. Ready for consumer implementation (Phase 2: Feedback UI + Memory).

---

# Architecture

The Learning Intelligence Service runs **post-session** (not live) as a Celery task,
calling **Amazon Nova Lite** via boto3 `converse()` with JSON-schema output. It extends
the existing `backend/app/tasks/summarize.py`. Running after the session (vs. mid-conversation
tool calls) is more accurate, cheaper, and removes tool-timing fragility.

```text
Nova Sonic (live conversation)
    ↓
Transcript (with turn timestamps)
    ↓
Learning Intelligence Service  (post-session · Nova Lite · Celery)
    ├── Grammar Analyzer
    ├── Vocabulary Analyzer
    ├── Fluency Analyzer        (coherence/length from text)
    ├── Band Predictor          (3-skill estimate)
    └── Pronunciation Analyzer  ⏳ DEFERRED — requires audio, not text
    ↓
Analysis Result (persisted) + Student Learning Profile (rolled forward)
```

---

# Student Learning Profile

Each student owns a continuously updated profile.

Example:

```json
{
  "estimated_band": 5.5,
  "target_band": 6.5,

  "fluency_score": 60,
  "grammar_score": 50,
  "vocabulary_score": 65,
  "pronunciation_score": null,

  "strengths": [
    "communication",
    "topic_development"
  ],

  "weaknesses": [
    "past_tense",
    "articles"
  ]
}
```

---

# Grammar Analyzer

Detect:

* Past tense errors
* Article usage
* Subject-verb agreement
* Prepositions
* Conditionals
* Relative clauses

Output:

```json
{
  "category": "past_tense",
  "severity": 8,
  "frequency": 15
}
```

---

# Vocabulary Analyzer

Track:

* New words
* Repeated words
* Academic vocabulary
* IELTS vocabulary

Output:

```json
{
  "word": "sustainable",
  "mastery": 35
}
```

Mastery increases when:

* Used correctly
* Used repeatedly
* Used in multiple contexts

---

# Pronunciation Analyzer ⏳ DEFERRED

> **Not in Phase 1.** Pronunciation is an acoustic property and **cannot be scored
> from a text transcript**. A future audio-based phase will add it, requiring:
> audio archival (S3), a speech-assessment service, and phoneme-level alignment.
> Until then, the band estimate is a 3-skill estimate (fluency/grammar/vocabulary)
> and the UI labels pronunciation "coming soon."

Future scope (audio-based):

* Word accuracy
* Stress patterns
* Speaking clarity
* Mispronounced words

Future output:

```json
{
  "word": "environment",
  "score": 55
}
```

---

# Fluency Analyzer

Track:

* Speaking speed
* Hesitation
* Fillers
* Response length
* Turn-taking

Output:

```json
{
  "wpm": 105,
  "hesitation_rate": 0.12
}
```

---

# Band Predictor

Generate:

* Estimated IELTS Band (text-derived; flagged as estimate)
* Skill breakdown (3 skills — pronunciation excluded until audio phase)
* Confidence score

Output:

```json
{
  "overall": 5.5,
  "fluency": 6,
  "grammar": 5,
  "vocabulary": 6,
  "pronunciation": null,
  "estimate_note": "text-derived; pronunciation excluded (needs audio)"
}
```

---

# Study Plan Generator

Generate weekly plans automatically.

Example:

Week 1

* Past tense practice
* Environment vocabulary
* 15 minutes speaking daily

Week 2

* Articles
* Technology vocabulary
* Mock interview

---

# Analysis Results Storage

Each analyzed session creates an `analysis_results` row (Phase 1) that captures the full
output of the Nova Lite analysis at session-end time. This is separate from the rolling
`student_learning_profiles` which merges insights across multiple sessions.

```json
{
  "id": "UUID",
  "student_id": "UUID",
  "session_id": "UUID",
  
  "grammar_mistakes": [
    {
      "category": "past_tense",
      "original": "I go there yesterday",
      "corrected": "I went there yesterday",
      "severity": 8,
      "frequency": 2
    }
  ],

  "vocabulary_usage": [
    {
      "word": "sustainable",
      "level": "C1",
      "mastery_delta": +10
    }
  ],

  "fluency_metrics": {
    "wpm": 105,
    "hesitation_rate": 0.12,
    "avg_response_length": 42,
    "turn_count": 18
  },

  "band_estimate": {
    "overall": 5.5,
    "fluency": 6,
    "grammar": 5,
    "vocabulary": 6,
    "pronunciation": null,
    "estimate_note": "text-derived; pronunciation excluded (needs audio)"
  },

  "created_at": "2026-05-29T15:30:00Z"
}
```

**Consumers:**
- Phase 2: Feedback UI surfaces grammar mistakes + vocabulary suggestions via REST endpoint
- Phase 4/5: Adaptive Grammar/Vocab agents consume to guide lesson selection
- Phase 7/8: Mock test scoring + weekly reports consume band trends over time
