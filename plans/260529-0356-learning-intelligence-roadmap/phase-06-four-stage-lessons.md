# Phase 6 — 4-Stage Lessons

## Context Links
- Plan overview: [plan.md](plan.md)
- Feedback stage source: [phase-02-feedback-and-memory.md](phase-02-feedback-and-memory.md) (Stage 4 reuses its feedback panels + endpoints)
- Grammar stage source: [phase-04-adaptive-grammar.md](phase-04-adaptive-grammar.md) (Stage 2 reuses `GrammarExerciseCard` + exercise generator/routes)
- Vocab stage source: [phase-05-adaptive-vocab.md](phase-05-adaptive-vocab.md) (Stage 1 ties to Word Unlock + target words)
- Keystone (produces feedback data): [phase-01-analysis-engine.md](phase-01-analysis-engine.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Spec: docs/new_version.md (Lesson Structure — 4 stages), docs/FRONTEND.md (design tokens / stepper / card style)

## Overview
- **Priority:** P2 (UX restructure that composes Phases 2/4/5 into the canonical lesson flow)
- **Status:** complete
- **Depends on:** Phase 2 (feedback UI), Phase 4 (grammar exercises), Phase 5 (vocab / word unlock)
- **Effort:** ~20h
- **Description:** Restructure the single-screen class experience (`ClassRoom.tsx` → one Nova Sonic conversation) into the 4-stage lesson defined in `docs/new_version.md`: **Stage 1 Vocabulary** (introduce key words for the topic — ties to Phase 5 word-unlock), **Stage 2 Grammar Focus** (topic-relevant grammar mini-exercise — reuses Phase 4 `GrammarExerciseCard`), **Stage 3 AI Speaking Practice** (the EXISTING Nova Sonic conversation, unchanged mechanism), **Stage 4 Feedback** (the Phase 2 feedback panels). Primarily a **frontend** restructure (stage stepper UI + GSAP stage transitions) plus thin **backend** support to define per-class stage content and track a session's stage progress. XP is awarded on full lesson completion via the existing `complete_class` path — stages 1/2 do not invent a new XP ledger.

## Key Insights
- **Reuse, don't reinvent.** Stage 1 reuses Phase 5 vocab/word-unlock data + target words. Stage 2 reuses Phase 4's `GrammarExerciseCard` + `generateGrammarExercise`/`answerGrammarExercise` API. Stage 3 is the CURRENT `ClassRoom` Nova Sonic session verbatim. Stage 4 is the Phase 2 `FeedbackPanels`/`SessionSummary`. This phase **imports** those components read-only and **orchestrates** them — it must NOT edit Phase 2/4/5 files.
- **Stage content is KISS: static-seeded JSON, not generated.** Each class already has `skill_type` + `system_prompt_addendum`. Add a `stage_content` JSONB column on `classes` holding `{vocab: [...words], grammar_focus: {category, note}}`. Seed it per class (extend `scripts/seed.py`). YAGNI on per-student stage generation — Stage 2's exercise is already personalized via Phase 4's generator seeded by the class's `grammar_focus.category`; Stage 1's words feed Phase 5 word-unlock introduction. No new Nova call in this phase.
- **Stage 3 is the only real session.** A Nova Sonic WS session is created exactly once, when the student enters Stage 3 — NOT on lesson open. Stages 1/2 are pre-session warm-up (no WS, no audio). This avoids holding a Bedrock stream open during reading/exercise stages (cost + the 45-min token window in `tool_handler.py`).
- **Stage progress is advisory, not gating XP.** Track `current_stage` on the session so a refresh resumes mid-lesson and so analytics can see drop-off. XP still comes solely from `complete_class` at the end of Stage 3 (model-driven, server-authoritative) — Stages 1/2 are not separately rewarded (avoids a parallel ledger; matches Phase 4/5 "reuse single XP path"). Stage 4 is read-only display.
- **Backwards compatible.** `stage_content` nullable → classes without it fall back to the legacy single-screen flow (Stage 3 only). Existing `complete_class` / `ClassRoom` Nova Sonic mechanism is unchanged. The 4-stage shell is a wrapper; the old flow remains the inner Stage 3.
- **Files < 200 lines:** the current `ClassRoom.tsx` is ~280 lines and already over budget — splitting it into a stage shell + stage subcomponents is a required side-benefit of this phase.

## Requirements
### Functional
1. `classes.stage_content` JSONB column (nullable): `{ "vocab": [{word, meaning}...], "grammar_focus": {category, note} }`. Seeded per class.
2. `sessions.current_stage` SMALLINT (nullable, default 1 for class sessions): persists which stage the student is on.
3. `GET /api/v1/classes/{id}/stages` → returns the class's stage definitions (vocab list + grammar focus) for Stages 1 & 2. Ownership/auth via existing `get_current_student`. Graceful empty when `stage_content` is null (frontend skips to Stage 3).
4. `PATCH /api/v1/sessions/{id}/stage` → body `{stage: int}`; updates `current_stage` (ownership-checked: session belongs to caller). Best-effort progress tracking; never blocks the lesson.
5. Frontend `ClassRoom` becomes a 4-stage flow with a top **stage stepper** (1 Vocabulary · 2 Grammar · 3 Speaking · 4 Feedback), GSAP slide transition between stages.
6. **Stage 1 Vocabulary:** intro card listing the class's target words (word + short meaning). "These words may earn bonus XP if you use them while speaking" (ties to Phase 5 word-unlock). "Continue" → Stage 2.
7. **Stage 2 Grammar:** render ONE Phase 4 `GrammarExerciseCard` seeded by `grammar_focus.category` (call Phase 4's `generateGrammarExercise` / `answerGrammarExercise`). Answering (or "Skip") → Stage 3. Grammar XP handled by Phase 4's own path; not re-awarded here.
8. **Stage 3 Speaking:** the existing Nova Sonic conversation (create session, connect WS, mic, transcript) — moved verbatim into a `SpeakingStage` subcomponent. `complete_class` (AI-driven) awards lesson XP as today → advances to Stage 4.
9. **Stage 4 Feedback:** mount Phase 2 feedback panels (`GET /sessions/{id}/analysis`, `GET /students/{id}/profile`); show "analysis pending" skeleton until Phase 1 lands. "Back to Module" CTA closes the lesson.

### Non-Functional
- Additive, backwards-compatible: null `stage_content` → legacy single-stage behavior (jump straight to Stage 3).
- `classes.stage_content` + `sessions.current_stage` are the only schema changes; both nullable, no data backfill required (seed updates only).
- Nova Sonic WS session created once, at Stage 3 entry — never during Stages 1/2/4.
- Frontend strict TS; GSAP via `gsap.context()` for stage transitions + stepper; design tokens from docs/FRONTEND.md (`--bg-surface`, `--border-subtle`, `--radius-lg`, skill colors).
- `api.ts` / `types.ts` additions are **append-only** (avoid conflict with parallel phases).
- No file > 200 lines (ClassRoom split mandatory).

## Architecture
```
ClassRoom (stage shell) — owns stage state machine + stepper
  stage = 1 → <VocabIntroStage  content={GET /classes/{id}/stages .vocab} />        (no WS)
  stage = 2 → <GrammarFocusStage category={stages.grammar_focus.category}>          (no WS)
                 imports Phase 4 <GrammarExerciseCard/> + generate/answer API
  stage = 3 → <SpeakingStage classId={id}>                                          (WS session HERE)
                 = today's ClassRoom body verbatim: create /sessions, connect WS,
                   mic, transcript, onClassComplete → setStage(4)
  stage = 4 → <FeedbackStage sessionId={sid} studentId={me.id}>                     (no WS)
                 imports Phase 2 FeedbackPanels (GET /sessions/{id}/analysis, /students/{id}/profile)

stepper advance → PATCH /sessions/{id}/stage {stage}   (best-effort; only after sid exists)
  note: sid only exists from Stage 3 onward. Stages 1/2 advance locally; first PATCH
  fires when the session is created at Stage 3 entry (current_stage=3), and again at Stage 4.

XP: unchanged — Stage 3's existing complete_class (tool_handler → POST /sessions/{id}/complete)
    awards class XP server-side. Stage 2 grammar XP via Phase 4's own answer endpoint.
```

### Backend module split (keep files < 200 lines, DRY)
- `backend/app/db/models/module.py` — **add** `stage_content` column to existing `Class` (no new model).
- `backend/app/db/models/session.py` — **add** `current_stage` column to existing `Session`.
- `backend/app/services/lesson_stage_service.py` — read class stage content; update session `current_stage` (small: get-stages + set-stage helpers).
- `backend/app/schemas/lesson_stage.py` — `LessonStagesOut` (vocab list + grammar focus), `StagePatchIn`.
- `backend/app/api/v1/routes/classes.py` — if a dedicated classes route file does not exist, add the `/classes/{id}/stages` endpoint here (currently `/classes/{id}` is served via the sessions/modules area — verify and mount accordingly). `PATCH /sessions/{id}/stage` goes in the existing `sessions.py` route.

### Frontend component split (ClassRoom restructure — OWNED by this phase)
- `frontend/src/pages/modules/ClassRoom.tsx` — becomes the **stage shell** (stage state machine, stepper, GSAP transitions). Shrinks well under 200 lines.
- `frontend/src/components/session/stages/StageStepper.tsx` — 4-step progress header (GSAP active-step highlight).
- `frontend/src/components/session/stages/VocabIntroStage.tsx` — Stage 1 word cards.
- `frontend/src/components/session/stages/GrammarFocusStage.tsx` — Stage 2; imports Phase 4 `GrammarExerciseCard` (read-only).
- `frontend/src/components/session/stages/SpeakingStage.tsx` — Stage 3; the current ClassRoom WS/mic/transcript body moved here verbatim.
- `frontend/src/components/session/stages/FeedbackStage.tsx` — Stage 4; imports Phase 2 `FeedbackPanels` / `SessionSummary` (read-only).

### `stage_content` JSON shape (seeded per class)
```json
{
  "vocab": [
    {"word": "pollution",   "meaning": "harmful substances released into the environment"},
    {"word": "sustainable", "meaning": "able to continue without damaging the environment"},
    {"word": "renewable",   "meaning": "naturally replenished, e.g. solar or wind energy"}
  ],
  "grammar_focus": {
    "category": "past_tense",
    "note": "Use the past simple to describe completed actions: 'I went', 'they built'."
  }
}
```
> `grammar_focus.category` MUST match the category vocabulary used by Phase 4's `student_grammar_weaknesses` / exercise generator so Stage 2 can call `generateGrammarExercise` with a seed category.

## Related Code Files
### Create
- `backend/app/services/lesson_stage_service.py` — get stage content + set session stage.
- `backend/app/schemas/lesson_stage.py` — `LessonStagesOut`, `StagePatchIn`.
- `backend/app/api/v1/routes/classes.py` (or extend existing classes handler) — `GET /classes/{id}/stages`.
- Alembic migration: add `classes.stage_content` (JSONB nullable) + `sessions.current_stage` (SMALLINT nullable).
- `frontend/src/components/session/stages/StageStepper.tsx`
- `frontend/src/components/session/stages/VocabIntroStage.tsx`
- `frontend/src/components/session/stages/GrammarFocusStage.tsx`
- `frontend/src/components/session/stages/SpeakingStage.tsx`
- `frontend/src/components/session/stages/FeedbackStage.tsx`
- Tests: `backend/tests/unit/test_lesson_stage_service.py`; `backend/tests/integration/test_lesson_stage_routes.py`
### Modify
- `backend/app/db/models/module.py` — add `stage_content` JSONB column to `Class`.
- `backend/app/db/models/session.py` — add `current_stage` SMALLINT column to `Session`.
- `backend/app/api/v1/routes/sessions.py` — add `PATCH /sessions/{id}/stage` (ownership-checked).
- `backend/app/api/v1/router.py` — include classes router if newly created.
- `backend/scripts/seed.py` — populate `stage_content` for each class (vocab list + grammar focus per topic/skill).
- `frontend/src/pages/modules/ClassRoom.tsx` — **restructure** into the stage shell (owned).
- `frontend/src/services/api.ts` — **append** `getClassStages(id)`, `patchSessionStage(id, stage)`.
- `frontend/src/types.ts` — **append** `LessonStages`, `VocabStageWord`, `GrammarFocus`.
### File ownership (THIS phase owns; reuse others read-only)
- **Owns:** `backend/app/services/lesson_stage_service.py`, `backend/app/schemas/lesson_stage.py`, `backend/app/api/v1/routes/classes.py`, `frontend/src/pages/modules/ClassRoom.tsx` + `frontend/src/components/session/stages/*`, the migration, seed `stage_content` block.
- **Reuses read-only (DO NOT edit):** Phase 2 `components/session/feedback/*` + `SessionSummary.tsx`; Phase 4 `components/practice/GrammarExerciseCard.tsx` + grammar API methods; Phase 5 vocab/word-unlock data + target words.
- **Shared (append-only):** `api.ts`, `types.ts`, `router.py`, `sessions.py` (add one PATCH endpoint at end), `module.py`/`session.py` (add one column each), `seed.py`.

## Implementation Steps
1. Add `stage_content` (JSONB nullable) to `Class` and `current_stage` (SMALLINT nullable) to `Session`; autogenerate + apply migration. No backfill.
2. Extend `scripts/seed.py`: for each class, set `stage_content` with 3–5 topic vocab words (+ short meanings) and a `grammar_focus` `{category, note}` aligned to the class skill/topic and to Phase 4 categories.
3. `schemas/lesson_stage.py`: `LessonStagesOut {vocab: list[VocabStageWord], grammar_focus: GrammarFocus | None}`, `StagePatchIn {stage: int (1–4)}`.
4. `lesson_stage_service.py`: `get_stages(db, class_id)` → reads `Class.stage_content`, returns parsed `LessonStagesOut` (empty when null); `set_stage(db, session, stage)` → updates `current_stage`.
5. `GET /classes/{id}/stages` route (auth via `get_current_student`); returns `LessonStagesOut` (empty shape if null → frontend skips to Stage 3).
6. `PATCH /sessions/{id}/stage` in `sessions.py`: load session, assert `session.student_id == current.id`, clamp stage 1–4, call `set_stage`. Best-effort (never 5xx the lesson flow).
7. Frontend `api.ts` + `types.ts` additive entries (`getClassStages`, `patchSessionStage`; `LessonStages`, `VocabStageWord`, `GrammarFocus`).
8. **Split `ClassRoom.tsx`:** move the entire current WS/mic/transcript body into `SpeakingStage.tsx` unchanged (props: `classId`, `onComplete`). Verify Stage 3 behaves exactly as the old ClassRoom (session create, WS connect, `onClassComplete`).
9. Build `ClassRoom.tsx` stage shell: `useState<1|2|3|4>` stage; fetch `getClassStages(id)` on mount; if empty → start at stage 3; render `StageStepper` + the active stage; GSAP slide transition on stage change via `gsap.context()`.
10. `VocabIntroStage.tsx`: card grid of `stage_content.vocab` words + meanings + word-unlock hint; "Continue" → stage 2.
11. `GrammarFocusStage.tsx`: import Phase 4 `GrammarExerciseCard`; call `generateGrammarExercise` seeded by `grammar_focus.category` on mount; render card; "Submit"/"Skip" → stage 3. (Reuse Phase 4 components/API only — do not re-implement grading.)
12. `SpeakingStage.tsx`: on entry, create the session + connect WS (the moved logic); on `onClassComplete` → `patchSessionStage(sid, 4)` + advance to stage 4.
13. `FeedbackStage.tsx`: import Phase 2 `FeedbackPanels`; fetch analysis + profile by session/student id; skeleton while "pending"; "Back to Module" CTA → navigate + invalidate `['classes']` / `['modules']` queries (as today's `handleSummaryClose`).
14. Fire `patchSessionStage` on each advance once a `sid` exists (Stage 3 onward); Stages 1→2 advance locally.
15. Tests: service get-stages (null + populated), set-stage clamp; route auth/ownership + empty-stage shape. Frontend manual: full 4-stage walkthrough + legacy class with null `stage_content` jumps straight to speaking.

## Todo List
- [ ] `classes.stage_content` + `sessions.current_stage` columns + migration applied
- [ ] seed.py populates stage_content per class (vocab + grammar_focus)
- [ ] lesson_stage schemas (LessonStagesOut, StagePatchIn)
- [ ] lesson_stage_service (get_stages, set_stage)
- [ ] GET /classes/{id}/stages route
- [ ] PATCH /sessions/{id}/stage route (ownership)
- [ ] frontend api.ts / types.ts appended
- [ ] ClassRoom split → SpeakingStage holds verbatim WS body (Stage 3 parity)
- [ ] ClassRoom stage shell + StageStepper (GSAP transitions)
- [ ] VocabIntroStage (Stage 1, word-unlock hint)
- [ ] GrammarFocusStage reuses Phase 4 GrammarExerciseCard (Stage 2)
- [ ] FeedbackStage reuses Phase 2 FeedbackPanels (Stage 4)
- [ ] stage PATCH fired on advance (sid-gated)
- [ ] unit + integration tests pass
- [ ] manual: full 4-stage walkthrough + null-stage_content legacy fallback

## Success Criteria
- A class with seeded `stage_content` renders all 4 stages with a working stepper; GSAP transitions between them.
- Stage 1 shows the class's target vocab words; Stage 2 renders a Phase 4 grammar exercise seeded by `grammar_focus.category`; Stage 3 is the unchanged Nova Sonic conversation; Stage 4 shows the Phase 2 feedback (or "pending" skeleton).
- Nova Sonic WS session is created exactly once, only at Stage 3 entry (verified: no WS during Stages 1/2/4).
- Lesson XP is awarded only via the existing `complete_class` path (no new/duplicate XP for Stages 1/2); `student.xp_total` increments by exactly the class `xp_reward` once.
- A legacy class with null `stage_content` skips straight to Stage 3 and behaves exactly like the pre-Phase-6 ClassRoom.
- `current_stage` reflects progress on PATCH and survives a refresh into Stage 3/4.
- No edits to Phase 2/4/5 component files (reused by import only).

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| ClassRoom split regresses the live Stage 3 session | Med × High | Move WS/mic/transcript body VERBATIM into `SpeakingStage`; manual parity check vs old ClassRoom (session create, WS auth, transcript, complete_class) before wiring shell |
| Double XP (Stages 1/2 add a parallel reward) | Low × High | Stages 1/2 award NO XP; XP only via existing `complete_class`; Phase 4 grammar XP via its own idempotent endpoint |
| Holding a Bedrock stream open during reading stages | Med × Med | Create WS session only at Stage 3 entry, never on lesson open |
| Class has no `stage_content` (legacy / unseeded) | High × Low | Nullable column; empty `LessonStagesOut` → frontend skips to Stage 3 (graceful legacy path) |
| Editing Phase 2/4/5 owned files (ownership violation) | Med × Med | Import-only reuse; ownership table forbids edits; if a reused component needs a prop change, request it from that phase's owner — do not edit here |
| `grammar_focus.category` mismatched with Phase 4 categories | Med × Med | Seed categories from Phase 4's category vocabulary; Stage 2 falls back to "Skip" if generator returns empty |
| api.ts/types.ts merge conflict with parallel phases | Med × Low | Append-only; add at end of file, no shared-line edits |
| ClassRoom or stage files > 200 lines | Med × Low | Split into stage subcomponents (done by design); shell stays thin |

## Security Considerations
- `GET /classes/{id}/stages` requires auth (`get_current_student`); stage content is non-sensitive curriculum data, no per-student secrets.
- `PATCH /sessions/{id}/stage` ownership-checked (`session.student_id == current.id`) — a student cannot advance another student's session.
- No new Nova/Bedrock surface (Stage 3 reuses the existing audited WS auth + tool path); Stages 1/2/4 are pure REST/UI.
- XP remains server-authoritative via `complete_class` — the staged UI never sends an XP amount.
- Reused Phase 2 feedback endpoints already enforce ownership; this phase adds no new data-exposure path.

## Next Steps
- **Phase 8 (Weekly Reports)** can read `sessions.current_stage` for lesson-completion / drop-off analytics.
- **Phase 9 (Monetization)** may gate advanced stage content or the full 4-stage flow per plan.
- Unresolved: whether to award a small per-stage XP for Stage 1/2 engagement (deferred — YAGNI; keep XP single-sourced at `complete_class` until data shows the stages need their own incentive).
- Unresolved: whether `/classes/{id}` lives in its own route file today (the WS prompt_builder calls `GET /classes/{ref_id}`) — confirm route location before adding `/classes/{id}/stages` so the new endpoint mounts alongside it, not in a duplicate router.
