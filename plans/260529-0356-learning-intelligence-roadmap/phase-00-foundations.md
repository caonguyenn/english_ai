# Phase 0 — Foundations

## Context Links
- Plan overview: [plan.md](plan.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Current architecture: docs/architecture-specification.md, CLAUDE.md

## Overview
- **Priority:** P1 (blocks everything)
- **Status:** complete
- **Effort:** ~12h
- **Description:** Prepare the codebase for v2 work: migrate all PKs to UUIDv7 (clean reset), add turn timestamps to transcripts, fix the half-duplex audio interruption bug, and reconcile stale docs. No new product features — pure groundwork.

**Completion Note (2026-05-29):** All todo items completed successfully. Fresh UUID migration (f9e680a5420e_initial_uuid.py) applied; seed data restored; smoke test verified (dev-login, placement, class, playground, UUID round-trip all pass). Foundation ready for Phase 1.

## Key Insights
- Existing 8 tables use INTEGER PKs but original `architecture-specification.md` specified UUID — we restore that intent with **UUIDv7** (time-ordered, index-friendly).
- PostgreSQL 16 has **no native `uuidv7()`** → generate app-side with Python `uuid_utils.uuid7()` as SQLAlchemy column `default`.
- Dev data is throwaway (1 student, 48 test sessions) → **clean reset**, not a data-preserving migration.
- Turn timestamps in `transcript_json` are cheap to add now and unlock real fluency metrics (wpm, pauses) in Phase 1.
- Interruption bug: `useAudioCapture` streams every mic frame even while AI speaks → echo/noise triggers NovaSonic barge-in. Fix = half-duplex (mute mic while AI speaking).

## Requirements
### Functional
1. All DB tables (existing + future) use UUIDv7 PKs and UUID FKs.
2. `transcript_json` records a timestamp per turn (ISO-8601 or ms-since-session-start).
3. Mic is muted/suppressed while the AI is speaking; auto-unmutes when AI finishes.
4. Stale docs corrected (already partially done — verify).

### Non-Functional
- Zero blocking I/O on async event loop (CLAUDE.md rule).
- UUID generation must work with async SQLAlchemy + Alembic.

## Architecture
### UUIDv7 strategy
- Add `uuid_utils` to `backend/requirements.txt` (Rust-backed, provides `uuid7()`).
- Column pattern:
  ```python
  from uuid import UUID
  from uuid_utils import uuid7
  from sqlalchemy import Uuid
  # SQLAlchemy 2.x: use Uuid type; default callable returns uuid_utils UUID (cast to std uuid)
  id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=lambda: UUID(str(uuid7())))
  ```
  (Confirm `uuid_utils.UUID` ↔ stdlib `uuid.UUID` interop; wrap if needed.)
- All FK columns become `Mapped[UUID]` + `ForeignKey(..., Uuid)`.
- `cognito_sub` stays `String` (it's Cognito's value, not our PK).

### Clean reset migration
1. Update all 8 model files to UUID PKs/FKs.
2. Delete existing migration versions, regenerate a single fresh `initial` migration.
3. `alembic upgrade head` on empty DB → re-run `scripts/seed.py`.
4. `dev-login` re-creates the dev student fresh.

### Transcript timestamps
- Wherever transcript turns are appended (frontend transcript builder / WS event capture), add `ts` field per turn.
- Confirm `transcript_json` shape: `{ "turns": [{ "role", "text", "ts" }] }`.

### Half-duplex audio
- In `ClassRoom`/`PlacementSession`/`PlaygroundSession` (or shared hook), gate `wsRef.sendAudio` so frames are dropped while AI audio is playing.
- Signal: `useAudioPlayback` exposes an `isPlaying` flag, or WS `onContentStart(ASSISTANT)`/`onContentEnd` toggles a `aiSpeaking` ref. Drop captured frames while `aiSpeaking`.

## Related Code Files
### Modify
- `backend/app/db/models/*.py` (all 5 model files — UUID PKs/FKs)
- `backend/requirements.txt` (add `uuid_utils`)
- `backend/app/db/migrations/versions/*` (delete + regenerate single initial)
- `backend/app/schemas/*.py` (id fields `int` → `UUID`)
- `backend/app/api/v1/routes/*.py` (path params `int` → `UUID` where they reference ids)
- `frontend/src/types.ts` (id fields `number` → `string`)
- `frontend/src/hooks/useAudioCapture.ts` + `useAudioPlayback.ts` (half-duplex gating)
- `frontend/src/pages/modules/ClassRoom.tsx`, `PlacementSession.tsx`, `playground/PlaygroundSession.tsx` (wire aiSpeaking gate + transcript ts)
- `frontend/src/services/websocket.ts` (expose content-start/end for gating if needed)

### Verify (already reconciled)
- docs/new_version.md, docs/learning-intelligence.md, docs/database-learning-model.md, docs/adaptive-learning-engine.md

## Implementation Steps
1. Add `uuid_utils` to requirements; rebuild backend image/deps.
2. Define a shared UUID PK mixin/helper (`backend/app/db/base.py`) to keep models DRY.
3. Convert all 8 models to UUID PKs + UUID FKs.
4. Update Pydantic schemas: id/FK fields `UUID`.
5. Update route path params (`{session_id}` etc.) to `UUID` type.
6. Delete old migration versions; `alembic revision --autogenerate -m "initial_uuid"`.
7. `alembic upgrade head`; run `scripts/seed.py`; verify `dev-login`.
8. Update frontend `types.ts` ids `number → string`; fix any arithmetic/`Number()` usages on ids.
9. Add `ts` to transcript turns on capture.
10. Implement half-duplex mic gating; manually verify AI no longer self-interrupts.
11. Full smoke test: dev-login → placement → class → playground.

## Todo List
- [x] `uuid_utils` dependency added + installed
- [x] UUID PK helper in base.py
- [x] All 8 models on UUID PK/FK
- [x] Schemas updated to UUID
- [x] Route path params updated to UUID
- [x] Single fresh initial migration; upgrade + seed OK
- [x] dev-login works post-reset
- [x] Frontend types ids → string; no broken id math
- [x] Transcript turns carry `ts`
- [x] Half-duplex mic gating implemented + verified
- [x] Full smoke test passes

## Success Criteria
- `SELECT id FROM students;` returns a UUID; all FKs are UUID.
- New session's `transcript_json` turns each have a `ts`.
- During a class, speaking by the AI does not get interrupted by ambient noise.
- All existing flows (placement, class complete+XP, playground, modules list) work unchanged.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| `uuid_utils.UUID` vs stdlib UUID interop with asyncpg | Cast to `uuid.UUID` in default; test insert/select round-trip early |
| Frontend id-as-number assumptions break | Grep for `Number(id)`, id arithmetic, `parseInt` on ids; convert to string compares |
| Half-duplex blocks legitimate interruption | Acceptable per product decision (turn-based tutor); revisit if needed |
| Alembic autogenerate misses UUID server-defaults | We use app-side defaults, not server defaults — simpler; verify migration has no `server_default` for ids |

## Security Considerations
- UUIDv7 embeds a timestamp — acceptable here (ids aren't secrets; not used for capability access). Auth still via Cognito JWT + ownership checks.
- No change to token handling.

## Next Steps
- Unblocks **Phase 1** (analysis engine) and **Phase 3** (gamification).
