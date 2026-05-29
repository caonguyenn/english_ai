# Phase 2 — Feedback UI + AI Memory

## Context Links
- Plan overview: [plan.md](plan.md)
- Keystone (produces the data this phase reads): [phase-01-analysis-engine.md](phase-01-analysis-engine.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Specs: docs/ai-memory-system.md, docs/learning-intelligence.md, docs/FRONTEND.md (design tokens / card style), docs/database-learning-model.md

## Overview
- **Priority:** P1 (first consumer of the keystone; makes analysis visible to users)
- **Status:** complete
- **Depends on:** Phase 1 (reads `analysis_results` + `student_learning_profiles`; memory extractor rides Phase 1's Celery task)
- **Effort:** ~24h
- **Description:** Two-part phase.
  **(a) Feedback UI** — surface Phase-1 analysis in the frontend: a post-session feedback screen showing grammar mistakes (❌/✅ corrections), vocab used/suggested, fluency, and a 3-skill IELTS band estimate. Pronunciation shown as "coming soon". Two new ownership-checked REST endpoints feed it.
  **(b) AI Memory** — new `student_memories` table + a memory-extractor step that runs inside the SAME Phase-1 post-session Celery task (extracts personal/interests/goals via Nova Lite, stores type+value+confidence, NEVER stores sensitive data). `prompt_builder.py` is upgraded to inject stored memories into the system prompt so the AI can do "Last time you mentioned you work as a DevOps Engineer..." follow-ups.

## Key Insights
- **Read-only on Phase-1 data.** This phase does NOT re-run analysis. It adds REST read endpoints over `analysis_results` / `student_learning_profiles` and a feedback screen. If Phase 1 hasn't populated a row yet, endpoints return a graceful "analysis pending" state — never 500.
- **Memory extraction is cheap to co-locate.** The transcript is already loaded + a Nova Lite call already happens in `summarize.py` (Phase 1). Add ONE more structured extraction (or fold memory fields into the same analysis schema) rather than a second task — saves a second model round-trip. Decision: separate `converse()` call in its own module for clean separation + independent retry, but invoked from the same task after analysis succeeds.
- **Memory replaces the brittle "last 3 raw summaries" injection.** Current `prompt_builder.py` injects up to 3 `summary_json` blobs (≤500 chars each). Memories are structured, deduped, confidence-scored facts → far more durable and token-efficient continuity. Keep last-1 summary for short-term continuity; let memories carry long-term context.
- **Memory safety is a hard requirement** (docs/ai-memory-system.md): store only long-term-useful personal/interests/goals facts. NEVER store sensitive personal data, financial info, credentials, passwords. Enforce with an allow-list of `memory_type` + a refusal instruction in the extractor prompt + a server-side reject filter.
- **Confidence + verification lifecycle:** New memory → confidence score (0-100 from extractor) → only memories ≥ threshold injected into prompt → repeated mentions raise confidence (upsert on `(student_id, memory_type, memory_value)`).
- **UUIDv7 PKs** for `student_memories` per locked decision (`uuid_utils.uuid7()` as SQLAlchemy default). FK `student_id` → `students.id` (UUID after Phase 0).
- **ws/ reads memory via REST**, not direct DB. `prompt_builder.py` already calls the REST API for context; add one more call to `GET /students/{id}/memories` (internal-token path it already uses). Keeps ws/ DB-free.

## Requirements
### Functional
1. `GET /students/{id}/profile` — return `student_learning_profiles` row (estimated_band, 3 skill scores, strengths, weaknesses, updated_at). 404→graceful empty if not yet analyzed. Ownership-checked.
2. `GET /sessions/{id}/analysis` — return the `analysis_results` row for a session (grammar mistakes, vocab usage, fluency, band estimate, raw_json). Ownership-checked (session must belong to caller). "pending" state if no row yet.
3. `GET /students/{id}/memories` — return active memories (type, value, confidence) above injection threshold. Ownership-checked. Used by both frontend (optional display) and ws/ prompt builder.
4. Frontend feedback screen renders after a session ends: grammar mistakes list (❌ original / ✅ corrected + one-line reason), vocab used vs. suggested, fluency summary, 3-skill band card, pronunciation card labelled "Coming soon — needs audio analysis".
5. Memory extractor runs in the Phase-1 Celery task after analysis: Nova Lite extracts `{type, value, confidence}` facts (types: `personal|interests|goals` — sub-typed e.g. `job`, `country`, `family`, `hobby`, `target_band`).
6. Extractor rejects/skips any sensitive category; upserts into `student_memories` (raise confidence + refresh `updated_at` on repeat).
7. `prompt_builder.py` injects memories above threshold into the system prompt, phrased for natural callback ("You mentioned...").

### Non-Functional
- Endpoints additive under `/api/v1`; no change to existing route contracts.
- Memory extraction idempotent per session (re-run does not duplicate facts; upsert key = `(student_id, memory_type, lower(memory_value))`).
- Prompt token budget: cap injected memories (e.g. top 8 by confidence) so the system prompt stays bounded.
- Frontend strict TS, GSAP for entrance animation, design tokens from docs/FRONTEND.md (cards = `--bg-surface`, `--border-subtle`, `--radius-lg`; skill colors for band bars).
- api.ts / types.ts additions are **append-only** (see file-ownership note) to avoid conflict with the Phase 3 parallel track.

## Architecture
```
── (a) Feedback path ───────────────────────────────────────────────
session ends → Phase-1 task writes analysis_results + profile
SessionSummary / FeedbackScreen mounts
  → GET /sessions/{id}/analysis   (analysis_results row)
  → GET /students/{id}/profile    (rolling profile)
  → render grammar/vocab/fluency/band cards (pronunciation = "coming soon")

── (b) Memory path ─────────────────────────────────────────────────
Phase-1 Celery task (backend/app/tasks/summarize.py)
  → after analysis success:
      memory_extractor.extract(transcript) → Nova Lite converse()
        → [{type, value, confidence}]  (sensitive cats refused/dropped)
      → MemoryService.upsert_many(student_id, facts)   [sync, in-task]
  → student_memories table

next session handshake (ws/ :8080)
  prompt_builder.build_system_prompt()
    → GET /students/{id}/memories  (REST :8000, threshold-filtered)
    → inject "Student facts: job=DevOps Engineer; goal=IELTS 6.5; ..."
    → AI uses for natural callbacks
```

### Module split (keep files < 200 lines, DRY)
- Backend memory: `backend/app/db/models/memory.py` (model only), `backend/app/services/memory_service.py` (upsert/query — sync helpers callable from Celery + async helpers for routes; keep small, split if >200), `backend/app/services/analysis/memory_extractor.py` (Nova Lite extraction prompt + parse, reuses Phase-1 `nova_client`).
- Backend feedback REST: `backend/app/api/v1/routes/feedback.py` (the 3 read endpoints), `backend/app/schemas/feedback.py` (ProfileOut, AnalysisOut, MemoryOut Pydantic v2).
- ws/: modify `ws/app/services/prompt_builder.py` only (add memory fetch + injection helper; if it pushes the file >200 lines, extract a `prompt_memory.py` helper in ws/app/services).
- Frontend: `frontend/src/pages/FeedbackScreen.tsx` (or extend `components/session/SessionSummary.tsx` — see decision below) + small subcomponents under `components/session/feedback/` (GrammarMistakes, VocabPanel, BandCard, PronunciationComingSoon).

### Decision: extend SessionSummary vs. new FeedbackScreen
Extend by composition: keep `SessionSummary.tsx` as the shell (it already mounts post-session), add a `<FeedbackPanels analysis={...} profile={...} />` block fed by the two new endpoints. New screen only if SessionSummary would exceed 200 lines — then split panels into `components/session/feedback/`.

### Memory extractor output schema (Nova Lite, JSON-enforced)
```json
{
  "memories": [
    { "type": "job",        "value": "DevOps Engineer", "confidence": 90 },
    { "type": "hobby",      "value": "photography",      "confidence": 70 },
    { "type": "target_band","value": "6.5",              "confidence": 95 }
  ]
}
```
Allowed `type` values (allow-list): `name, job, country, family, hobby, interest, goal, target_band, study_reason`. Anything else → dropped. Sensitive markers (password, card, account number, address, health, etc.) → extractor instructed to refuse + server filter drops.

### `student_memories` table (UUIDv7)
```sql
student_memories (
  id UUID PK DEFAULT (app-side uuid7),
  student_id UUID FK→students.id,
  memory_type VARCHAR NOT NULL,          -- from allow-list
  memory_value TEXT NOT NULL,
  confidence_score INT NOT NULL,         -- 0-100
  source_session_id UUID FK→sessions.id NULL,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  UNIQUE (student_id, memory_type, memory_value)
)
```

## Related Code Files
### Create
- `backend/app/db/models/memory.py` — `StudentMemory` model (UUIDv7 PK/FK, unique constraint).
- `backend/app/services/memory_service.py` — upsert_many (sync, Celery-safe) + get_active (async, route).
- `backend/app/services/analysis/memory_extractor.py` — Nova Lite extraction (reuses `analysis/nova_client.py`), allow-list + sensitive filter.
- `backend/app/api/v1/routes/feedback.py` — `GET /students/{id}/profile`, `GET /sessions/{id}/analysis`, `GET /students/{id}/memories`.
- `backend/app/schemas/feedback.py` — `ProfileOut`, `AnalysisOut`, `MemoryOut`.
- Alembic migration for `student_memories`.
- Tests: `backend/tests/unit/test_memory_extractor.py`, `test_memory_service.py`; `backend/tests/integration/test_feedback_routes.py`.
- `frontend/src/pages/FeedbackScreen.tsx` (only if SessionSummary would exceed 200 lines) + `frontend/src/components/session/feedback/` panels.
### Modify
- `backend/app/tasks/summarize.py` — after Phase-1 analysis succeeds, call `memory_extractor.extract()` + `MemoryService.upsert_many()`.
- `backend/app/db/models/__init__.py` — register `StudentMemory` for Alembic.
- `backend/app/api/v1/router.py` — include `feedback` router.
- `ws/app/services/prompt_builder.py` — fetch `GET /students/{id}/memories`, inject memory block (replace/augment current last-3-summaries logic → keep last-1 summary, add memories).
- `frontend/src/components/session/SessionSummary.tsx` — mount feedback panels.
- `frontend/src/services/api.ts` — **append** `getSessionAnalysis(id)`, `getStudentProfile(id)`, `getStudentMemories(id)`.
- `frontend/src/types.ts` — **append** `AnalysisResult`, `LearningProfile`, `Memory` types.
### File ownership (THIS phase owns; do not let Phase 3 touch)
- `backend/app/db/models/memory.py`, `backend/app/services/memory_service.py`, `backend/app/services/analysis/memory_extractor.py`
- `backend/app/api/v1/routes/feedback.py`, `backend/app/schemas/feedback.py`
- `ws/app/services/prompt_builder.py` (+ optional `ws/app/services/prompt_memory.py`)
- `frontend/src/pages/FeedbackScreen.tsx`, `frontend/src/components/session/feedback/*`
- **Shared (append-only):** `api.ts`, `types.ts`, `backend/app/api/v1/router.py`, `backend/app/db/models/__init__.py`, `backend/app/tasks/summarize.py` — append blocks; never rewrite existing lines.

## Implementation Steps
1. Add `StudentMemory` model (UUIDv7 PK, `uuid_utils.uuid7` default, unique constraint) + register in `__init__.py`; autogenerate migration; `alembic upgrade head`.
2. Write `feedback.py` schemas (`ProfileOut`, `AnalysisOut`, `MemoryOut`) mirroring Phase-1 model fields + memory.
3. Build `feedback.py` routes with `_assert_own` ownership pattern (copy from `students.py`). For `/sessions/{id}/analysis`: load session, verify `session.student_id == current.id`, then read its `analysis_results`. Return `{status: "pending"}` shape when no row.
4. Include `feedback` router in `router.py`.
5. Write `memory_extractor.py`: extraction system prompt (allow-list types, explicit refuse-sensitive rule), call `nova_client` converse() with JSON schema, parse → Pydantic, drop disallowed types + sensitive matches.
6. Write `memory_service.py`: `upsert_many` (sync, ON CONFLICT raise confidence to max + bump updated_at), `get_active` (async, filter `confidence >= MEMORY_INJECT_MIN`, order by confidence desc, cap 8).
7. Wire extractor + upsert into `summarize.py` AFTER analysis block; wrap in try/except so a memory failure never fails the analysis (log + continue).
8. Add `MEMORY_INJECT_MIN_CONFIDENCE` (default 60) + cap to config.
9. Upgrade `prompt_builder.py`: add `GET /students/{id}/memories` to the parallel fetch; build a memory block ("Here is what you remember about {name}: job — DevOps Engineer; goal — IELTS 6.5; ...") instructing natural callback; reduce raw-summary injection to last 1.
10. Frontend: add api.ts methods + types.ts types (append). Build feedback panels (GrammarMistakes ❌/✅, VocabPanel used/suggested, BandCard 3 skills + overall, PronunciationComingSoon). GSAP stagger entrance via `gsap.context()`. Use design tokens.
11. Mount panels in `SessionSummary.tsx`; fetch analysis + profile on mount (React Query); show skeleton while "pending".
12. Tests: extractor parse + sensitive-drop; service upsert/dedup math; route ownership 403 + pending state; manual: run a session, confirm feedback renders + next session AI references a memory.

## Todo List
- [ ] `student_memories` model + migration applied
- [ ] feedback schemas (Profile/Analysis/Memory)
- [ ] feedback routes (3) with ownership + pending state
- [ ] router includes feedback
- [ ] memory_extractor (allow-list + sensitive refusal)
- [ ] memory_service upsert (dedup) + get_active (threshold/cap)
- [ ] summarize.py wires extractor (non-fatal on failure)
- [ ] config MEMORY_INJECT_MIN_CONFIDENCE
- [ ] prompt_builder injects memories (last-3-summaries → last-1 + memories)
- [ ] frontend api.ts + types.ts appended
- [ ] feedback panels + SessionSummary mount (GSAP, tokens)
- [ ] unit + integration tests pass
- [ ] manual: feedback renders + AI memory callback next session

## Success Criteria
- After an analyzed session, feedback screen shows ≥1 grammar correction (❌/✅), vocab panel, fluency line, 3-skill band card; pronunciation card reads "Coming soon".
- `GET /students/{id}/profile` and `GET /sessions/{id}/analysis` return 200 for owner, 403 for non-owner, graceful "pending" before analysis exists.
- Memory extractor produces ≥1 valid memory from a transcript that states a job/interest/goal; zero sensitive memories stored.
- AI references a stored memory in ≥1 of the first 3 turns of the next session (matches report success metric).
- No raw `transcript_json` ever injected into the prompt.

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Memory extractor stores sensitive data | Low × High | Allow-list `memory_type` + refuse-instruction in prompt + server-side reject filter + unit test asserting sensitive input → 0 stored |
| Extractor failure breaks Phase-1 task | Med × High | Wrap extraction in try/except in `summarize.py`; analysis already committed; log + continue |
| Prompt bloat from too many memories | Med × Med | Threshold filter (≥60) + cap 8 by confidence; drop oldest/lowest |
| Memory dedup drift (near-duplicates) | Med × Low | Unique key `(student_id, type, value)`; normalize value (lower/trim) before upsert |
| Feedback endpoint 500 when analysis not yet run | Med × Med | Return `{status:"pending"}` shape, never raise; frontend skeleton |
| api.ts/types.ts merge conflict with Phase 3 | Med × Low | Append-only convention; both phases add at end of file, no shared-line edits |
| prompt_builder change regresses live sessions | Low × High | Keep static fallback path; memory fetch is best-effort (return_exceptions); manual regression on class/playground/placement |
| ws reads DB directly (arch violation) | Low × High | ws/ uses REST `GET /students/{id}/memories` only — never imports backend DB |

## Security Considerations
- **Sensitive-data exclusion** is the dominant control: allow-list + prompt refusal + server filter. Treat as a correctness requirement, not a nicety.
- Ownership checks on all 3 endpoints (`_assert_own`; session endpoint verifies `session.student_id == current.id`).
- Do not log memory values or transcripts at INFO; redact in error logs.
- Memories are PII-adjacent — only the owning student can read them; no admin/global memory endpoint in this phase.
- ws/ memory fetch uses the student's own token (existing handshake token) — no privilege escalation.

## Next Steps
- **Phase 6 (4-Stage Lessons)** consumes the feedback screen as its "Feedback" stage.
- **Phase 8 (Weekly Reports)** aggregates the same profile/analysis data over time.
- Memory store becomes the continuity backbone reused by all later conversational phases.
- Unresolved: whether to add memory decay/expiry (defer — YAGNI until data shows stale memories hurt; revisit in Phase 8).
