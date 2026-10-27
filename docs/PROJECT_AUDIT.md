# Project Audit

Date: 2026-10-27. Scope: Phase 0 of the DRNK MVP master prompt.

## Result: greenfield

The working directory contained no files and no git repository. There was no existing source, schema, migrations, tests, CI, environment configuration, or deployment setup to audit or preserve. Nothing was broken because nothing existed.

| Area | Finding |
| --- | --- |
| Source code and structure | None found |
| Frameworks and dependencies | None found |
| Existing UI | None found |
| Backend APIs, business logic | None found |
| Database schema, migrations, seeds | None found |
| Authentication and authorization | None found |
| Payment and external integrations | None found |
| Environment variables, deployment config | None found |
| Tests, build scripts, CI/CD | None found |

## What must be preserved

Only decisions the project owner has already made, which this build follows:

- Stack: Next.js + TypeScript + PostgreSQL.
- Payment provider: Razorpay.
- Launch geography: Bengaluru.
- Delivery module is excluded from the MVP.
- Alcometer credits are an evolution of the earlier ML Wallet idea. They are kept in a ledger separate from DRNK Points and are not money.

## Environment findings (build sandbox)

- Node 22, npm 10, Postgres 16 server binaries. Docker daemon is not available.
- A local Postgres 16 cluster (port 5433) was created for development and tests. This is sandbox-only and is not a deployment.
- Outbound network is allowlisted. npm installs work. Playwright's browser download is refused, so browser-based end-to-end tests could not be run here (see `TEST_PLAN.md`).
- No Razorpay credentials, OTP provider account, domain, hosting account, or GitHub remote were available.

## Inputs that were not provided

These shaped what was built and what was deliberately left blank:

- The "existing approved specification" for DRNK rewards (earning rates, tier thresholds, multipliers, expiry). It was not available, so none were invented. See `ARCHITECTURE.md` (Rewards).
- Legal entity details, grievance officer, licences, refund terms. Policy pages contain `[DRNK TO PROVIDE: ...]` placeholders.
- Brand imagery and fonts.
- Policy on alcohol-related online ordering. Orders containing alcohol items are refused.
