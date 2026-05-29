# Phase 4 — Adaptive Grammar

## Context Links
- Plan overview: [plan.md](plan.md)
- Keystone (produces inputs): [phase-01-analysis-engine.md](phase-01-analysis-engine.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Spec: docs/adaptive-learning-engine.md, docs/learning-intelligence.md (Grammar Analyzer), docs/database-learning-model.md
- Nova research: [researcher-260529-0407-amazon-nova-text-analysis.md](../reports/researcher-260529-0407-amazon-nova-text-analysis.md)

## Overview
- **Priority:** P2 (consumer of Phase 1)
- **Status:** complete
- **Depends on:** Phase 1 (analysis engine produces grammar mistakes in `analysis_results.raw_json`)
- **Effort:** ~24h
- **Description:** Turn Phase-1-detected grammar mistakes into a personalized practice loop. Aggregate mistakes across sessions into `student_grammar_weaknesses` (one row per category, accumulating severity/frequency). A decision engine auto-recommends the student's top weakness; an exercise generator (Nova Lite text call) produces multiple-choice grammar exercises seeded by that category. Student answers; correct answers award XP with a +100% recommended-content multiplier. Surfaced on Dashboard as "recommended practice" — the student never manually picks a category.

## Key Insights
- **Pure consumer of Phase 1 — never re-runs Nova analysis.** Weaknesses are aggregated by reading `analysis_results.raw_json.grammar` (or the typed grammar field Phase 1 persists). The ONLY Nova call here is exercise *generation* (a cheap Nova Lite `converse()` text call), not transcript analysis.
- **Aggregation is idempotent per session.** Re-processing an already-counted session must not double-count. Track which `analysis_results.id` rows have been folded into weaknesses (a `last_aggregated_analysis_id` cursor on the profile, or process from within the same Phase 1 task right after analysis lands — recommended: hook aggregation into the Phase 1 Celery task so it runs once per analysis).
- **Decision engine priority (docs/adaptive-learning-engine.md):** Critical Grammar Errors rank #1. Recommendation = the active weakness with the highest `severity × frequency` score that has no recent unanswered exercise.
- **XP multiplier:** recommended content = +100% (2×), normal = +50% (1.5×). Grammar exercises are always recommended (decision engine picks them), so they earn the recommended rate. Reuse existing XP-award infrastructure (`SessionService` pattern) — do NOT invent a parallel XP ledger.
- **Exercise schema is JSONB** (`question_json`) so format can evolve (MCQ now, fill-blank later) without migration. Keep generation output validated by a Pydantic schema.
- **Files < 200 lines:** split grammar logic into a `grammar/` service package mirroring Phase 1's `analysis/` split.

## Requirements
### Functional
1. After each Phase 1 analysis lands, aggregate that session's detected grammar mistakes into `student_grammar_weaknesses` (upsert by `(student_id, category)`: accumulate `frequency`, recompute rolling `severity`, bump `updated_at`).
2. `GET /api/v1/students/{id}/grammar-weaknesses` → ordered list (highest priority first) for the owning student.
3. `POST /api/v1/students/{id}/grammar-exercises` → decision engine selects top weakness category, generates a new MCQ exercise via Nova Lite, persists `grammar_exercises` row (`answered_correctly = NULL`), returns it.
4. `POST /api/v1/grammar-exercises/{id}/answer` → grade submitted answer, set `answered_correctly`, award XP (recommended multiplier) on correct, return result + correct answer + explanation.
5. Dashboard surfaces the current recommended grammar practice (top weakness + a CTA to start).
6. Grammar practice screen renders exercise cards (GSAP entrance/feedback animation, existing visual style), submits answers, shows XP gained.

### Non-Functional
- Aggregation idempotent per `analysis_results` row (no double-counting on Celery retry).
- Exercise generation token-capped; Nova Lite JSON validated with Pydantic; retry once on parse failure, else return a templated fallback exercise for the category.
- Ownership enforced on every endpoint (student can only touch own weaknesses/exercises).
- All new tables UUIDv7 PKs/FKs via `uuid_utils.uuid7()` SQLAlchemy `default` (PG16 has no native uuidv7()).
- No file > 200 lines.

## Architecture
```
[Phase 1 analysis lands] analysis_results.raw_json.grammar[]
   → grammar_aggregator.aggregate(student_id, analysis_result)        [called from Phase 1 Celery task]
        → upsert student_grammar_weaknesses (category: +frequency, rolling severity)

[Dashboard load] GET /students/{id}/grammar-weaknesses
   → grammar_service.list_weaknesses() → ordered by severity×frequency

[Student starts practice] POST /students/{id}/grammar-exercises
   → decision_engine.pick_category(weaknesses)        # priority: critical grammar first
   → exercise_generator.generate(category)            # Nova Lite converse() text call
        modelId = NOVA_ANALYSIS_MODEL_ID (amazon.nova-lite-v1:0)
        system = grammar-exercise-author prompt (MCQ JSON schema)
        user   = "category=past_tense, band=<student band>"
   → validate GrammarExercisePayload → persist grammar_exercises (answered_correctly=NULL)
   → return exercise (question + options, WITHOUT correct flag leaking)

[Student answers] POST /grammar-exercises/{id}/answer  body={selected: "B"}
   → grade vs stored answer key
   → set answered_correctly; if correct → award XP (recommended 2× multiplier)
   → return {correct: bool, correct_option, explanation, xp_awarded}
```

### New module split (grammar/ package, keep files < 200 lines, DRY)
- `backend/app/services/grammar/__init__.py`
- `backend/app/services/grammar/aggregator.py` — fold one `analysis_results` row into `student_grammar_weaknesses` (rolling severity, +frequency)
- `backend/app/services/grammar/decision_engine.py` — pick recommended category from weaknesses (priority logic)
- `backend/app/services/grammar/exercise_generator.py` — Nova Lite `converse()` MCQ author + Pydantic validate + templated fallback
- `backend/app/services/grammar/exercise_prompt.py` — exercise-author system prompt (pure data)
- `backend/app/services/grammar/grammar_service.py` — orchestration: list weaknesses, create exercise, grade+award XP

### Exercise JSON shape (`question_json`)
```json
{
  "category": "past_tense",
  "prompt": "She ___ to school yesterday.",
  "options": {"A": "go", "B": "goes", "C": "went", "D": "going"},
  "answer": "C",
  "explanation": "Past simple of 'go' is 'went'; 'yesterday' signals past tense."
}
```
> API responses to the client MUST strip `answer` + `explanation` on create (return only on answer-grade), to prevent answer leakage via network inspection.

### Weakness aggregation math
- `frequency_new = frequency_old + mistake.frequency_this_session`
- `severity_new = round((severity_old * n + mistake.severity) / (n + 1))` (rolling avg, n = times category seen)
- Store `times_seen` (or derive from session count) to weight the rolling average. Priority score for ordering/recommendation = `severity_new * frequency_new`.

## Related Code Files
### Create
- `backend/app/db/models/grammar.py` (`StudentGrammarWeakness`, `GrammarExercise`)
- `backend/app/services/grammar/__init__.py`, `aggregator.py`, `decision_engine.py`, `exercise_generator.py`, `exercise_prompt.py`, `grammar_service.py`
- `backend/app/schemas/grammar.py` (`GrammarWeaknessOut`, `GrammarExerciseOut`, `GrammarAnswerIn`, `GrammarAnswerResult`, `GrammarExercisePayload`)
- `backend/app/api/v1/routes/grammar.py` (routes; mount in `router.py`)
- Alembic migration for `student_grammar_weaknesses` + `grammar_exercises`
- `frontend/src/pages/practice/GrammarPractice.tsx` (exercise screen)
- `frontend/src/components/practice/GrammarExerciseCard.tsx` (GSAP card)
- `frontend/src/components/dashboard/RecommendedPractice.tsx` (Dashboard surface)
- Tests: `backend/tests/unit/test_grammar_aggregator.py`, `test_grammar_decision_engine.py`, `test_grammar_exercise_generator.py`; `backend/tests/integration/test_grammar_routes.py`
### Modify
- `backend/app/db/models/__init__.py` (register 2 new models for Alembic)
- `backend/app/api/v1/router.py` (`include_router(grammar.router)`)
- `backend/app/tasks/summarize.py` (call `grammar.aggregator.aggregate(...)` right after Phase 1 analysis persists — single idempotent fold)
- `frontend/src/services/api.ts` (additive: `getGrammarWeaknesses`, `generateGrammarExercise`, `answerGrammarExercise`)
- `frontend/src/types.ts` (additive: `GrammarWeakness`, `GrammarExercise`, `GrammarAnswerResult`)
- `frontend/src/pages/Dashboard.tsx` (render `RecommendedPractice`)
- `frontend/src/App.tsx` (route for `/practice/grammar`)

## Implementation Steps
1. Add `StudentGrammarWeakness` + `GrammarExercise` SQLAlchemy models (UUIDv7 PK/FK via `uuid_utils.uuid7()` default), register in `__init__.py`, autogenerate + apply migration.
2. Define Pydantic schemas in `schemas/grammar.py` incl. `GrammarExercisePayload` (the Nova-validated MCQ shape).
3. `aggregator.py`: read grammar mistakes from a passed-in `analysis_results` row; upsert weaknesses with rolling severity + accumulating frequency; idempotent per analysis id.
4. Hook `aggregator.aggregate(...)` into `summarize.py` immediately after Phase 1 writes `analysis_results` (so it runs exactly once per analysis, inside the Celery transaction).
5. `decision_engine.py`: `pick_category(weaknesses)` → highest `severity × frequency`, skipping categories with a pending (unanswered) exercise; returns `None` if no weaknesses (caller returns 204/empty recommendation).
6. `exercise_prompt.py` + `exercise_generator.py`: Nova Lite `converse()` MCQ author seeded by category + student band; validate to `GrammarExercisePayload`; retry once; templated fallback bank per category on failure.
7. `grammar_service.py`: orchestrate `list_weaknesses`, `create_exercise` (persist with `answer`/`explanation` server-side only), `grade_answer` (set `answered_correctly`, award XP on correct via shared XP-award helper with recommended 2× multiplier).
8. `routes/grammar.py`: 3 endpoints + `_assert_own`; mount in `router.py`. Create-response strips answer key.
9. Frontend `api.ts` + `types.ts` additive entries.
10. `GrammarExerciseCard.tsx`: render prompt + options, submit, GSAP feedback (correct = green pulse, wrong = shake), show XP toast.
11. `GrammarPractice.tsx`: fetch/generate exercise, render card, loop to next on completion.
12. `RecommendedPractice.tsx` on Dashboard: show top weakness + "Practice now" CTA → `/practice/grammar`.
13. Tests: aggregator rolling math + idempotency, decision priority, generator schema validation + fallback, integration of 3 routes incl. ownership + answer-leak guard.
14. Manual: run a real class session → confirm weakness rows appear → generate + answer an exercise → confirm XP credited at recommended rate.

## Todo List
- [ ] 2 models + migration applied
- [ ] grammar Pydantic schemas
- [ ] aggregator rolling upsert (idempotent per analysis)
- [ ] aggregator wired into summarize.py
- [ ] decision_engine priority pick
- [ ] exercise_generator Nova Lite + validate + fallback
- [ ] grammar_service grade + XP (recommended 2x)
- [ ] 3 REST routes + ownership + answer-leak guard
- [ ] frontend api.ts / types.ts additive
- [ ] GrammarExerciseCard + GrammarPractice (GSAP)
- [ ] Dashboard RecommendedPractice surface
- [ ] unit + integration tests pass
- [ ] real-session manual verification

## Success Criteria
- A real detected grammar mistake (Phase 1) produces a `student_grammar_weakness` row within one analysis cycle.
- Generated exercise matches the recommended category and validates against `GrammarExercisePayload`.
- Correct answer awards XP at the recommended (2×) rate; wrong answer awards none; XP reflected in `student.xp_total`.
- Decision engine recommends automatically — no UI control lets the student pick a category manually.
- Answer key never present in the create-exercise API response.
- Re-running aggregation on the same analysis does not double-count frequency.

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Double-counting on Celery retry | Med × High | Idempotent fold keyed to `analysis_results.id`; run inside Phase 1 task transaction |
| Nova Lite exercise JSON drift | Med × Med | Pydantic-validated MCQ schema; retry once; per-category templated fallback bank |
| Answer key leaked to client | Low × High | Strip `answer`/`explanation` on create response; only return on grade |
| XP double-award / parallel ledger | Low × High | Reuse single XP-award path; grade is idempotent (no XP if already answered) |
| No weaknesses yet (new student) | High × Low | Decision engine returns empty; Dashboard shows "keep practicing to unlock" |
| Files > 200 lines | Med × Low | grammar/ package split by responsibility (done by design) |
| UUID FK depends on Phase 0 reset | Low × Med | Phase 0 migrates students.id → UUID before this phase; gate start on Phase 0 done |

## Security Considerations
- Ownership check (`_assert_own`) on all 3 endpoints; `grammar-exercises/{id}/answer` must verify the exercise belongs to the caller before grading.
- Server is the single source of truth for grading + XP — never trust a client-sent "correct" flag.
- Answer key + explanation withheld until after submission (prevents trivial cheating via network tab).
- Exercise-generation prompt input (category, band) is server-derived, not user free-text → no prompt-injection surface.
- Do not log full weakness/exercise payloads at INFO (mildly sensitive learner data).

## Next Steps
- **Phase 6 (4-Stage Lessons)** consumes the grammar-exercise generator for its "Grammar" stage.
- **Phase 8 (Weekly Reports)** reads `student_grammar_weaknesses` trend over time.
- Shares the recommended-XP-multiplier convention with **Phase 5** (adaptive vocab) — keep the multiplier constant in one shared config (`LEVELUP_*`-style env, e.g. `RECOMMENDED_XP_MULTIPLIER=2.0`).
