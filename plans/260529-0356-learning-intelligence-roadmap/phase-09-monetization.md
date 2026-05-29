# Phase 9 — Monetization

## Context Links
- Plan overview: [plan.md](plan.md)
- Design report: [brainstorm-260529-0356-learning-intelligence-roadmap.md](../reports/brainstorm-260529-0356-learning-intelligence-roadmap.md)
- Gated features (must exist first): [phase-02-feedback-and-memory.md](phase-02-feedback-and-memory.md), [phase-07-mock-test.md](phase-07-mock-test.md), [phase-08-weekly-reports.md](phase-08-weekly-reports.md)
- Quota model reference: `backend/app/services/session_service.py` (`_apply_playground_xp_cap`)
- Spec: docs/new_version.md (Monetization)

## Overview
- **Priority:** P2 (revenue; ships LAST — gates features that must already exist)
- **Status:** pending
- **Depends on:** Phase 2 (AI memory), Phase 7 (mock test), Phase 8 (weekly reports) — these are the Pro-gated features
- **Effort:** ~24h
- **Description:** Introduce Free vs Pro plans with **server-side** feature gating. Free = limited daily speaking minutes, basic feedback, beginner path. Pro ($9–15/mo) = unlimited speaking, full mock tests, advanced analytics, AI memory, study plans, weekly reports. Add a `subscriptions` table, a gating dependency/service that wraps protected routes + WS session creation, a daily speaking-minute quota for free tier, and a payment webhook to sync subscription state.

## Key Insights
- **BUILD LAST.** You cannot sell mock tests, AI memory, or weekly reports before they exist. This phase only adds the gate + billing on top of already-shipped features. If a dependency phase is incomplete, its gate is a no-op stub (don't block this phase, but don't gate a non-existent route).
- **Gating MUST be server-side, not UI hiding.** Hiding an upgrade button in React stops nothing — a user can call the API directly. The authoritative gate is a FastAPI dependency on protected REST routes AND a plan/quota check inside WS session creation. UI hiding is a UX nicety layered on top.
- **Quota reuses the proven playground XP-cap pattern.** `_apply_playground_xp_cap` already sums today's usage under a `SELECT FOR UPDATE` lock and caps against a daily limit. The daily speaking-minute quota is structurally identical: sum today's session minutes, compare to the free-tier cap, refuse new sessions when exhausted. Reuse the pattern (DRY) — don't invent a new concurrency model.
- **Speaking minutes already derivable** from `sessions.started_at/ended_at` (same source Phase 8 uses). No new usage table needed for the quota check — sum on demand at session start.
- **The gate wraps existing routes; it does not rewrite them.** Phase 7/8 routes keep their handlers untouched; we add `dependencies=[Depends(require_pro)]` (or equivalent) at the router level. Document exactly which routes get gated.
- **Webhook is the source of truth for subscription state — never trust the client.** The frontend never sets `plan=pro`. Only a verified provider webhook (signature-checked) flips `subscriptions.status` to active.
- **Payment provider is NOT finalized.** Stripe is the assumed default for the build, but the team appears Vietnam-based and target pricing is $9–15/mo — VN-local providers (VNPay, MoMo, ZaloPay) may be required. This is the #1 unresolved question (see end). Isolate provider specifics behind a thin adapter so swapping is cheap.

## Requirements
### Functional
1. `subscriptions` table: one row per student (`student_id` UUID PK FK), `plan` (free|pro), `status` (active|past_due|canceled|none), `period_end` TIMESTAMPTZ.
2. Every student defaults to `plan=free, status=active` (lazily created on first `/auth/me` if absent, or via Post-Confirmation Lambda extension).
3. A `require_pro` FastAPI dependency: resolves the current student's effective plan, raises 402 (Payment Required) with an upgrade hint if not active-Pro.
4. Free-tier daily speaking-minute quota enforced **at session creation** (REST `POST /sessions` and WS `/ws/session`): refuse new sessions once today's minutes ≥ free cap.
5. Gated surfaces (Pro-only): IELTS mock test (Phase 7), weekly reports (Phase 8), AI-memory-backed prompts / advanced analytics (Phase 2), study plans (Phase 1 output surfaced in Phase 8).
6. `GET /subscription` — current student's plan + status + period_end.
7. `POST /billing/checkout` — create a provider checkout session, return redirect URL (Pro upgrade).
8. `POST /billing/webhook` — provider webhook; verify signature; upsert `subscriptions.status`/`period_end` from the event. Idempotent on event id.
9. Frontend: pricing/upgrade page, plan badge in TopBar, upgrade CTAs on gated features, paywall modal on 402.
### Non-Functional
- Webhook handler idempotent (dedupe by provider event id) and signature-verified before any DB write.
- Quota check uses `SELECT FOR UPDATE` on the student row (same lock discipline as XP cap) to avoid race over-grant.
- Provider secrets via `pydantic-settings` only (never hard-coded, never client-exposed).
- Backend never stores card data — all card handling is provider-hosted (Checkout).

## Architecture
```
[upgrade]
  Frontend "Upgrade" → POST /billing/checkout
       → BillingAdapter.create_checkout(student) → provider Checkout URL
       → redirect user to provider-hosted payment page
  provider → POST /billing/webhook (signed)
       → verify signature → parse event → upsert subscriptions(status=active, period_end)
  next /auth/me or /subscription → reflects Pro

[gate — REST]
  protected route  dependencies=[Depends(require_pro)]
       → load subscription → active Pro? proceed : raise 402 + upgrade hint

[gate — session creation / quota]
  POST /sessions  &  WS /ws/session
       → SubscriptionService.check_session_allowed(student)
            Pro            → unlimited, allow
            Free + class/placement on beginner path → allow
            Free + speaking minutes today ≥ cap     → refuse (402 / WS close 1008 "quota_exhausted")
```

### Payment provider decision (FLAGGED — NOT FINAL)
**Assumed for build: Stripe Checkout + signed webhook.** Rationale: best-documented, fastest to integrate, hosted card capture (no PCI burden).
**Open risk:** target market appears Vietnam-based ($9–15/mo) — Stripe has limited VN support; **VNPay / MoMo / ZaloPay** may be mandatory. To keep the swap cheap, all provider calls go through a thin `BillingAdapter` interface (`create_checkout`, `verify_webhook`, `parse_event`). Implement `StripeAdapter` first; a `VNPayAdapter` etc. can drop in without touching routes/services.
**This is the #1 unresolved question — do not finalize Stripe without user confirmation (see Unresolved Questions).**

### New module split (keep files < 200 lines, DRY)
- `backend/app/services/subscription_service.py` — effective-plan resolution, `check_session_allowed` (quota), lazy default-free creation.
- `backend/app/services/billing/` package:
  - `adapter.py` — `BillingAdapter` Protocol (`create_checkout`, `verify_webhook`, `parse_event`).
  - `stripe_adapter.py` — Stripe implementation (default). Provider-specific code isolated here.
- `backend/app/core/dependencies.py` — add `require_pro` dependency (sits beside existing `get_current_student`).

### Models / schemas
- New model `subscriptions` (UUIDv7-consistent: `student_id` UUID PK FK → students.id, `plan` VARCHAR, `status` VARCHAR, `period_end` TIMESTAMPTZ, `provider_customer_id` VARCHAR NULL, `updated_at`).
- Optional `billing_events` (UUIDv7 PK, `provider_event_id` UNIQUE, `received_at`) for webhook idempotency — minimal, recommended.
- Pydantic v2: `SubscriptionResponse`, `CheckoutRequest`, `CheckoutResponse`, `WebhookAck`.

### Routes gated by `require_pro` (wrap, do NOT rewrite)
| Route | Phase | Gate |
|---|---|---|
| `GET /students/{id}/reports`, `/reports/current` | 8 | `require_pro` |
| mock-test routes (e.g. `POST /mock-tests`, results) | 7 | `require_pro` |
| advanced-analytics / memory-backed endpoints | 2 | `require_pro` |
| `POST /sessions` (speaking) | core | quota check (not require_pro) |
| `WS /ws/session` | core | quota check inside session_ws |

## Related Code Files
### Create
- `backend/app/db/models/subscription.py` (subscriptions + optional billing_events)
- `backend/app/services/subscription_service.py`
- `backend/app/services/billing/__init__.py`, `adapter.py`, `stripe_adapter.py`
- `backend/app/schemas/subscription.py`
- `backend/app/api/v1/routes/subscription.py` (`GET /subscription`)
- `backend/app/api/v1/routes/billing.py` (`POST /billing/checkout`, `POST /billing/webhook`)
- Alembic migration for `subscriptions` (+ `billing_events`)
- Tests: `backend/tests/unit/test_subscription_service.py`, `backend/tests/unit/test_billing_adapter.py`, `backend/tests/integration/test_gating.py`, `backend/tests/integration/test_billing_webhook.py`
- Frontend: `frontend/src/pages/billing/PricingPage.tsx`, `frontend/src/components/billing/PlanBadge.tsx`, `frontend/src/components/billing/PaywallModal.tsx`, `frontend/src/components/billing/UpgradeCta.tsx`
### Modify
- `backend/app/db/models/__init__.py` (register Subscription + BillingEvent)
- `backend/app/core/dependencies.py` (add `require_pro`)
- `backend/app/core/config.py` (add `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `FREE_DAILY_SPEAKING_MINUTES`)
- `backend/app/api/v1/router.py` (mount subscription + billing routers; attach `require_pro` to Phase 7/8 routers)
- `backend/app/api/v1/routes/sessions.py` (`POST /sessions`: call `check_session_allowed`)
- `backend/app/services/session_service.py` (quota helper alongside XP cap — reuse lock pattern)
- `ws/app/routes/session_ws.py` (after auth, before stream init: plan + quota check; close 1008 `quota_exhausted` if refused)
- `frontend/src/services/api.ts` (additive: `getSubscription()`, `createCheckout()`)
- `frontend/src/types.ts` (additive: `Subscription`, `Plan`, `CheckoutResponse`)
- `frontend/src/store/authStore.ts` (additive: expose `plan`/`status` for UI gating)
- `frontend/src/App.tsx` or router (add `/pricing` route)

## Implementation Steps
1. Add `subscriptions` (+ optional `billing_events`) model (UUIDv7-consistent PK/FK); register; migrate; `alembic upgrade head`.
2. Add config keys (`BILLING_PROVIDER`, Stripe keys, `FREE_DAILY_SPEAKING_MINUTES`).
3. Build `subscription_service.py`: `get_or_create_free(student)`, `effective_plan(student)`, `check_session_allowed(student)` (sum today's session minutes under `SELECT FOR UPDATE`, compare to free cap; Pro = unlimited).
4. Add `require_pro` dependency in `dependencies.py` (402 + upgrade hint when not active-Pro).
5. Build `billing/adapter.py` Protocol + `stripe_adapter.py` (`create_checkout`, `verify_webhook`, `parse_event`). Isolate all Stripe SDK calls here.
6. Build `subscription.py` route (`GET /subscription`) and `billing.py` routes (`POST /billing/checkout`, `POST /billing/webhook` — verify signature, dedupe by event id, upsert status/period_end).
7. Mount routers in `router.py`; attach `require_pro` to Phase 7 (mock test) + Phase 8 (reports) routers and any Phase 2 advanced-analytics endpoints. Document the gated list (table above).
8. Wire quota: `POST /sessions` calls `check_session_allowed` (402 on refusal); `session_ws.py` performs the same check post-auth and closes 1008 `quota_exhausted` on refusal.
9. Frontend: `api.ts` + `types.ts` + `authStore` additive entries; build `PricingPage`, `PlanBadge` (TopBar), `PaywallModal` (shown on 402), `UpgradeCta` on gated screens.
10. Tests: quota math + lock behavior, `require_pro` 402, webhook signature verify + idempotent upsert, WS refusal path, free→pro transition via webhook.
11. Manual: free user hits speaking cap → paywall; complete provider test checkout → webhook flips Pro → gated features unlock.

## Todo List
- [ ] subscriptions (+ billing_events) model + migration applied
- [ ] config keys (provider + Stripe + FREE_DAILY_SPEAKING_MINUTES)
- [ ] subscription_service: plan resolution + check_session_allowed (locked quota)
- [ ] require_pro dependency (402 + upgrade hint)
- [ ] BillingAdapter Protocol + StripeAdapter
- [ ] GET /subscription + POST /billing/checkout + POST /billing/webhook (signed, idempotent)
- [ ] require_pro attached to Phase 7 + Phase 8 + Phase 2 routes (documented list)
- [ ] quota wired into POST /sessions + WS session creation (1008 quota_exhausted)
- [ ] frontend PricingPage + PlanBadge + PaywallModal + UpgradeCta
- [ ] api.ts + types.ts + authStore additive entries
- [ ] integration tests pass (gating + webhook + WS refusal)
- [ ] manual verification: cap → paywall → checkout → Pro unlock
- [ ] PAYMENT PROVIDER confirmed with user (Stripe vs VNPay/MoMo/ZaloPay)

## Success Criteria
- A free user is blocked server-side from mock tests + reports (402), and from starting a session past the daily speaking-minute cap (REST 402 / WS 1008) — verified by direct API calls, not just UI.
- A verified provider webhook flips a student to Pro; gated features unlock without app restart.
- Webhook is signature-verified and idempotent (replaying the same event id does not double-apply).
- No card data touches the backend (provider-hosted checkout).
- UI hiding is purely cosmetic — removing it never grants access (gate holds).

## Risk Assessment
| Risk | Likelihood × Impact | Mitigation |
|---|---|---|
| Payment provider wrong (Stripe vs VN) | High × High | `BillingAdapter` abstraction; CONFIRM provider with user before integration (unresolved Q #1) |
| Client-side-only gating bypassed via direct API | Med × High | Authoritative `require_pro` + quota in FastAPI/WS; UI hiding cosmetic only |
| Webhook spoofing | Med × High | Signature verification before any DB write; reject unsigned/invalid |
| Webhook replay double-applies | Med × Med | `billing_events.provider_event_id` UNIQUE dedupe |
| Quota race (concurrent sessions over-grant) | Med × Med | `SELECT FOR UPDATE` on student row (reuse XP-cap discipline) |
| Gating a route that doesn't exist yet (dep phase incomplete) | Med × Low | Gate only shipped routes; stub gate is a no-op until its phase lands |
| Provider secrets leak to client | Low × High | Secrets in `pydantic-settings` server-only; never in `import.meta.env` |
| WS quota check adds session-start latency | Low × Med | Single indexed sum query post-auth; cache plan in-request |

## Security Considerations
- All gates server-side (FastAPI dependency + WS check). Frontend hiding is UX only and never authoritative.
- Webhook endpoint is public but signature-verified; reject before touching DB. Rate-limit if exposed.
- `subscriptions` writes happen only via verified webhook (or internal admin) — never from a student-controlled request body.
- `GET /subscription` ownership-scoped to the current student (no reading others' plans).
- Backend stores no card/PAN data; provider hosts checkout (PCI scope stays with provider). Cognito still owns credentials; AccessToken in memory, RefreshToken HttpOnly cookie unchanged.
- Do not log webhook payloads or secrets at INFO.

## Next Steps
- **This is the final roadmap phase.** After it lands, re-validate the full plan and update `docs/new_version.md` Monetization section to match the shipped gating + provider choice.
- Future (post-launch, YAGNI now): annual billing, promo codes, dunning/past-due recovery emails, multi-currency.
- Once the payment provider is confirmed, implement the matching adapter and finalize the price ID(s).

## Unresolved Questions
1. **PAYMENT PROVIDER (BLOCKING — decide first):** Stripe is assumed for the build, but the team/market appears Vietnam-based with $9–15/mo pricing. Should we ship Stripe, or a VN-local provider (VNPay / MoMo / ZaloPay)? Provider choice changes the adapter, checkout flow, and webhook format. **Do not start billing integration until the user confirms.**
2. Free-tier daily speaking-minute cap value — what number (e.g. 10? 15?) for `FREE_DAILY_SPEAKING_MINUTES`?
3. Is the "beginner learning path only" free restriction enforced by module band gating, or just messaging? (Affects whether `require_pro` also gates higher modules.)
4. Trial period for Pro (e.g. 7-day free trial) — in scope for launch or later?
