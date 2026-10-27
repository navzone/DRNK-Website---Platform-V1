# Implementation Plan and Progress

Last updated: 2026-10-27.

## Status by module

Legend: DONE = built and covered by automated tests that were run. PARTIAL = built with stated gaps. NOT DONE = deliberately or necessarily absent.

| Module | Status | Notes |
| --- | --- | --- |
| Schema, migrations, seed | DONE | 35 tables, 2 SQL migrations, demo seed (refuses production) |
| Mobile-OTP auth, sessions, roles | DONE (dev adapter only) | Real SMS/OTP provider NOT wired; login impossible on staging/production until it is |
| Explore (venues, offers, events) | DONE | Public pages and APIs |
| Reservations | PARTIAL | No capacity model; merchant confirms manually |
| Dine-in table sessions and orders | PARTIAL | No online payment; alcohol items refused; no API to close a table session |
| Event booking, holds, tickets | DONE | Atomic inventory, 15-minute hold, expiry job endpoint |
| Payments | PARTIAL | Provider abstraction, sandbox, signed idempotent webhooks DONE. Razorpay adapter written but UNVERIFIED; Checkout.js UI step NOT built |
| Refunds | PARTIAL | `requested` rows are created when money cannot be matched to a booking. No execution or admin UI |
| Rewards ledgers | PARTIAL | Immutable ledgers, manual tiers, rule-driven earning DONE. No rates/thresholds exist until the approved spec supplies them |
| Talent directory and enquiries | PARTIAL | Admin creates profiles; no talent self-registration |
| Account, consents, data requests, support | PARTIAL | Request workflows only; no automated erasure |
| Merchant workspace | PARTIAL | Orders, reservations, events, venues. Menu management is API only |
| Admin console | PARTIAL | Approvals, roles, tiers, lists, support, data requests, audit. No MFA |
| Legal pages | DRAFT | 12 placeholder pages needing counsel review |
| CI | DONE (not run on GitHub) | `.github/workflows/ci.yml` written; no remote exists |
| Browser e2e (Playwright) | PASS on Chromium | 46 passed, 2 skipped. Other browsers not tested |
| UI design (AI Studio prototype port) | PARTIAL | New look and navigation applied to all public and account pages. See `DESIGN_PORT.md` for what was deliberately not taken |
| Staging / production deployment | NOT DONE | No platform, domain, or credentials |

## Test and quality gates at last run

See `TEST_PLAN.md` for the evidence. Summary: 126/126 Vitest tests pass against real Postgres; lint, typecheck and production build pass; 49/49 HTTP smoke checks pass against `next start`.

## Exact next step

1. Provide the approved rewards specification, then insert the `reward_rules` rows (or confirm the proposed `earn.event_booking` shape) and add tier thresholds.
2. Choose an OTP/SMS provider (India DLT registration is required for SMS) and implement the `ConfiguredOtpProvider` adapter in `src/server/auth/otp-provider.ts`. Until then, nobody can log in on staging.
3. Create a Razorpay test account, set `PAYMENT_PROVIDER=razorpay` with test keys on staging, add the Checkout.js step to `BookingActions`, and verify the real webhook (signature header, event ids, payload shape) end to end.
4. Choose a hosting platform, create the staging environment per `DEPLOYMENT_RUNBOOK.md`, and configure the expiry scheduler.
5. Run an accessibility audit and test Firefox and Safari; Chromium e2e already passes.
6. Have counsel review `src/content/legal.ts` and fill every `[DRNK TO PROVIDE: ...]`.

## Outstanding decisions (owner: DRNK)

| # | Decision | Blocks |
| --- | --- | --- |
| 1 | Reward earning rates, tier thresholds/multipliers, point expiry | Any points being awarded |
| 2 | Alcometer credit earning/spending rules and its relationship to the old ML Wallet | Alcometer activity |
| 3 | OTP/SMS vendor and DLT registration | Real login |
| 4 | Hosting platform and region; managed Postgres vendor | Staging/production |
| 5 | Domain, email sender, DNS | Launch |
| 6 | Whether alcohol may be ordered through the platform (licensing, age verification, state excise rules) | Alcohol items in dine-in orders |
| 7 | Refund policy and who executes refunds | Refund flow |
| 8 | Who may create events (hosts?) and talent self-registration | Host/talent workflows |
| 9 | Data retention periods; erasure procedure | Account deletion, cleanup jobs |
| 10 | Legal entity, grievance officer, licences, GST treatment, ticket terms | Legal pages, invoices |
| 11 | Brand imagery, font licences | Visual polish |
| 12 | Error-monitoring and uptime vendors | Observability |
| 13 | Admin MFA approach | Admin hardening |

## Known limitations

- Reservations have no table/capacity model; merchants confirm or decline manually.
- Refunds are recorded, never executed. Customer-initiated cancellation of a confirmed paid booking is not supported.
- Hosts cannot create events; only merchants and admins can.
- Talent profiles are admin-created. Talent can respond to enquiries once linked to a user.
- Account deletion is a tracked request, with no automated erasure.
- `rate_limit_hits` and `otp_challenges` have no cleanup job.
- Dine-in orders are pay-at-venue; there is no table-session close endpoint; the cart is client-side only.
- No CSP header; only baseline security headers.
- IP rate limits trust `x-forwarded-for`; the hosting proxy must set it and strip client-supplied values.
- The booking-expiry endpoint needs an external scheduler.
- OTP over SMS is exposed to SIM-swap and interception; no second factor beyond OTP for customers, none at all for admins beyond OTP plus an 8 hour session.
- System font stacks are used; no licensed brand fonts or imagery.
- Seed data is labelled "[Demo]" and must never be loaded in production.
