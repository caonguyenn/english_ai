# Phase 0 Foundations: UUID Migrations & Half-Duplex Audio Gating

**Date**: 2026-05-29 04:40  
**Severity**: High  
**Component**: Database PKs, audio stack, frontend type system  
**Status**: Resolved

## What Happened

Migrated all 8 core tables from INTEGER to UUIDv7 primary keys, implemented half-duplex audio gating to suppress mic while AI speaks, and rewired frontend types from `number` to `string` IDs. Fresh migration generated post-clean-DB reset, seeded with uuid_utils. Code review caught three critical bugs before ship.

## Bugs Caught & Fixed

1. **xp_in_module counting wrong sessions** — summed ALL sessions ever, not just class sessions in current module. Fixed: added Class join + module_id filter in session_service.
2. **Audio gate tied to wrong events** — was keyed to contentStart/contentEnd (fired for text blocks too). Fixed: moved to audioOutput (AI starts) and completionEnd (AI fully done).
3. **to_module_id fallback nonsense** — sent `0` when student at max module; Pydantic rejected it. Fixed: changed fallback to `null`.
4. **PlacementStepper UI mismatch** — showed "of 8" but prompt asks 6 questions. Fixed: hardcoded 6.

## What Changed

- **Database**: 8 tables migrated via UUIDPrimaryKey mixin. Migration f9e680a5420e_initial_uuid. Fresh seed validates UUID round-trip.
- **Audio**: Half-duplex gate now correctly suppresses mic during AI speech via WebSocket audioOutput/completionEnd events.
- **Frontend**: All id fields `number` → `string` across types.ts, stores, services, pages.
- **Schema**: SessionResponse xp_awarded had no default (caused 500 on in-progress sessions). Fixed: `= 0`.

## Decisions

- Kept uuid_utils for consistent UUIDv7 generation across backend and migrations.
- Audio gate tied to _event_ lifecycle, not content type — cleaner than parsing content role.
- Frontend type change propagated everywhere at once rather than gradual; caught cascading issues faster.

## Next

- Monitor UUID collision risk in production (should be nil, but log first week's ID generation).
- Validate half-duplex gate doesn't drop final AI words in rapid sequences (test with placement questions).
- Audit playground XP cap logic — xp_in_module fix may have exposed related counting issues.

**Commit**: cea971d — feat: implement Phase 0 foundations - UUID PKs, half-duplex audio, string IDs
