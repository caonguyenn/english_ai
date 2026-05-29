# Phase 7 — IELTS Mock Test

## Context Links
- Plan overview: [plan.md](plan.md)
- Keystone (REUSED for scoring): [phase-01-analysis-engine.md](phase-01-analysis-engine.md)
- Feedback panels reference: [phase-02-feedback-and-memory.md](phase-02-feedback-and-memory.md) (band-card UI pattern reused)
- Coordinates with (same file, separate branch): [phase-02-feedback-and-memory.md](phase-02-feedback-and-memory.md), [phase-05-adaptive-vocab.md](phase-05-adaptive-vocab.md) (both touch `prompt_builder.py`)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Spec: docs/new_version.md (IELTS Mock Test — Part 1/2/3 + band breakdown), docs/learning-intelligence.md (IELTS Scoring Engine), docs/FRONTEND.md (band-card / timer styling)

## Overview
- **Priority:** P2 (premium feature; gated in Phase 9)
- **Status:** complete
- **Depends on:** Phase 1 (REUSES the analysis/scoring engine — does NOT build a new scorer)
- **Effort:** ~24h
- **Description:** Simulate a full IELTS Speaking exam over a single Nova Sonic session: **Part 1** intro Q&A (Home / Work / Studies / Hobbies), **Part 2** cue card (1-min prep + 2-min speech), **Part 3** discussion (advanced follow-ups). Introduce a new `session_type='mock_test'`. The exam runs as a structured Nova Sonic session driven by a new `prompt_builder` `mock_test` branch (3-part script with cue-card + prep-timer semantics). On completion, the **Phase 1 analysis engine scores the transcript** → produces an **Estimated IELTS Band** + breakdown: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy (Pronunciation deferred → "coming soon"). Results persisted (linked to the session) and shown in a band-breakdown results screen.

## Key Insights
- **REUSE the Phase 1 scoring engine — do not reinvent it.** The mock test is just another transcript. When a `mock_test` session ends, the existing `summarize_session` Celery task runs Phase 1's Nova Lite analysis exactly as for a class session. The mock-test "result" is a thin **read view** over Phase 1's `analysis_results` (band + 3-skill breakdown) for that session — no second scoring model. The ONLY additions are: the session type, the prompt branch, and a results endpoint/screen.
- **Storage decision (KISS): reuse `analysis_results` via session linkage; add a thin `mock_test_results` only if needed.** Phase 1 already writes one `analysis_results` row per session keyed by `session_id`. A mock test's band + breakdown live there. Recommend a small `mock_test_results` (UUIDv7 PK, `session_id` FK, `part_completed` flags, `cue_card_topic`, `created_at`) ONLY to capture mock-specific metadata (which parts were completed, the cue-card prompt shown) — the SCORES stay in `analysis_results`. Do not duplicate band fields. If part-metadata proves unnecessary, drop the table and read `analysis_results` directly (YAGNI re-check at build time).
- **One Nova Sonic session, three scripted parts.** Reuse the existing WS flow (`ws/` server) and the existing `record_skill_score`/(no `complete_class`) tool surface. The 3-part structure is expressed entirely in the system prompt (`prompt_builder` `mock_test` branch): the AI conducts Part 1 → introduces a cue card and instructs a 1-min think + 2-min talk → runs Part 3 follow-ups → closes. Like placement, scoring is NOT done by live tools — it is the post-session Phase 1 pass (removes the tool-timing fragility).
- **Prep/timer semantics are UI-side, signaled via the script.** The 1-min prep and 2-min speech limits are coached by the AI verbally ("You have one minute to prepare…") AND enforced as a visible **countdown timer** in the frontend. The backend does not hard-cut audio; the timer is advisory UX (matching real IELTS pacing). Cue-card text is chosen by the AI from a band-appropriate set (or a seeded cue-card list) and surfaced to the UI via a WS JSON event so the prep timer can display the card.
- **`prompt_builder.py` coordination flag (low conflict).** Phase 2 (memory) and Phase 5 (word-unlock) also edit `prompt_builder.py`. The `mock_test` branch is a SEPARATE `session_type` branch alongside the existing `class`/`playground`/`placement` branches — it does NOT touch the memory/word-unlock sections. Conflict risk is low but real: if the section-builder refactor from Phase 2/5 has landed, add `_mock_test_section` to the builder list; otherwise add an `elif session_type == "mock_test"` branch mirroring the placement branch. Flag for sequencing, do not co-edit the same lines.
- **Enum migration is the one breaking-shaped change.** `session_type` is a Postgres enum (`session_type_enum`, see `db/models/session.py`). Adding `mock_test` requires an `ALTER TYPE ... ADD VALUE` migration (Postgres-specific; cannot run inside a transaction block in older PG — use `op.execute` with autocommit/`ALTER TYPE ADD VALUE IF NOT EXISTS`). Additive only; existing values unchanged.
- **Band = 3-criterion estimate.** Pronunciation excluded everywhere (Phase 1 emits `pronunciation: null`). Results screen shows Fluency & Coherence / Lexical Resource / Grammatical Range & Accuracy + an overall, with a Pronunciation card labelled "Coming soon — needs audio analysis" (matches Phase 2 convention).
- **Premium-gated, but gating is Phase 9.** This phase builds the feature and marks it `premium` (a flag/route the Phase 9 gating reads). Do NOT implement payment/subscription checks here — just leave the gate seam.

## Requirements
### Functional
1. Extend `SessionType` enum with `mock_test` (model + Postgres enum migration). `class_id` and `topic_id` both NULL for mock tests (like placement).
2. Mock-test session creation: reuse `POST /sessions` with `session_type='mock_test'` (no ref_id). WS connects with `type=mock_test`, no `ref_id`.
3. `prompt_builder` `mock_test` branch: 3-part examiner script — Part 1 (Home/Work/Studies/Hobbies short Q&A), Part 2 (announce a cue card + 1-min prep + ~2-min talk), Part 3 (abstract follow-up discussion), then a brief close. NO live scoring tools mid-exam (scoring is post-session Phase 1). The AI emits the cue-card text early in Part 2 so the UI can show it.
4. WS event for the cue card: the `mock_test` flow surfaces the cue-card prompt to the client (JSON event, e.g. `{"event":{"cueCard":{"topic":"...","bullets":[...]}}}`) so the frontend prep timer can display it. (Mechanism mirrors existing `levelUp`/`classComplete` WS events.)
5. On session end → existing `summarize_session` Phase 1 analysis runs (no change) → writes `analysis_results` for the session. Optionally write `mock_test_results` metadata (parts completed, cue-card topic).
6. `GET /api/v1/sessions/{id}/mock-result` → returns the band + 3-criterion breakdown (read from `analysis_results`) + mock metadata; ownership-checked; "pending" shape until Phase 1 lands.
7. Frontend mock-test flow: part stepper (Part 1 · Part 2 · Part 3), cue-card display card, prep countdown timer (1 min) + speech timer (2 min), live transcript + mic (reuse session audio components), and a **results screen** with band overall + 3 criterion bars (GSAP) + "Pronunciation coming soon" card.
8. Mock test entry surfaced (e.g. Dashboard tile) and marked `premium` (gating seam for Phase 9).

### Non-Functional
- Scoring is **100% reused Phase 1** — zero new analysis model code; mock-result endpoint is a read view.
- Enum migration additive (`ADD VALUE IF NOT EXISTS`), non-transactional where required by PG; no existing rows altered.
- New table (if kept) UUIDv7 PK/FK via `uuid_utils.uuid7()` SQLAlchemy `default`.
- `prompt_builder.py` change is a SEPARATE branch (coordinate with Phase 2/5; low conflict).
- Frontend strict TS; GSAP via `gsap.context()` for timers + results bars; design tokens from docs/FRONTEND.md.
- `api.ts` / `types.ts` additions **append-only**.
- No file > 200 lines (split the `mock_test` prompt into a helper if `prompt_builder.py` exceeds budget; split mock-test page into part/timer/results subcomponents).

## Architecture
```
[Start mock test] POST /sessions {session_type:"mock_test"}        (class_id/topic_id NULL)
   → WS /ws/session?type=mock_test   (no ref_id)
   → prompt_builder.build_system_prompt("mock_test", None, token)
        → _mock_test_section: Part 1 Q&A → Part 2 cue card (1-min prep, 2-min talk)
          → Part 3 discussion → close.  NO scoring tools mid-exam.
        → AI emits cue-card text early in Part 2 → WS event {cueCard:{topic,bullets}}

[During exam] frontend:
   Part stepper drives UI; on cueCard event → show card + start 1-min prep countdown,
   then 2-min speech timer (advisory; AI also paces verbally). Existing mic/transcript reused.

[Session ends] PATCH /sessions/{id} stores transcript
   → summarize_session.delay(id)   [EXISTING Phase 1 task — unchanged]
        → Nova Lite analysis → analysis_results (band + fluency/lexical/grammar; pronunciation null)
   → (optional) write mock_test_results {session_id, parts_completed, cue_card_topic}

[Results screen] GET /sessions/{id}/mock-result
   → read analysis_results for session (+ mock metadata)
   → band overall + 3 criterion bars + "pronunciation coming soon"; "pending" until analysis lands
```

### Backend module split (keep files < 200 lines, DRY)
- `backend/app/db/models/session.py` — **add** `mock_test` to `SessionType` enum.
- `backend/app/db/models/mock_test.py` — (optional) `MockTestResult` model (UUIDv7 PK, `session_id` FK, `parts_completed` JSONB, `cue_card_topic`, `created_at`). Only the SCORES stay in `analysis_results`.
- `backend/app/services/mock_test_service.py` — assemble the mock-result read view from `analysis_results` (+ metadata); small.
- `backend/app/schemas/mock_test.py` — `MockTestResultOut` (band, 3-criterion breakdown, parts_completed, cue_card_topic, status).
- `backend/app/api/v1/routes/mock_test.py` — `GET /sessions/{id}/mock-result` (or add to `sessions.py` — recommend a dedicated file to keep `sessions.py` lean).
- `ws/app/services/prompt_builder.py` — **add** `mock_test` branch; if it pushes the file > 200 lines, extract `ws/app/services/prompt_mock_test.py` (a pure function returning the 3-part script fragment).

### Frontend component split (OWNED by this phase)
- `frontend/src/pages/mock-test/MockTestSession.tsx` — exam shell (part stepper + WS + mic + transcript + cue-card/timer orchestration).
- `frontend/src/components/mock-test/PartStepper.tsx` — Part 1·2·3 progress (GSAP).
- `frontend/src/components/mock-test/CueCard.tsx` — cue-card display.
- `frontend/src/components/mock-test/PrepTimer.tsx` — 1-min prep + 2-min speech countdown (GSAP ring/bar).
- `frontend/src/pages/mock-test/MockTestResult.tsx` — band overall + 3 criterion bars + pronunciation "coming soon" (GSAP).
- `frontend/src/pages/mock-test/MockTestHome.tsx` — premium entry tile (gating seam for Phase 9).

### `mock_test_results` table (optional; UUIDv7)
```sql
mock_test_results (
  id UUID PK DEFAULT (app-side uuid7),
  session_id UUID FK→sessions.id UNIQUE,
  parts_completed JSONB,          -- {"part1": true, "part2": true, "part3": false}
  cue_card_topic TEXT NULL,
  created_at TIMESTAMPTZ
)
```
> Band/criterion SCORES are NOT stored here — they live in Phase 1's `analysis_results` keyed by `session_id`. This table holds only mock-specific metadata. Drop it if metadata proves unused (read `analysis_results` directly).

## Related Code Files
### Create
- `backend/app/db/models/mock_test.py` — (optional) `MockTestResult` model.
- `backend/app/services/mock_test_service.py` — mock-result read-view assembly.
- `backend/app/schemas/mock_test.py` — `MockTestResultOut`.
- `backend/app/api/v1/routes/mock_test.py` — `GET /sessions/{id}/mock-result`.
- `ws/app/services/prompt_mock_test.py` — (if needed) mock_test prompt fragment.
- Alembic migration: `ALTER TYPE session_type_enum ADD VALUE 'mock_test'` (+ create `mock_test_results` if kept).
- `frontend/src/pages/mock-test/MockTestHome.tsx`, `MockTestSession.tsx`, `MockTestResult.tsx`
- `frontend/src/components/mock-test/PartStepper.tsx`, `CueCard.tsx`, `PrepTimer.tsx`
- Tests: `backend/tests/unit/test_mock_test_service.py`, `test_prompt_mock_test.py`; `backend/tests/integration/test_mock_test_routes.py`
### Modify
- `backend/app/db/models/session.py` — add `mock_test` to `SessionType`.
- `backend/app/db/models/__init__.py` — register `MockTestResult` (if kept) for Alembic.
- `backend/app/api/v1/router.py` — include `mock_test` router.
- `ws/app/services/prompt_builder.py` — add `mock_test` branch (SEPARATE branch; coordinate with Phase 2/5).
- `ws/app/routes/session_ws.py` — add `mock_test` to `_VALID_TYPES`; allow no `ref_id` for mock_test (mirror placement); emit cue-card WS event.
- `ws/app/services/tool_handler.py` — accept `session_type='mock_test'` (no `complete_class`; `record_skill_score` optional — scoring is post-session, so live tools may be omitted entirely).
- `frontend/src/services/api.ts` — **append** `getMockTestResult(sessionId)`, `createMockTestSession()` helper.
- `frontend/src/types.ts` — **append** `MockTestResult`, `CueCard`, mock-test session-type union extension.
- `frontend/src/services/websocket.ts` — **append** `onCueCard` handler (additive event).
- `frontend/src/App.tsx` — routes for `/mock-test`, `/mock-test/session`, `/mock-test/result/:id`.
### File ownership (THIS phase owns)
- **Owns:** `backend/app/db/models/mock_test.py`, `backend/app/services/mock_test_service.py`, `backend/app/schemas/mock_test.py`, `backend/app/api/v1/routes/mock_test.py`, `ws/app/services/prompt_mock_test.py`, `frontend/src/pages/mock-test/*`, `frontend/src/components/mock-test/*`, the enum migration.
- **Shared (append-only / separate branch):** `ws/app/services/prompt_builder.py` (mock_test branch — coordinate with Phase 2/5), `session_ws.py`, `tool_handler.py`, `session.py` (enum value), `router.py`, `__init__.py`, `api.ts`, `types.ts`, `websocket.ts`, `App.tsx`.
- **Reuses read-only (DO NOT edit):** Phase 1 `analysis/*` + `summarize.py` (mock tests flow through it unchanged); Phase 2 band-card UI pattern (may import or mirror `BandCard`).

## Implementation Steps
1. Add `mock_test` to `SessionType` enum in `db/models/session.py`. Write a migration with `op.execute("ALTER TYPE session_type_enum ADD VALUE IF NOT EXISTS 'mock_test'")` (non-transactional / autocommit as PG requires). Apply.
2. (Optional) Add `MockTestResult` model (UUIDv7 PK, `session_id` FK UNIQUE, `parts_completed` JSONB, `cue_card_topic`, `created_at`); register in `__init__.py`; include in the same migration.
3. `prompt_builder` `mock_test` branch (or `prompt_mock_test.py` fragment): write the 3-part examiner script — Part 1 short Q&A (Home/Work/Studies/Hobbies); Part 2 cue card (announce topic + bullets, "1 minute to prepare, then speak for up to 2 minutes"); Part 3 abstract follow-ups; close warmly. Instruct the AI to state the cue-card topic clearly so the WS layer/UI can capture it. NO mid-exam scoring tools.
4. `session_ws.py`: add `mock_test` to `_VALID_TYPES`; permit missing `ref_id` for `mock_test` (mirror placement guard); detect/emit a `cueCard` WS JSON event when the AI presents the cue card (parse from a structured marker or a dedicated tool — recommend a lightweight `present_cue_card(topic, bullets)` tool OR text-marker parse; keep it KISS).
5. `tool_handler.py`: handle `session_type='mock_test'` — no `complete_class`; `record_skill_score` optional (scoring is post-session). If using a `present_cue_card` tool, route it to the WS cue-card emitter.
6. Confirm `summarize_session` (Phase 1) runs unchanged for `mock_test` sessions (it keys off transcript presence, not session type) → produces `analysis_results`.
7. `schemas/mock_test.py`: `MockTestResultOut {status, band_overall, fluency_coherence, lexical_resource, grammatical_range_accuracy, pronunciation: null, parts_completed, cue_card_topic}`.
8. `mock_test_service.py`: load session (ownership in route), read its `analysis_results`; map Phase 1 fields → IELTS criterion names; return "pending" if no analysis yet; merge `mock_test_results` metadata if present.
9. `routes/mock_test.py`: `GET /sessions/{id}/mock-result` with `_assert_own` (session belongs to caller); mount in `router.py`.
10. Frontend `api.ts` + `types.ts` + `websocket.ts` additive entries (`getMockTestResult`, `createMockTestSession`, `onCueCard`, types).
11. `MockTestSession.tsx`: create `mock_test` session, connect WS (no ref_id), reuse mic/transcript; `PartStepper` reflects exam part; on `cueCard` event → show `CueCard` + start `PrepTimer` (1-min prep → 2-min speech). On WS close / session end → navigate to result screen.
12. `MockTestResult.tsx`: fetch `getMockTestResult(sid)`; render band overall + 3 criterion bars (GSAP count-up) + "Pronunciation coming soon" card; skeleton while "pending" (poll until analysis lands).
13. `MockTestHome.tsx`: premium entry tile; mark `premium` (gating seam — Phase 9 enforces). Add routes in `App.tsx`.
14. Tests: prompt fragment contains all 3 parts + cue-card + prep/talk timing language; service maps analysis → criteria + pending state; route ownership 403 + pending shape; enum migration applies (mock_test session creatable). Manual: run a full mock test → confirm cue card displays + timer runs + result screen shows a band breakdown after analysis.

## Todo List
- [ ] SessionType `mock_test` + enum ADD VALUE migration applied
- [ ] (optional) MockTestResult model + migration
- [ ] prompt_builder mock_test branch (3 parts + cue card + prep/talk timing)
- [ ] session_ws: mock_test in _VALID_TYPES, no-ref_id allowed, cueCard event emitted
- [ ] tool_handler handles mock_test (no complete_class; cue-card route)
- [ ] Phase 1 summarize runs unchanged for mock_test (verified)
- [ ] mock_test schemas (MockTestResultOut)
- [ ] mock_test_service read-view (maps analysis → IELTS criteria, pending state)
- [ ] GET /sessions/{id}/mock-result route + ownership
- [ ] frontend api.ts / types.ts / websocket.ts appended
- [ ] MockTestSession (part stepper, cue card, prep/speech timers, mic/transcript)
- [ ] MockTestResult (band + 3 criterion bars, pronunciation coming-soon, GSAP)
- [ ] MockTestHome premium tile + App.tsx routes
- [ ] unit + integration tests pass
- [ ] manual: full mock test → cue card + timer + band-breakdown result

## Success Criteria
- A `mock_test` session can be created and run end-to-end over one Nova Sonic session covering Parts 1, 2 (cue card), and 3.
- The cue card is displayed in the UI and a 1-min prep + 2-min speech countdown runs during Part 2.
- On completion, the EXISTING Phase 1 task scores the transcript (no new scoring code) and the result screen shows an Estimated IELTS Band + Fluency & Coherence / Lexical Resource / Grammatical Range & Accuracy bars.
- Pronunciation is shown as "Coming soon" (never a fake score); band is a 3-criterion estimate.
- `GET /sessions/{id}/mock-result` returns 200 for owner, 403 for non-owner, "pending" before analysis lands.
- `prompt_builder.py` mock_test branch coexists with class/playground/placement (and Phase 2/5 sections) without regressing them.
- The mock test entry is marked `premium` (Phase 9 can gate it) but is not payment-blocked in this phase.

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Enum migration fails (PG ADD VALUE in transaction) | Med × High | Use `ALTER TYPE ... ADD VALUE IF NOT EXISTS` via `op.execute` with autocommit; test apply on a copy; additive only |
| Reinventing the scorer instead of reusing Phase 1 | Med × High | mock-result is a READ VIEW over `analysis_results`; no new analysis model; verify `summarize` runs for mock_test |
| prompt_builder.py conflict with Phase 2/5 | Med × Med | mock_test is a SEPARATE branch; coordinate sequencing; extract `prompt_mock_test.py` if file > 200 lines |
| Cue-card text not reaching the UI | Med × Med | Emit a dedicated `cueCard` WS event (via `present_cue_card` tool or marker parse); fallback: show a seeded cue card if no event |
| Tool-timing fragility (live scoring) | Low × High | No live scoring tools in mock_test (scoring is post-session Phase 1) — same fix as placement |
| Timer enforcement expectations | Med × Low | Timers are advisory UX (AI also paces verbally); backend never hard-cuts audio — documented as IELTS-style pacing aid |
| Premium gating leaks (unpaid access) | Med × Med | This phase only marks `premium`; server-side enforcement is Phase 9 — leave a clear gate seam, do not claim it is enforced here |
| New table duplicates band fields | Low × Med | `mock_test_results` holds ONLY metadata; scores stay in `analysis_results` — no duplicate source of truth |
| UUID FK depends on Phase 0 reset | Low × Med | Phase 0 migrates `sessions.id` → UUID first; gate start on Phase 0 done |

## Security Considerations
- `GET /sessions/{id}/mock-result` ownership-checked (`session.student_id == current.id`) — a student cannot read another's mock result.
- WS handshake reuses the existing audited token auth (`session_ws.py` first-message pattern); `mock_test` adds no new auth surface.
- No live scoring tools → no `X-Internal-Secret` level-up path invoked from mock tests; cue-card tool (if added) carries no privilege.
- Transcript may contain personal info — Phase 1 already redacts; do not log mock transcripts or cue-card answers at INFO.
- Premium gating is a Phase 9 server-side control; do NOT rely on the UI tile alone to restrict access — flag the seam explicitly so Phase 9 enforces it on session creation + result read.
- Band breakdown is text-derived + pronunciation-excluded — label honestly to avoid misrepresenting an official IELTS score.

## Next Steps
- **Phase 9 (Monetization)** gates mock-test session creation + result access behind the Pro plan (server-side), reading the `premium` seam left here.
- **Phase 8 (Weekly Reports)** can include mock-test band trend over time (reads the same `analysis_results`).
- Unresolved: cue-card source — AI-chosen from band-appropriate set vs. a seeded `cue_cards` list? Recommend AI-chosen (KISS, no new table) with a small seeded fallback; revisit if AI cue cards drift off-band.
- Unresolved: keep `mock_test_results` metadata table or read `analysis_results` directly? Recommend building the table only if part-completion / cue-card metadata is actually surfaced; otherwise drop it (YAGNI).
- Unresolved: cue-card capture mechanism — dedicated `present_cue_card` tool vs. text-marker parse in `session_ws.py`? Recommend the tool (clean, structured) if it does not reintroduce tool-timing fragility (presenting a card mid-exam is safe; scoring is what must stay post-session).
