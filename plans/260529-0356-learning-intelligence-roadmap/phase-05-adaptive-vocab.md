# Phase 5 — Adaptive Vocabulary + Word Unlock

## Context Links
- Plan overview: [plan.md](plan.md)
- Keystone (produces inputs): [phase-01-analysis-engine.md](phase-01-analysis-engine.md)
- Coordinates with: [phase-02-feedback-and-memory.md](phase-02-feedback-and-memory.md) (shares `prompt_builder.py` injection)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Spec: docs/learning-intelligence.md (Vocabulary Analyzer), docs/new_version.md (Word Unlock + Adaptive Vocab), docs/adaptive-learning-engine.md, docs/database-learning-model.md

## Overview
- **Priority:** P2 (consumer of Phase 1)
- **Status:** complete
- **Depends on:** Phase 1 (analysis engine produces vocabulary usage in `analysis_results.raw_json`)
- **Effort:** ~24h
- **Description:** Track every word a student actually uses in conversation into `student_vocabulary` (mastery + usage counts, derived from Phase 1 vocab output — never re-analyzed). Implement **Word Unlock**: the AI introduces target words (injected into the NovaSonic system prompt); when the student later *uses* an unlocked word in a real conversation (detected by Phase 1 analysis), award **+20 XP** and mark it mastered. Surface vocabulary growth + word-unlock badges in the UI. Suggested upgrades (e.g. happy → delighted) appear as recommendations.

## Key Insights
- **Pure consumer of Phase 1 for usage detection.** Words used are read from `analysis_results.raw_json.vocabulary` (the words-used list Phase 1 emits). No new transcript analysis here. The ONLY optional Nova Lite text call is generating *suggested upgrade* words (cheap, optional, can start as a static synonym map — YAGNI: defer Nova upgrade suggestions if static map suffices).
- **Word Unlock is a two-event lifecycle:** (1) AI *introduces* a word → `word_unlocks` row created with `introduced_at`, `used_at=NULL`, `xp_awarded=0`; (2) student *uses* that word later → set `used_at`, award +20 XP once, mark the matching `student_vocabulary.mastery_score` as mastered. The award is idempotent (only fires when `used_at` was NULL).
- **`prompt_builder.py` COORDINATION (critical):** Word Unlock injects an *additive* prompt section ("introduce these target words naturally: …"). **Phase 2 (AI Memory) also injects an additive section** (recalled student memories) into the same `prompt_builder.py`. Both phases append to one prompt. To avoid merge conflict + prompt-section sprawl, **recommend a single prompt-assembly refactor** (a list of section-builder functions composed in one place) so Phase 2 memory and Phase 5 word-unlock sections compose cleanly. See "Architecture → prompt_builder coordination."
- **Word selection for introduction:** pick from the student's current band's target vocabulary that is NOT yet in `student_vocabulary` (or low mastery). Cap to ~3 words/session to keep the prompt focused.
- **Mastery math (docs/learning-intelligence.md):** mastery rises on correct use, repeated use, and use across multiple contexts (distinct sessions/topics). Keep simple: `mastery += delta` capped at 100, larger delta for first-time-in-new-context.
- **XP:** +20 XP per confirmed word-unlock use. Reuse the existing XP-award path (`SessionService` pattern / shared helper) — do NOT create a parallel XP ledger. Word Unlock XP is *additive* to the class XP already awarded by `SessionService.complete_class_session`.
- **Files < 200 lines:** split into a `vocab/` service package.

## Requirements
### Functional
1. After each Phase 1 analysis lands, upsert `student_vocabulary` from the analysis vocab list (per word: bump `usage_count`, update `last_used_at`, set `first_seen_at` if new, apply mastery delta).
2. In the same fold, detect word-unlock reuse: for any unlocked word (`word_unlocks.used_at IS NULL`) that appears in this session's vocab usage → set `used_at`, award +20 XP once, mark mastered.
3. Word introduction: `prompt_builder.py` injects up to N target words for the session; create `word_unlocks` rows (`introduced_at` set, `used_at` NULL) when a session starts. (Introduction trigger: on session create OR first prompt build — decide in step 5; recommend at prompt-build to avoid a WS→REST write round-trip, persisted via a small REST endpoint or shared service.)
4. `GET /api/v1/students/{id}/vocabulary` → list of tracked words with mastery + usage (ordered by recency / mastery).
5. `GET /api/v1/students/{id}/word-unlocks` → unlock history (introduced, used, xp_awarded) for badges/notifications.
6. Frontend: vocabulary growth widget (count + mastery distribution) and word-unlock notification/badge (GSAP) shown when a word is newly used.

### Non-Functional
- Upsert + unlock-award idempotent per `analysis_results` row (no double XP on Celery retry).
- Word matching normalized (lowercase, lemmatized-ish: simple stem/exact match acceptable for v1 — flag fancier matching as future work).
- Ownership enforced on read endpoints.
- All new tables UUIDv7 PKs/FKs via `uuid_utils.uuid7()` SQLAlchemy `default`.
- No file > 200 lines.

## Architecture
```
[Session start / first prompt build]
   prompt_builder.build_system_prompt(...)
     → word_unlock_service.pick_words(student, band, n=3)   # not-yet-mastered band words
     → create word_unlocks rows (introduced_at, used_at=NULL)
     → APPEND prompt section: "Naturally introduce and encourage use of: delighted, sustainable, ..."

[Phase 1 analysis lands] analysis_results.raw_json.vocabulary[]
   → vocab_service.upsert_usage(student_id, analysis_result)     [from Phase 1 Celery task]
        → per word: upsert student_vocabulary (usage_count++, mastery delta, timestamps)
   → word_unlock_service.detect_and_award(student_id, words_used, analysis_result)
        → for unlocked word with used_at NULL present in words_used:
             set used_at, award +20 XP (idempotent), mark mastery mastered

[UI] GET /students/{id}/vocabulary       → growth widget
     GET /students/{id}/word-unlocks      → unlock badges / notifications
```

### prompt_builder coordination (Phase 2 + Phase 5)
Today `build_system_prompt` is one long function that string-concatenates sections. Phase 2 (memory recall) and Phase 5 (word unlock) both need to append a section. **Recommended refactor (do it in whichever of P2/P5 lands first; the other consumes it):**
```python
# ws/app/services/prompt_builder.py
# Each builder takes the gathered context, returns a string fragment ("" if N/A).
SECTION_BUILDERS = [
    _persona_section,
    _student_context_section,
    _weakness_section,
    _recent_summaries_section,
    _memory_section,        # Phase 2 (additive)
    _word_unlock_section,   # Phase 5 (additive)  ← introduce target words
    _session_type_section,
    _tools_section,
    _output_style_section,
]
prompt = " ".join(b(ctx) for b in SECTION_BUILDERS if b(ctx))
```
> **Coordination flag:** both Phase 2 and Phase 5 edit `ws/app/services/prompt_builder.py`. They must NOT land simultaneously without this refactor or they will conflict. Sequence them, or land the section-builder refactor first as a tiny shared prep commit, then each phase adds only its own `_*_section`. Word-unlock injection is strictly ADDITIVE to Phase 2's memory injection — they are independent fragments.

### New module split (vocab/ package, keep files < 200 lines, DRY)
- `backend/app/services/vocab/__init__.py`
- `backend/app/services/vocab/vocab_service.py` — upsert usage from analysis, mastery math, list
- `backend/app/services/vocab/word_unlock_service.py` — pick words to introduce, create unlock rows, detect reuse + award +20 XP
- `backend/app/services/vocab/mastery.py` — pure mastery-delta functions (correct / repeated / multi-context)
- `backend/app/services/vocab/target_words.py` — band → candidate target-word source (static list v1; optional Nova upgrade-suggestion hook)

### Mastery delta (simple v1)
- new word: `mastery = 20`
- repeated use (same context): `+5`
- used in a new context (distinct session/topic): `+15`
- word-unlock confirmed use: jump to `mastered` (e.g. `max(mastery, 80)`)
- cap at 100.

## Related Code Files
### Create
- `backend/app/db/models/vocab.py` (`StudentVocabulary`, `WordUnlock`)
- `backend/app/services/vocab/__init__.py`, `vocab_service.py`, `word_unlock_service.py`, `mastery.py`, `target_words.py`
- `backend/app/schemas/vocab.py` (`VocabularyOut`, `WordUnlockOut`)
- `backend/app/api/v1/routes/vocab.py` (2 GET routes; mount in `router.py`)
- Alembic migration for `student_vocabulary` + `word_unlocks`
- `frontend/src/components/vocab/VocabularyGrowthWidget.tsx` (GSAP count/mastery viz)
- `frontend/src/components/vocab/WordUnlockBadge.tsx` (GSAP unlock notification)
- Tests: `backend/tests/unit/test_vocab_mastery.py`, `test_word_unlock_service.py`, `test_vocab_service.py`; `backend/tests/integration/test_vocab_routes.py`
### Modify
- `backend/app/db/models/__init__.py` (register 2 new models for Alembic)
- `backend/app/api/v1/router.py` (`include_router(vocab.router)`)
- `backend/app/tasks/summarize.py` (call `vocab_service.upsert_usage` + `word_unlock_service.detect_and_award` after Phase 1 analysis persists — idempotent fold)
- `ws/app/services/prompt_builder.py` (**COORDINATED** with Phase 2: section-builder refactor + `_word_unlock_section`; create unlock rows on prompt build)
- `frontend/src/services/api.ts` (additive: `getVocabulary`, `getWordUnlocks`)
- `frontend/src/types.ts` (additive: `VocabularyWord`, `WordUnlock`)
- `frontend/src/pages/Dashboard.tsx` and/or `frontend/src/pages/profile/ProfilePage.tsx` (render growth widget)
- `frontend/src/pages/modules/ClassRoom.tsx` (show WordUnlockBadge when a word newly unlocks — fed by session-end summary)

## Implementation Steps
1. Add `StudentVocabulary` + `WordUnlock` SQLAlchemy models (UUIDv7 PK/FK via `uuid_utils.uuid7()` default), register in `__init__.py`, autogenerate + apply migration.
2. Define Pydantic schemas in `schemas/vocab.py`.
3. `mastery.py`: pure delta functions (new / repeated / multi-context); unit-testable, no DB.
4. `target_words.py`: band → candidate words not yet mastered for the student (static list v1; leave a TODO hook for Nova-Lite upgrade suggestions).
5. `word_unlock_service.pick_words(...)`: choose ≤3 target words, create `word_unlocks` rows (`used_at=NULL`). Decide introduction trigger = at prompt build (persist via shared service / small internal endpoint so WS can create rows).
6. `vocab_service.upsert_usage(student_id, analysis_result)`: per word from analysis vocab list, upsert `student_vocabulary` (usage_count++, mastery delta, timestamps); idempotent per analysis id.
7. `word_unlock_service.detect_and_award(...)`: for unlocked words with `used_at NULL` present in this session's words-used, set `used_at`, award +20 XP once (shared XP helper), bump mastery to mastered.
8. Hook steps 6+7 into `summarize.py` right after Phase 1 writes `analysis_results` (single idempotent fold, inside Celery transaction).
9. **prompt_builder refactor (coordinate with Phase 2):** introduce `SECTION_BUILDERS` list; add `_word_unlock_section`. If Phase 2 already refactored, just add the section fn. Keep file < 200 lines (extract sections if needed).
10. `routes/vocab.py`: 2 GET endpoints + `_assert_own`; mount in `router.py`.
11. Frontend `api.ts` + `types.ts` additive entries.
12. `VocabularyGrowthWidget.tsx`: word count + mastery distribution, GSAP count-up; place on Dashboard/Profile.
13. `WordUnlockBadge.tsx`: GSAP celebratory badge when session summary reports a newly used unlocked word (+20 XP).
14. Tests: mastery deltas, upsert idempotency, unlock award fires once, integration of 2 routes + ownership.
15. Manual: introduce a target word via a session → use it in a later session → confirm +20 XP awarded once + `used_at` set + mastery mastered + badge shows.

## Todo List
- [ ] 2 models + migration applied
- [ ] vocab Pydantic schemas
- [ ] mastery.py pure delta functions
- [ ] target_words.py band candidates
- [ ] word_unlock_service pick_words + create rows
- [ ] vocab_service.upsert_usage (idempotent)
- [ ] word_unlock_service.detect_and_award (+20 XP, idempotent)
- [ ] both folds wired into summarize.py
- [ ] prompt_builder section-builder refactor + _word_unlock_section (coordinated w/ Phase 2)
- [ ] 2 REST routes + ownership
- [ ] frontend api.ts / types.ts additive
- [ ] VocabularyGrowthWidget + WordUnlockBadge (GSAP)
- [ ] unit + integration tests pass
- [ ] real-session manual verification (introduce → use → +20 XP once)

## Success Criteria
- Words from a real session's Phase 1 vocab output appear in `student_vocabulary` with sensible mastery/usage.
- AI introduces target words (prompt contains the word-unlock section); rows created with `used_at NULL`.
- Using an unlocked word in a later session awards exactly +20 XP once and marks it mastered.
- Re-running the fold on the same analysis does NOT re-award XP.
- Vocabulary growth widget reflects accumulated words; unlock badge fires on confirmed use.
- `prompt_builder.py` composes Phase 2 memory + Phase 5 word-unlock sections without conflict.

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Double +20 XP on Celery retry | Med × High | Award only when `used_at` is NULL; idempotent fold keyed to analysis id; reuse single XP path |
| prompt_builder merge conflict with Phase 2 | High × Med | Section-builder refactor; sequence P2/P5 or land refactor first; sections are independent fragments |
| Word match misses (inflections) | Med × Med | Normalize lowercase + simple stem v1; flag lemmatization as future; rely on Phase 1 emitting base forms |
| Parallel XP ledger drift | Low × High | Reuse `SessionService`/shared XP helper; never invent second ledger |
| WS must create unlock rows (no DB in ws/?) | Med × Med | Introduce via shared service or a small internal REST write; persist at prompt build (matches existing ws→REST httpx pattern) |
| UUID FK depends on Phase 0 reset | Low × Med | Phase 0 migrates students.id → UUID first; gate start on Phase 0 done |
| Files > 200 lines | Med × Low | vocab/ package split (done by design); extract prompt sections |

## Security Considerations
- Ownership check (`_assert_own`) on both GET endpoints.
- XP awarded server-side only, on confirmed reuse detected by Phase 1 analysis — never trust client claims of word use.
- Word-unlock XP award is idempotent (guarded by `used_at IS NULL`) — prevents replay/abuse.
- Target-word list is server-derived → no user-controlled prompt-injection surface in the word-unlock section.
- Do not log full vocabulary lists at INFO (learner data).

## Next Steps
- **Phase 6 (4-Stage Lessons)** uses the vocab/word-unlock system for its "Vocabulary" stage.
- **Phase 8 (Weekly Reports)** reads `student_vocabulary` growth + word-unlock counts for the dashboard.
- Shares the recommended-XP convention with **Phase 4**; keep XP constants (`+20` unlock, recommended multiplier) in one shared config.
- **Coordinate the `prompt_builder.py` refactor with Phase 2 before either ships** — this is the single cross-phase integration point in this track.

## Unresolved Questions
- Word-introduction trigger location: at prompt build (WS) vs. session create (REST)? Recommend prompt build for freshness, persisted via shared service — confirm ws/ has a write path or add a thin internal endpoint.
- Lemmatization/inflection matching for reuse detection: simple stem v1 vs. a proper lemmatizer (e.g. spaCy)? Recommend v1 simple + revisit if miss-rate high.
- Suggested upgrades (happy→delighted): static synonym map vs. Nova Lite call? Recommend static map first (YAGNI), add Nova only if needed.
