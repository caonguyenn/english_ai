# Phase 1: Nova Lite Post-Session Analysis Engine

**Date**: 2026-05-29 06:20
**Severity**: Medium
**Component**: Backend / Celery task (summarize.py) + Nova Lite integration
**Status**: Resolved

## One-Line Summary

Built async Nova Lite transcript analyzer with schema-enforced toolConfig, EMA rolling profiles, study plan generation — 27/27 tests pass. Shipping with 5 downstream phases unblocked.

## What Changed

- **nova_client.py**: boto3 `converse()` wrapper using `toolChoice: {tool: {name: "record_analysis"}}` to force Nova into JSON tool-use mode. Schema enforced via `_ANALYSIS_SCHEMA` (9-property JSON schema).
- **3 new models**: `AnalysisResult` (session analysis), `StudentLearningProfile` (EMA rolling metrics), `StudyPlan` (skill recommendations). All UUID PKs.
- **transcript_serializer.py**: Compresses turns to ~3k words, extracts wpm from turn timestamps (only after confirming turn is included — critical bug fix).
- **profile_updater.py**: EMA formula `0.3 * new + 0.7 * existing` for band rolling averages. First session = raw value.
- **study_plan_generator.py**: Skills-based recommendations built from weaknesses list + vocab mastery deltas.
- **Celery retry contract**: `ValidationError`, `BotoCoreError` propagate to retry (max 3 @ 10s). Non-retriable bugs logged + swallowed so `summary_json` commits.

## Bugs Caught & Fixed

1. **Dead schema wired**: `_ANALYSIS_SCHEMA` defined but never passed to `converse()`. Added `toolConfig` param with explicit `toolChoice` to force tool call.
2. **wpm double-count**: Timestamps collected before word-limit break check → repeated turns at cap boundary. Fixed: collect timestamps *after* confirming turn inclusion.
3. **ValidationError swallowed**: Celery retry logic caught all exceptions. Fixed: re-raise `ValidationError` and `BotoCoreError` to trigger retry.
4. **StudyPlan.generated_at no onupdate**: Manual updates to plans weren't timestamped. Fixed: added `onupdate=func.now()`.

## Decisions Made

- **Sync engine in Celery**: Async engine share breaks in prefork workers. Use sync engine (`psycopg2`) in task context — correct pattern despite feeling backward.
- **3k word cap**: Keeps Nova context under safe limits while preserving key session content. Truncation message explicit ("remaining turns truncated").
- **EMA vs. average**: Rolling EMA decays old sessions, making profile responsive to recent improvements without throwing out history.
- **Non-retriable bugs don't fail session**: Analysis is nice-to-have. If Nova times out but summary exists, commit summary. Student still progresses.

## Technical Details

Schema extraction from tool response (line 138):
```python
result = tool_block["toolUse"]["input"]  # NOT text block
```
Common pitfall: checking `.text` blocks instead of `.toolUse.input`.

WPM calculation (lines 59–63) only triggers if ≥2 timestamps and word_count > 0.

## Next Steps

- Phase 2 (Adaptive Lesson Path): uses `student_learning_profiles` to personalize module sequencing.
- Phase 4 (Dashboard): renders `study_plans` + last 3 `analysis_results` as learning insights.
- Phase 5 (Playground Streaming): chains analysis into playground session endpoint.
- Phase 7 (Placement Refinement): uses EMA bands to adjust placement module assignment.
- Phase 8 (Teacher Dashboard): aggregates `level_audit_log` across student cohorts.

**Commit**: b7373a2 — 22 files, 1808 insertions. All tests green. Ready for integration testing.
