# DRNK Platform: Website V1

Next.js 16 (App Router) + TypeScript + PostgreSQL + Drizzle. Bengaluru launch MVP: explore, dine-in, events and tickets, talent enquiries, mobile-OTP accounts, rewards ledgers, and merchant/admin workspaces.

Read first: `docs/PRODUCTION_READINESS.md` (what is and is not verified), then `docs/IMPLEMENTATION_PLAN.md` (status and next step).

## Run locally

Prerequisites: Node 22+, PostgreSQL 16 reachable locally.

```bash
npm install
cp .env.example .env.local        # edit DATABASE_URL / TEST_DATABASE_URL
createdb drnk_dev && createdb drnk_test
set -a; source .env.local; set +a   # db:migrate / db:seed read DATABASE_URL from the shell, not .env.local
npm run db:migrate
npm run db:seed                   # demo data, refuses APP_ENV=production
npm run dev                       # http://localhost:3000 (Next loads .env.local itself)
```

Demo logins (development only; the dev OTP adapter accepts code `123456`):

| Role | Phone |
| --- | --- |
| Admin | +919000000001 |
| Customer | +919000000002 |
| Customer 2 | +919000000003 |
| Merchant | +919000000004 |

Payments run through a local sandbox provider: book tickets, press "Pay now", then "Simulate successful payment". The booking confirms only because a correctly signed webhook is processed server-side.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run lint`, `npm run typecheck` | Static checks |
| `npm test` | Unit + integration tests (real Postgres via `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright (needs `npx playwright install chromium`, or set `E2E_CHROMIUM_PATH` to an installed Chromium). Needs a built app and a migrated, seeded database in `E2E_DATABASE_URL` |
| `npm run build`, `npm start` | Production build and server |
| `npm run db:generate`, `db:migrate`, `db:seed` | Drizzle migrations and demo data |
| `npx tsx scripts/smoke.ts` | HTTP smoke test against a running server (`BASE_URL`) |

## Documentation

| Doc | Content |
| --- | --- |
| `docs/PROJECT_AUDIT.md` | Starting state and inputs not provided |
| `docs/ARCHITECTURE.md` | Design, security model, payment and reward flows |
| `docs/IMPLEMENTATION_PLAN.md` | Module status, next step, outstanding decisions, known limitations |
| `docs/SECURITY_CHECKLIST.md` | Controls with evidence and status |
| `docs/TEST_PLAN.md` | Results, inventory, gaps |
| `docs/DEPLOYMENT_RUNBOOK.md` | Staging/production procedure (not executed) |
| `docs/PRODUCTION_READINESS.md` | Go/no-go assessment |
| `docs/API.md` | Endpoint reference |
| `docs/DESIGN_PORT.md` | What was taken from the AI Studio prototype and what was left out |

## Ground rules baked into the code

- The server decides prices, totals, inventory, status and roles. Clients send ids and quantities.
- Money is integer paise.
- Payment success is only ever established by a verified, de-duplicated provider webhook.
- Points and Alcometer credits are separate append-only ledgers; there is no wallet balance. No reward rates are invented: earning is off until an approved `reward_rules` row exists.
- The dev OTP adapter and fake payment provider cannot start on production.
- No delivery module.

Legal pages are drafts with placeholders and need counsel review before launch.
