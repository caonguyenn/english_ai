# Phase 1 — Analysis Engine (Nova Lite) ★ KEYSTONE

## Context Links
- Plan overview: [plan.md](plan.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Nova research: [researcher-260529-0407-amazon-nova-text-analysis.md](../reports/researcher-260529-0407-amazon-nova-text-analysis.md)
- Spec: docs/learning-intelligence.md, docs/database-learning-model.md

## Overview
- **Priority:** P1 (KEYSTONE — unblocks Phases 2, 4, 5, 7, 8)
- **Status:** complete ✓
- **Depends on:** Phase 0
- **Effort:** ~30h
- **Description:** Post-session transcript analysis. Take a completed session's transcript, call Amazon Nova Lite, and produce structured JSON: grammar mistakes, vocabulary usage, fluency metrics, and a 3-skill IELTS band estimate. Persist into `student_learning_profiles` + `analysis_results`. Generate/update `study_plans`.

**Completed:** 2026-05-29 — All implementation, testing (27/27 pass), and code review fixes deployed. Pending real-session manual verification (requires live AWS credentials + running Celery worker).

## Key Insights
- **Decoupling from live session removes the tool-timing fragility** that crashed placement (model calling tools mid-conversation).
- Existing `backend/app/tasks/summarize.py` is the home — it already fires on session end, uses the correct **sync SQLAlchemy + psycopg2** Celery pattern, and its docstring says "Phase 7+ can replace this with a Bedrock text model call."
- **Nova Lite** (`amazon.nova-lite-v1:0`) via **boto3 `bedrock-runtime` `converse()`** — request/response, NOT the Smithy streaming SDK. 10-15x cheaper than Pro, sufficient for 2-4k-token transcripts.
- **JSON-schema output** enforced via converse() output config / tool-use; validate with Pydantic; Celery retries 3x on parse failure.
- **Pronunciation excluded** — band is a 3-skill estimate (fluency/grammar/vocabulary), flagged as text-derived.

## Requirements
### Functional
1. On session end (transcript present), run analysis as a Celery task.
2. Call Nova Lite with an IELTS-examiner analyzer system prompt + the transcript.
3. Return + persist structured analysis: grammar mistakes (category, original, corrected, severity, frequency), vocab usage (word, level, mastery delta), fluency (wpm from timestamps, hesitation, response length, turn-taking), band estimate (overall + fluency/grammar/vocabulary).
4. Upsert `student_learning_profiles` (rolling scores, strengths, weaknesses).
5. Write per-session `analysis_results` row.
6. Generate/refresh `study_plans` (decision: on-demand after each analyzed session).
### Non-Functional
- Idempotent per session (re-run overwrites that session's analysis_results, re-upserts profile deltas safely).
- Token-capped transcript input; one analysis per session (never per turn).
- AWS creds via existing env resolver pattern.

## Architecture
```
session ends → PATCH /sessions/{id} stores transcript_json (+ts per turn, from Phase 0)
  → summarize_session.delay(session_id)   [existing Celery task, extended]
      → load transcript (sync session)
      → boto3.client("bedrock-runtime").converse(
            modelId="amazon.nova-lite-v1:0",
            system=[{text: ANALYZER_PROMPT}],
            messages=[{role:"user", content:[{text: serialized_transcript}]}],
            <JSON schema / toolConfig forcing structured output>)
      → parse JSON → Pydantic validate (retry on fail)
      → write analysis_results
      → upsert student_learning_profiles (weighted rolling update)
      → regenerate study_plans
```

### New module split (keep files < 200 lines, DRY)
- `backend/app/services/analysis/` package:
  - `nova_client.py` — boto3 converse() wrapper + schema definition
  - `analyzer_prompt.py` — IELTS-examiner system prompt (pure data)
  - `transcript_serializer.py` — transcript_json → compact text, computes wpm/turn metrics from `ts`
  - `profile_updater.py` — upsert student_learning_profiles (rolling-average logic)
  - `study_plan_generator.py` — build generated_plan JSON
- `backend/app/tasks/summarize.py` — orchestrates the above (calls into analysis package)

### Schemas / models
- New models: `student_learning_profiles`, `analysis_results`, `study_plans` (UUID PKs per Phase 0).
- Pydantic schema mirroring Nova's JSON output (`AnalysisResult`) — used both to force schema and to validate.

### Band estimate JSON (3-skill)
```json
{ "overall": 5.5, "fluency": 6, "grammar": 5, "vocabulary": 6,
  "pronunciation": null, "estimate_note": "text-derived; pronunciation excluded" }
```

## Related Code Files
### Create
- `backend/app/db/models/learning.py` (3 new models)
- `backend/app/services/analysis/__init__.py`, `nova_client.py`, `analyzer_prompt.py`, `transcript_serializer.py`, `profile_updater.py`, `study_plan_generator.py`
- `backend/app/schemas/analysis.py`
- Alembic migration for 3 tables
- Tests: `backend/tests/unit/test_analysis_*.py`, `backend/tests/integration/test_summarize_analysis.py`
### Modify
- `backend/app/tasks/summarize.py` (call analysis pipeline)
- `backend/app/db/models/__init__.py` (register new models for Alembic)
- `backend/requirements.txt` (boto3 if not already present)
- `backend/app/core/config.py` (add `NOVA_ANALYSIS_MODEL_ID=amazon.nova-lite-v1:0`)

## Implementation Steps
1. Add 3 models (UUID PKs/FKs) + register in `__init__.py`; autogenerate migration; upgrade.
2. Add `NOVA_ANALYSIS_MODEL_ID` to config.
3. Build `nova_client.py`: boto3 `converse()` call with JSON-schema/tool output; return parsed dict.
4. Write `analyzer_prompt.py` IELTS-examiner prompt (grammar/vocab/fluency/band; explicit "exclude pronunciation").
5. `transcript_serializer.py`: turns → compact text; compute wpm + hesitation + response length from `ts`.
6. Define `AnalysisResult` Pydantic schema; validate Nova output; on ValidationError, retry (Celery).
7. `profile_updater.py`: rolling upsert of scores + merge strengths/weaknesses.
8. `study_plan_generator.py`: produce weekly plan JSON from latest profile + weaknesses.
9. Wire all into `summarize.py`; keep `_extract_summary` summary too (or fold into analysis).
10. Tests: serializer metrics, schema validation, profile rolling math, end-to-end task with mocked Nova.
11. Manual: run a real class session, confirm `analysis_results` row + profile populated.

## Todo List
- [x] 3 models + migration applied (AnalysisResult, StudentLearningProfile, StudyPlan — migrations ee5264c5e019, 031ee54f680b)
- [x] config NOVA_ANALYSIS_MODEL_ID added to config.py
- [x] nova_client converse() + JSON schema enforced (toolConfig/toolChoice wired; was dead code)
- [x] analyzer prompt written (IELTS examiner system prompt)
- [x] transcript serializer + fluency metrics from ts (wpm, avg_response_length, turn-count; timestamp collection moved after word-limit check)
- [x] AnalysisResult Pydantic validation + retry (Celery retries on ValidationError + BotoCoreError; schema renamed from AnalysisResult ORM→AnalysisOutput Pydantic)
- [x] profile rolling upsert (EMA for bands, merge-and-cap for lists)
- [x] study plan generator (target band, focus areas, recommended session types, daily tips)
- [x] summarize.py orchestration (heuristic summary + analysis pipeline, non-fatal wrapper)
- [x] unit + integration tests pass (27/27 pass)
- [ ] real-session manual verification (pending — requires live AWS credentials + running Celery worker)

## Success Criteria
- ≥90% of ended class sessions produce a valid `analysis_results` row.
- Band estimate within ±0.5 of a manual rater on a 10-session sample.
- `student_learning_profiles` reflects accumulated strengths/weaknesses across sessions.
- No pronunciation score emitted (null + note).

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Nova JSON drift / invalid output | converse() schema enforcement + Pydantic validate + Celery retry 3x |
| Cost creep | Lite (cheap), token-cap transcript, 1 analysis/session |
| wpm needs timestamps | Phase 0 adds `ts`; degrade gracefully (coherence-only) if missing |
| boto3 creds in Celery worker | Reuse env credential pattern; verify worker has AWS env |
| Files > 200 lines | Split into analysis/ package (done by design) |

## Security Considerations
- Transcript may contain personal info — do not log full transcripts at INFO; redact in errors.
- Internal-only task; no new public endpoint (results surfaced in Phase 2 via REST with ownership checks).

## Next Steps
- **Phase 2** surfaces analysis in UI + builds memory store.
- **Phase 4/5** consume grammar_mistakes / vocab usage.
- **Phase 7/8** consume band scoring + accumulated metrics.
