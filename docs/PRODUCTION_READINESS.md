# Production Readiness Assessment

Date: 2026-10-27.

## Verdict: NOT READY FOR PRODUCTION

The application foundation builds, passes its automated tests, and implements the core flows with server-side authority. It has **not** been deployed, has **not** been tested in a browser, and cannot let a real user log in or pay. Those are not minor gaps. This document does not certify security, legal compliance, or payment correctness.

## Verified (commands were run)

| Item | Status |
| --- | --- |
| Lint, typecheck, production build | PASS |
| 126 unit and integration tests against real PostgreSQL | PASS |
| 49 HTTP smoke checks against `next start` (login via dev adapter, booking → signed webhook → ticket, cross-user 404, logout) | PASS |
| 5 deliberate regressions caught by tests (ownership, signature, oversell, CSRF, webhook dedupe) | PASS |
| `npm audit --omit=dev` | PASS (0); 4 moderate advisories in dev-only tooling |
| Dev OTP and fake payment provider rejected by startup guards outside permitted environments | PASS |

## Not verified or not done

| Item | Status | Why |
| --- | --- | --- |
| Real OTP delivery and login | BLOCKED | No provider; adapter fails closed |
| Razorpay order creation, Checkout, real webhooks | NOT TESTED | No credentials; Checkout.js step not built |
| Refund execution | NOT DONE | Rows queued only |
| Browser e2e (15 Playwright specs) | NOT TESTED | Browser download blocked in sandbox |
| Responsive / visual review, accessibility audit | NOT TESTED | No browser, no screenshots |
| CI on GitHub | NOT TESTED | Workflow written; no remote repository |
| Staging deployment | BLOCKED | No platform, domain, database, secrets |
| Production deployment | BLOCKED | Depends on staging and approvals |
| Backups and restore drill | NOT TESTED | |
| Monitoring, alerting, error tracking | NOT DONE | Structured logs only |
| Admin MFA, CSP, WAF/platform rate limiting | NOT DONE | |
| Independent security review / penetration test | NOT DONE | |
| Load test | NOT TESTED | |
| Legal review of policies, terms, privacy notice | NOT DONE | Drafts contain `[DRNK TO PROVIDE: ...]` placeholders |
| Reward earning rates, tier thresholds | BLOCKED | Specification not provided; no values invented |
| Alcohol ordering policy and licensing review | BLOCKED | Alcohol items are refused online |

## Launch blockers (must close before real users or money)

1. Real OTP provider integrated and tested end to end.
2. Razorpay verified in test mode (including webhook replay), checkout UI built, refund handling process defined, then live-mode review.
3. Staging environment exists and passes the smoke test in `DEPLOYMENT_RUNBOOK.md`.
4. Browser e2e and a responsive/accessibility pass, with the failures fixed.
5. Backups configured and a restore drill completed.
6. Error monitoring and alerting in place.
7. Legal pages completed and reviewed by counsel; consent text and retention policy decided.
8. Admin MFA (or an accepted alternative) and a first-admin bootstrap procedure.
9. Rewards specification supplied and implemented; until then no points are earned.
10. Platform rate limiting and trusted-proxy configuration for `x-forwarded-for`.
11. Independent security review.

## Should close soon after launch

Reservation capacity model, menu-management UI, refund admin tooling, retention/cleanup jobs, CSP, talent self-registration, host event creation, licensed imagery and fonts, account erasure automation.

## What was deliberately not built

Delivery module, a spendable wallet balance, any fake payment success path reachable in production, microservices, invented reward rates, invented legal facts.

## Required from DRNK to proceed

Credentials and decisions listed in `docs/IMPLEMENTATION_PLAN.md` (Outstanding decisions 1 to 13) and in particular: an OTP vendor, a Razorpay account, a hosting platform and domain, the approved rewards specification, and legal inputs.
