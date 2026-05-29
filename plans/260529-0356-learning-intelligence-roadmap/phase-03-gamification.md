# Phase 3 — Gamification (PARALLEL track)

## Context Links
- Plan overview: [plan.md](plan.md)
- Style reference (keystone structure): [phase-01-analysis-engine.md](phase-01-analysis-engine.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Specs: docs/new_version.md (Gamification section), docs/FRONTEND.md (design tokens / card style)

## Overview
- **Priority:** P2 (high-value retention win, but no feature blocks on it)
- **Status:** complete
- **Depends on:** Phase 0 ONLY (needs UUIDv7 PKs on existing tables). **NO AI dependency** — runs fully parallel to Phases 1/2/4/5.
- **Effort:** ~20h
- **Description:** Add streaks, achievements, and badges on top of the existing XP system (class XP is already awarded in current code — build on it, don't replace). New tables: `streaks`, `achievements`, `student_achievements`. Backend: a streak service (updates on any session end), an achievement-checker service (evaluates criteria after XP/session events). REST: `GET /students/{id}/streak`, `GET /students/{id}/achievements`. Frontend: streak flame widget + achievements grid on Dashboard/Profile (GSAP, existing card style). Seed initial achievements.

## Key Insights
- **XP already exists.** Class XP is awarded in the current code path (session end / `complete_class`). Do NOT re-implement XP. Gamification layers streaks + achievements over the existing XP/session events. Hook the new services into the SAME place the existing session-end logic runs (session PATCH / completion).
- **Zero AI coupling = parallel track.** Streaks and most achievements derive from session counts, XP totals, and dates — all available without Phase-1 analysis. This is why the plan runs it parallel. Keep it that way: do NOT add analysis-dependent logic into the core checker.
- **Analysis-dependent achievements are deferred/stubbed.** "Vocabulary Master" and "1,000 Words Spoken" depend on Phase-5 vocab tracking. Seed their rows now (so the grid shows them as locked) but their criteria evaluate to "never earned" until Phase 5 wires the data source. Flag clearly in `criteria_json` (e.g. `{"type":"vocab_count","threshold":1000,"deferred":true}`) and skip `deferred` criteria in the checker.
- **Streak = one row per student**, keyed on `student_id` (UUID PK). Update rule on session end: if `last_active_date == today` → no-op; if `== yesterday` → `current_len += 1`; else → `current_len = 1`. Always `longest_len = max(longest_len, current_len)`. Date in the student's day boundary (use UTC date for v1; flag timezone as future refinement).
- **Achievement-checker is idempotent** — `student_achievements` has composite PK `(student_id, achievement_id)`; an already-earned achievement is a no-op insert. Safe to run the full checker after every event.
- **UUIDv7 PKs** for `achievements` + `student_achievements.achievement_id` per locked decision (`uuid_utils.uuid7()` default). `streaks.student_id` and `student_achievements.student_id` are FKs → `students.id` (UUID after Phase 0).
- **Criteria as data, not code.** `achievements.criteria_json` describes WHAT to check (`{"type":"session_count","threshold":1}`); the checker has a small dispatch of criterion-type evaluators. Adding an achievement = a seed row, not new code (DRY/OCP). Keeps the checker small and the file under 200 lines.

## Requirements
### Functional
1. On any session end, update the student's streak row (create on first session).
2. After XP/session events, run the achievement-checker: evaluate all non-deferred criteria against the student's current state, insert newly-earned `student_achievements` rows.
3. `GET /students/{id}/streak` — return `{current_len, longest_len, last_active_date}`. Ownership-checked.
4. `GET /students/{id}/achievements` — return all achievements with earned/locked status + `earned_at` for earned ones. Ownership-checked.
5. Seed initial achievements: First Conversation (1 session), First Mock Test (deferred → Phase 7), 1,000 Words Spoken (deferred → Phase 5), 7-Day Streak, 30-Day Streak, 100-Day Streak, Vocabulary Master (deferred → Phase 5).
6. Frontend: streak flame widget (🔥 current_len) + achievements grid (earned = full color, locked = dimmed) on Dashboard and Profile.

### Non-Functional
- Additive: no change to existing `students`/`sessions`/XP logic — only NEW tables + NEW service calls hooked at session end.
- Checker + streak update must be cheap (single-student queries, no full scans); run inline at session end (async, in REST process) — no Celery needed for v1.
- Criterion evaluators pure + unit-testable.
- Frontend strict TS, GSAP for flame pulse + achievement unlock pop, design tokens from docs/FRONTEND.md.
- api.ts / types.ts additions are **append-only** (see ownership) to avoid conflict with Phase 2's parallel additions.

## Architecture
```
session ends → existing session-end / complete logic (REST :8000)
   ├─ existing: award class XP (unchanged)
   ├─ NEW: StreakService.touch(student_id)        # update streak row
   └─ NEW: AchievementChecker.evaluate(student_id) # insert newly-earned

GET /students/{id}/streak         → streaks row
GET /students/{id}/achievements   → achievements ⟕ student_achievements (status overlay)

Frontend (Dashboard / Profile)
   useQuery(getStreak)        → StreakFlame widget   (🔥 + count, GSAP pulse)
   useQuery(getAchievements)  → AchievementsGrid     (earned/locked, GSAP unlock pop)
```

### Criteria dispatch (data-driven checker)
```
criteria_json examples:
  {"type":"session_count","threshold":1}            → First Conversation
  {"type":"streak","threshold":7}                   → 7-Day Streak
  {"type":"streak","threshold":30}                  → 30-Day Streak
  {"type":"streak","threshold":100}                 → 100-Day Streak
  {"type":"mock_test_count","threshold":1,"deferred":true}   → First Mock Test (Phase 7)
  {"type":"words_spoken","threshold":1000,"deferred":true}   → 1,000 Words Spoken (Phase 5)
  {"type":"vocab_mastered","threshold":50,"deferred":true}   → Vocabulary Master (Phase 5)

checker: for each achievement not yet earned and not deferred →
  evaluator = EVALUATORS[criteria.type]
  if evaluator(student_state, criteria.threshold): insert student_achievement
```

### Module split (keep files < 200 lines, DRY)
- `backend/app/db/models/gamification.py` — `Streak`, `Achievement`, `StudentAchievement` (UUIDv7 where applicable).
- `backend/app/services/streak_service.py` — `touch(db, student_id)` (date-delta logic, pure helper for the math so it's unit-testable).
- `backend/app/services/achievement_service.py` — `evaluate(db, student_id)` + `EVALUATORS` dispatch + `list_for_student(db, student_id)`.
- `backend/app/schemas/gamification.py` — `StreakOut`, `AchievementOut`.
- `backend/app/api/v1/routes/gamification.py` — the 2 read endpoints.
- Frontend: `frontend/src/components/gamification/StreakFlame.tsx`, `AchievementsGrid.tsx`, `AchievementBadge.tsx`.

### New tables (UUIDv7 where there's a synthetic PK)
```sql
streaks (
  student_id UUID PK FK→students.id,
  current_len INT NOT NULL DEFAULT 0,
  longest_len INT NOT NULL DEFAULT 0,
  last_active_date DATE
)
achievements (
  id UUID PK DEFAULT (app-side uuid7),
  slug VARCHAR UNIQUE NOT NULL,
  title VARCHAR NOT NULL,
  description VARCHAR,
  criteria_json JSONB NOT NULL
)
student_achievements (
  student_id UUID FK→students.id,
  achievement_id UUID FK→achievements.id,
  earned_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (student_id, achievement_id)
)
```

## Related Code Files
### Create
- `backend/app/db/models/gamification.py` — `Streak`, `Achievement`, `StudentAchievement`.
- `backend/app/services/streak_service.py` — streak touch + pure date-delta helper.
- `backend/app/services/achievement_service.py` — checker + `EVALUATORS` dispatch + list overlay.
- `backend/app/schemas/gamification.py` — `StreakOut`, `AchievementOut`.
- `backend/app/api/v1/routes/gamification.py` — `GET /students/{id}/streak`, `GET /students/{id}/achievements`.
- Alembic migration for the 3 tables.
- Tests: `backend/tests/unit/test_streak_service.py` (date-delta math), `test_achievement_evaluators.py` (each criterion type); `backend/tests/integration/test_gamification_routes.py`.
- Frontend: `frontend/src/components/gamification/StreakFlame.tsx`, `AchievementsGrid.tsx`, `AchievementBadge.tsx`.
### Modify
- `backend/app/db/models/__init__.py` — register 3 models for Alembic.
- `backend/app/api/v1/router.py` — include `gamification` router.
- `backend/app/services/session_service.py` (or the existing session-end/complete path) — call `StreakService.touch` + `AchievementChecker.evaluate` after XP award. **Append** the two calls; do not rewrite existing XP logic.
- `backend/scripts/seed.py` — **append** initial achievements seed (idempotent: upsert by `slug`).
- `frontend/src/pages/Dashboard.tsx` + `frontend/src/pages/profile/ProfilePage.tsx` — mount StreakFlame + AchievementsGrid.
- `frontend/src/services/api.ts` — **append** `getStreak(id)`, `getAchievements(id)`.
- `frontend/src/types.ts` — **append** `Streak`, `Achievement` types.
### File ownership (THIS phase owns; do not let Phase 2 touch)
- `backend/app/db/models/gamification.py`, `backend/app/services/streak_service.py`, `backend/app/services/achievement_service.py`
- `backend/app/schemas/gamification.py`, `backend/app/api/v1/routes/gamification.py`
- `frontend/src/components/gamification/*`
- **Shared (append-only — coordinate to avoid Phase-2 conflicts):** `api.ts`, `types.ts`, `backend/app/api/v1/router.py`, `backend/app/db/models/__init__.py`, `backend/scripts/seed.py`, `session_service.py`.
- **CRITICAL:** Phase 2 also appends to `api.ts` and `types.ts`. Both phases add NEW exports at the END of the file in their own clearly-commented block (`// ── Gamification (Phase 3) ──`). Never edit existing lines or the other phase's block. This keeps the merge a clean concatenation, not a conflict.

## Implementation Steps
1. Add `Streak`, `Achievement`, `StudentAchievement` models (UUIDv7 default via `uuid_utils.uuid7` on `achievements.id`; composite PK on `student_achievements`); register in `__init__.py`; autogenerate migration; `alembic upgrade head`.
2. Write `streak_service.py`: pure `compute_streak(prev_len, longest, last_date, today)` helper + `touch(db, student_id)` that loads/creates the row and applies it.
3. Write `achievement_service.py`: `EVALUATORS` dict keyed by criterion `type` (`session_count`, `streak`; defer the rest), `evaluate(db, student_id)` that loops unearned non-deferred achievements and inserts earned ones, `list_for_student(db, student_id)` returning the earned/locked overlay.
4. Write `gamification.py` schemas + routes (`_assert_own` ownership pattern from `students.py`).
5. Include `gamification` router in `router.py`.
6. Hook `StreakService.touch` + `AchievementChecker.evaluate` into the existing session-end/complete path in `session_service.py` (append after XP award; wrap in try/except so gamification never blocks session completion).
7. Append achievement seed rows to `seed.py` (idempotent upsert by `slug`; deferred ones flagged in `criteria_json`).
8. Frontend: append api.ts methods + types.ts types in a `// ── Gamification (Phase 3) ──` block. Build `StreakFlame` (🔥 + current_len, GSAP flame pulse via `gsap.context()`), `AchievementsGrid` + `AchievementBadge` (earned = full color/gold border, locked = dimmed/`opacity 0.4`, GSAP unlock pop). Use design tokens (cards `--bg-surface`, `--border-subtle`; gold accent for earned).
9. Mount widgets on Dashboard + Profile (React Query for fetch).
10. Tests: streak date-delta cases (same-day no-op / consecutive +1 / gap reset / longest update); each non-deferred evaluator; route ownership 403; checker idempotency (re-run = no duplicate). Manual: complete a session → streak increments, "First Conversation" unlocks.

## Todo List
- [ ] 3 gamification models + migration applied
- [ ] streak_service (pure date-delta helper + touch)
- [ ] achievement_service (EVALUATORS dispatch + evaluate + list overlay)
- [ ] gamification schemas + 2 routes (ownership)
- [ ] router includes gamification
- [ ] session-end hook calls touch + evaluate (non-fatal)
- [ ] seed.py appends achievements (deferred flagged)
- [ ] frontend api.ts + types.ts appended (Phase-3 block)
- [ ] StreakFlame + AchievementsGrid + AchievementBadge (GSAP, tokens)
- [ ] mounted on Dashboard + Profile
- [ ] unit + integration tests pass
- [ ] manual: streak increments + First Conversation unlocks

## Success Criteria
- Completing a session increments `current_len` (and `longest_len` if exceeded); same-day second session does not double-count.
- "First Conversation" unlocks after the first completed session; the 7/30/100-day streak achievements unlock at the right thresholds.
- `GET /students/{id}/streak` + `GET /students/{id}/achievements` return 200 for owner, 403 for non-owner.
- Dashboard/Profile show the flame widget with correct count and the achievements grid with earned vs. locked states.
- Deferred achievements (First Mock Test, 1,000 Words Spoken, Vocabulary Master) appear as locked and are NOT incorrectly awarded before Phases 5/7.
- No regression to existing XP awarding.

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Streak double-counts within a day | Med × Med | Same-day check (`last_active_date == today` → no-op); unit test the date-delta helper |
| Gamification error blocks session completion | Low × High | Wrap touch + evaluate in try/except in session-end path; XP/session already committed; log + continue |
| Deferred achievements awarded prematurely | Med × Med | `deferred:true` in `criteria_json`; checker skips deferred; integration test asserts they stay locked |
| api.ts/types.ts conflict with Phase 2 | Med × Med | Append-only in a labelled Phase-3 block at file end; no shared-line edits |
| seed.py re-run duplicates achievements | Med × Low | Upsert by unique `slug`; idempotent |
| Timezone makes "daily" ambiguous | Med × Low | UTC date for v1; flag per-student timezone as future refinement (YAGNI now) |
| Checker scans grow with achievements | Low × Low | Single-student queries; only unearned non-deferred evaluated; cheap |

## Security Considerations
- Ownership checks on both endpoints (`_assert_own`); a student reads only their own streak/achievements.
- No achievement criterion trusts client input — all evaluated server-side from DB state (server-authoritative, matches report's "gating enforced server-side" principle).
- No new public/unauthenticated surface; both endpoints require `get_current_student`.
- Seed runs admin-side only; no runtime endpoint creates achievements.

## Next Steps
- **Phase 5 (Adaptive Vocab)** wires the data source for `words_spoken` / `vocab_mastered` — flip those achievements from `deferred` to active.
- **Phase 7 (Mock Test)** wires `mock_test_count` → activates "First Mock Test".
- **Phase 8 (Weekly Reports)** surfaces streak/achievement trends in the dashboard.
- Unresolved: per-student timezone for streak day-boundary (deferred — UTC for v1); whether streak freezes/repair items are wanted (defer — YAGNI).
