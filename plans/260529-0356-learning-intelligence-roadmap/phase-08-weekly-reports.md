# Phase 8 — Weekly Reports

## Context Links
- Plan overview: [plan.md](plan.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Keystone (data source): [phase-01-analysis-engine.md](phase-01-analysis-engine.md)
- Gamification (streaks source): [phase-03-gamification.md](phase-03-gamification.md)
- Spec: docs/new_version.md (Progress Tracking + Weekly Reports), docs/learning-intelligence.md (Study Plan Generator)

## Overview
- **Priority:** P2 (retention / engagement; not a blocker for other phases)
- **Status:** pending
- **Depends on:** Phase 1 (student_learning_profiles, analysis_results, study_plans), Phase 3 (streaks)
- **Effort:** ~16h
- **Description:** Aggregate accumulated learning metrics into a weekly dashboard. Snapshot each completed week (band, vocab growth, speaking time, grammar accuracy) into a `weekly_reports` table via a Celery beat task (Sunday night), compute the in-progress current week on-demand, and surface trends + this week's study plan to the student. Read-only consumer of Phase 1 + 3 data — no new analysis.

## Key Insights
- **This phase produces NO new analysis.** It is a pure aggregator: it reads `analysis_results`, `student_learning_profiles`, `streaks`, and `sessions` and rolls them into weekly buckets. All intelligence already lives upstream (Phase 1). Re-running Phase 1's analyzer here would duplicate logic — forbidden (DRY).
- **Snapshot completed weeks, compute the current week live.** A `weekly_reports` row is written once per ISO week by a Celery beat task after the week closes — so historical trends (band 5.5 → 6.0 over weeks) are cheap O(1) reads, never recomputed. The current (in-progress) week has no snapshot yet, so `/reports/current` aggregates raw rows on demand. This is the 80/20 sweet spot: trends are read-heavy and historical (cache them), the current week is small and changes constantly (compute it).
- **Speaking time is derived, not stored.** Compute per-session duration as `ended_at - started_at` summed over the week. Sessions with null `ended_at` (abandoned) contribute 0. No new column needed.
- **Celery is already wired** (`backend/app/tasks/celery_app.py`) but has **no beat schedule** — this phase adds the first periodic task. `celery beat` must run as a separate process alongside the worker.
- **Pronunciation stays deferred** — the report shows a "Pronunciation: coming soon (needs audio)" placeholder, never a fabricated number.
- **Band trend = delta between two snapshots.** "5.5 → 6.0" is `this_week.estimated_band` vs `last_week.estimated_band`. Vocab growth `+45 words` is `count(distinct vocab this week)` (Phase 5 `student_vocabulary` if present) OR `vocab_score` delta as a fallback if Phase 5 not yet shipped.

## Requirements
### Functional
1. A Celery beat task runs every Sunday 23:00 UTC, iterates students active in the closing ISO week, and writes one `weekly_reports` snapshot per student.
2. Snapshot captures: `estimated_band` (from latest profile in-week), `speaking_minutes` (sum of session durations), `vocab_growth` (new distinct words or vocab_score delta), `grammar_accuracy` (avg `analysis_results.grammar_acc` in-week), `sessions_count`, `current_streak`, and a `pronunciation_score` left null.
3. `GET /students/{id}/reports` — list past weekly snapshots, newest first, ownership-checked, paginated.
4. `GET /students/{id}/reports/current` — compute the in-progress week on-demand from raw rows; include band trend vs the most recent snapshot.
5. Each report response includes the band trend (`prev → current`) and the student's active `study_plans.generated_plan` ("this week's plan").
6. Idempotent snapshot: re-running the beat task for the same (student, iso_week) upserts, never duplicates.
### Non-Functional
- `/reports/current` aggregation must run in a single round-trip set of indexed queries (no N+1 over sessions).
- Beat task degrades gracefully: a student with zero in-week sessions is skipped (no empty snapshot).
- All money/time math uses UTC; ISO week boundaries (Mon 00:00 → Sun 23:59:59 UTC).
- Frontend charts use a minimal SVG/GSAP approach — no heavy charting dependency unless justified.

## Architecture
```
[Sunday 23:00 UTC]  celery beat  →  build_weekly_reports  (sync Celery task)
    for each student with ≥1 ended session in closing ISO week:
        read profile (latest in-week), analysis_results (in-week),
             sessions (in-week durations), streaks
        → WeeklyReportAggregator.build(student_id, iso_year, iso_week)
        → upsert weekly_reports row  (unique: student_id + iso_year + iso_week)

[on demand]  GET /students/{id}/reports          → list snapshots (read-only)
             GET /students/{id}/reports/current   → aggregate raw rows for live week
                                                     + diff vs latest snapshot (trend)
                                                     + attach active study_plan
```

### Snapshot vs on-demand decision (RESOLVED in this file)
**Decision: snapshot completed weeks into `weekly_reports` (UUIDv7 PK) via Celery beat; compute only the current in-progress week on demand.**
- Rejected "always compute on demand": trend charts need every historical week; recomputing N weeks of aggregation on every dashboard load is wasteful and gets slower as history grows (violates KISS for the read path).
- Rejected "snapshot everything including current week via cron only": the current week would be stale until Sunday — students expect to see today's progress immediately.
- Chosen hybrid: historical = cheap indexed snapshot reads; current = one bounded on-demand aggregation. Best of both.

### New module split (keep files < 200 lines, DRY)
- `backend/app/services/reports/` package:
  - `aggregator.py` — `WeeklyReportAggregator`: pure functions, builds a report dict from raw rows for a given (student, iso_week). Reused by both the beat task and `/reports/current`.
  - `week_window.py` — ISO-week boundary helpers (start/end datetimes for a given iso_year/iso_week; current-week resolver).
- `backend/app/tasks/weekly_reports.py` — Celery beat task `build_weekly_reports`; loops students, calls aggregator, upserts. Sync SQLAlchemy + psycopg2 pattern (same as `summarize.py`).

### Models / schemas
- New model `weekly_reports` (UUIDv7 PK; FK `student_id` UUID → students.id; `iso_year` INT, `iso_week` INT, `estimated_band` NUMERIC(3,1), `speaking_minutes` INT, `vocab_growth` INT, `grammar_accuracy` INT, `sessions_count` INT, `current_streak` INT, `pronunciation_score` INT NULL, `created_at` TIMESTAMPTZ). Unique constraint `(student_id, iso_year, iso_week)`.
- Pydantic v2 schemas: `WeeklyReportResponse`, `WeeklyReportListResponse`, `CurrentWeekReportResponse` (adds `band_trend: {previous: float|null, current: float|null}` + `study_plan: dict|null`).

### Weekly report response example (matches docs/new_version.md)
```json
{
  "iso_year": 2026, "iso_week": 22,
  "estimated_band": 6.0,
  "band_trend": { "previous": 5.5, "current": 6.0 },
  "vocab_growth": 45,
  "speaking_minutes": 120,
  "grammar_accuracy": 72,
  "pronunciation_score": null,
  "sessions_count": 6,
  "current_streak": 7,
  "study_plan": { "weeks": [ { "focus": ["past_tense","environment vocab"], "daily_minutes": 15 } ] }
}
```

## Related Code Files
### Create
- `backend/app/db/models/weekly_report.py` (1 new model)
- `backend/app/services/reports/__init__.py`, `aggregator.py`, `week_window.py`
- `backend/app/tasks/weekly_reports.py` (beat task)
- `backend/app/schemas/report.py`
- `backend/app/api/v1/routes/reports.py` (2 GET endpoints)
- Alembic migration for `weekly_reports` table (UUIDv7 default via `uuid_utils.uuid7()`)
- Tests: `backend/tests/unit/test_report_aggregator.py`, `backend/tests/unit/test_week_window.py`, `backend/tests/integration/test_reports_routes.py`, `backend/tests/integration/test_weekly_report_task.py`
- Frontend: `frontend/src/pages/reports/WeeklyReportsPage.tsx`, `frontend/src/components/reports/BandTrendChart.tsx`, `frontend/src/components/reports/VocabGrowthChart.tsx`, `frontend/src/components/reports/SpeakingTimeStat.tsx`, `frontend/src/components/reports/StudyPlanCard.tsx`
### Modify
- `backend/app/db/models/__init__.py` (register `WeeklyReport` for Alembic)
- `backend/app/api/v1/router.py` (mount reports router)
- `backend/app/tasks/celery_app.py` (add `beat_schedule` entry for `build_weekly_reports`, Sunday 23:00 UTC)
- `frontend/src/services/api.ts` (additive: `getReports(studentId)`, `getCurrentReport(studentId)`)
- `frontend/src/types.ts` (additive: `WeeklyReport`, `CurrentWeekReport`, `BandTrend` interfaces)
- `frontend/src/App.tsx` or router (add `/reports` route + nav link)

## Implementation Steps
1. Add `weekly_reports` model (UUIDv7 PK/FK, unique `(student_id, iso_year, iso_week)`); register in `__init__.py`; autogenerate migration; `alembic upgrade head`.
2. Build `week_window.py`: `iso_week_bounds(year, week) -> (start_utc, end_utc)` and `current_iso_week() -> (year, week)`. Pure, unit-tested.
3. Build `aggregator.py` `WeeklyReportAggregator.build(...)`: given student_id + window, run indexed queries (profile latest-in-week, avg grammar_acc, sum durations, distinct vocab / vocab_score delta, streak) → return a report dict. No DB writes here (pure builder).
4. Build `weekly_reports.py` Celery beat task: resolve closing ISO week, select students with ≥1 ended session in-week, call aggregator, upsert snapshot rows. Sync SQLAlchemy + psycopg2 pattern.
5. Register beat schedule in `celery_app.py` (`celery_app.conf.beat_schedule`), Sunday 23:00 UTC, plus document `celery -A app.tasks.celery_app beat` run command in plan/docs.
6. Define Pydantic schemas in `report.py` (list + current, with `band_trend` + `study_plan`).
7. Build `reports.py` routes: `GET /students/{id}/reports` (list snapshots, ownership-checked, paginated) and `GET /students/{id}/reports/current` (aggregator on live week + trend vs latest snapshot + active study_plan).
8. Mount router in `router.py`.
9. Frontend: `api.ts` add two fetchers; `types.ts` add interfaces; build `WeeklyReportsPage` with three lightweight SVG/GSAP charts (band trend line, vocab growth bar, speaking-time stat) + `StudyPlanCard`; pronunciation tile shows "coming soon".
10. Tests: week-window boundaries (incl. year rollover), aggregator math (durations, band trend, vocab growth, null pronunciation), routes (ownership 403, empty-history 200, current-week shape), beat-task idempotent upsert.
11. Manual: run worker + beat, finish a few sessions, trigger a snapshot, confirm dashboard renders trend + plan.

## Todo List
- [ ] weekly_reports model + migration applied (UUIDv7, unique week constraint)
- [ ] week_window helpers + unit tests
- [ ] aggregator (pure builder) + unit tests
- [ ] build_weekly_reports Celery beat task (idempotent upsert)
- [ ] beat_schedule entry in celery_app.py (Sun 23:00 UTC) + run command documented
- [ ] report Pydantic schemas (list + current + trend + study_plan)
- [ ] GET /students/{id}/reports + /reports/current (ownership-checked)
- [ ] router mounted
- [ ] frontend WeeklyReportsPage + 3 charts + StudyPlanCard
- [ ] api.ts + types.ts additive entries
- [ ] integration tests pass (routes + beat task)
- [ ] manual verification: snapshot + current-week + plan render

## Success Criteria
- A completed ISO week produces exactly one `weekly_reports` row per active student (no duplicates on re-run).
- `/reports/current` returns the live week's metrics + a band trend matching the prior snapshot within the same numbers a manual sum yields.
- Speaking minutes equal the manual sum of `(ended_at - started_at)` over in-week ended sessions.
- Band trend renders as "prev → current" (e.g. 5.5 → 6.0); pronunciation tile shows "coming soon", never a number.
- This week's `study_plan` (from Phase 1) is visible on the reports page.
- No analyzer/LLM call introduced by this phase (pure aggregation).

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Celery beat not running in dev/prod → no snapshots | Med × High | `/reports/current` works without beat; document beat process in run commands; alert if newest snapshot > 8 days old |
| Duplicate snapshots on retry | Med × Med | Unique `(student_id, iso_year, iso_week)` + upsert (ON CONFLICT) |
| N+1 over sessions in aggregation | Med × Med | Single grouped/aggregate queries in aggregator; index `sessions(student_id, ended_at)` |
| Phase 5 vocab table absent when this ships | Med × Low | Fallback to `vocabulary_score` delta for vocab_growth; switch to distinct-word count once Phase 5 lands |
| ISO week year-rollover bug (week 52/53 → 1) | Low × Med | `week_window` uses `datetime.isocalendar()`; unit test rollover explicitly |
| Heavy chart lib bloats bundle | Low × Med | Minimal SVG + GSAP per FRONTEND.md; only add a lib if a reviewer signs off |
| Timezone drift (local vs UTC) | Med × Med | All boundaries UTC; never use server local time |

## Security Considerations
- Both endpoints ownership-checked: `path id == current_student.id` else 403 (mirror `sessions.py` pattern). Students read only their own reports.
- No new public write endpoint; snapshots are written only by the internal beat task.
- Reports may embed weaknesses/interests (PII-adjacent) — do not log full report bodies at INFO.
- AccessToken in memory only; reports fetched with `Authorization: Bearer` via existing `api.ts` interceptor (no new auth surface).

## Next Steps
- **Phase 9 (Monetization)** gates the reports route + page behind the Pro plan (advanced analytics). This phase must exist first so there is something to gate.
- Future: email/push the weekly report digest (out of scope now — YAGNI).
- Future: once the audio phase lands, populate `pronunciation_score` (currently null placeholder).
