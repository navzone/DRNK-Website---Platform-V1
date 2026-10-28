# Test Plan and Results

Results below come from commands run in the build sandbox on 2026-10-27. Nothing here was run against staging or production, because neither exists.

## Results at last run

| Check | Command | Status | Detail |
| --- | --- | --- | --- |
| Lint | `npm run lint` | PASS | ESLint 9, zero errors |
| Types | `npm run typecheck` | PASS | TypeScript strict, `noUncheckedIndexedAccess` |
| Unit + integration | `npm test` | PASS | 130 / 130 tests, 6 files, real PostgreSQL 16 |
| Production build | `npm run build` | PASS | Next.js 16 build, exit 0, with no `DATABASE_URL` set (the DB client is created lazily on first use) |
| HTTP smoke | `npx tsx scripts/smoke.ts` against `next start` | PASS | 49 / 49 checks |
| Dependency audit | `npm audit --omit=dev` | PASS | 0 vulnerabilities in production dependencies; 4 moderate advisories in dev-only tooling remain |
| Mutation spot-checks | manual | PASS | 5 / 5 deliberate breakages were caught by tests (see below) |
| Browser e2e | `E2E_CHROMIUM_PATH=<chromium> npm run test:e2e` | PASS (Chromium only) | 48 tests (16 specs x desktop/tablet/phone viewports): 46 passed, 2 skipped (the phone-only tab-bar check on tablet and desktop). Firefox and Safari/WebKit NOT TESTED. First full run had 6 failures from a renamed page heading; the tests were corrected and the affected files re-run clean |
| Visual / responsive review | scripted screenshots | PARTIAL | Home, Dine-In, venue, events, event, talent, talent page, login and account were screenshotted at 390, 820 and 1440 px and looked at by the author; a script found no horizontal overflow on any of them. Merchant and admin consoles were not reviewed visually. No real device testing |
| Accessibility audit | n/a | NOT TESTED | Labels, skip link, `aria-current` and visible focus are covered by e2e checks, but no axe/Lighthouse run, screen-reader pass or contrast measurement has been done |
| Load / performance | n/a | NOT TESTED | |
| Razorpay sandbox | n/a | NOT TESTED | No credentials |
| Real OTP delivery | n/a | BLOCKED | No provider |
| Staging / production deploy and smoke | n/a | BLOCKED | No platform or credentials |
| Backup / restore drill | n/a | NOT TESTED | |

## Test inventory

| File | Tests | Covers |
| --- | --- | --- |
| `tests/unit/foundation.test.ts` | 23 | env guards, same-origin check, phone normalisation/masking, crypto helpers, money formatting, log redaction, ledger-immutability triggers |
| `tests/unit/state.test.ts` | 9 | dine-in reservation/order/table state machines |
| `tests/integration/auth.test.ts` | 22 | OTP request/verify, throttles, attempt cap, replay, concurrency, sessions, cookies, logout, role expiry, provider guards |
| `tests/integration/booking-payments.test.ts` | 25 | holds, oversell race, expiry, ticket uniqueness, pricing, webhook signature/replay/mismatch/late payment, rewards idempotency, ownership, simulator gating |
| `tests/integration/explore-dinein.test.ts` | 34 | public listings, reservations, table sessions, orders (server pricing, alcohol refusal), merchant scope, status transitions |
| `tests/integration/talent-account-admin.test.ts` | 17 | talent enquiries, account/consents/data requests/support, merchant application, admin approvals/roles/tiers, audit |
| `tests/e2e/*.spec.ts` | 15 specs, each run in 3 viewport projects (desktop, tablet, mobile) | public pages, auth, booking and dine-in flows, responsive nav, keyboard skip link (Playwright; not run) |
| `scripts/smoke.ts` | 49 checks | login via dev adapter, book → pending → signed webhook → confirmed with ticket, cross-user 404, logout revocation |

Integration tests use a dedicated database (`drnk_test`). `tests/global-setup.ts` migrates it and refuses to run unless the database URL contains `_test`.

## Mutation spot-checks

Each change was applied to `src/`, tests were run, and the change was reverted. All five made tests fail:

1. Drop the ownership filter when reading a booking
2. Skip webhook signature verification
3. Remove the oversell guard
4. Disable the CSRF origin check
5. Disable webhook event de-duplication

This is a spot check, not a mutation-testing campaign.

## Running tests

```bash
# Postgres 16 must be reachable at TEST_DATABASE_URL
npm run lint && npm run typecheck && npm test
npm run build
# Browser tests, on a machine that can install browsers:
npx playwright install chromium && npm run test:e2e
# Smoke test against a running production build:
APP_ENV=development OTP_PROVIDER=dev PAYMENT_PROVIDER=fake-sandbox RAZORPAY_WEBHOOK_SECRET=local npx next start -p 3100 &
BASE_URL=http://localhost:3100 npx tsx scripts/smoke.ts
```

## Coverage gaps worth closing

- Browser rendering at 360 / 768 / 1440 px, keyboard navigation, screen-reader pass, colour-contrast check.
- Razorpay: real order creation, signature on real payloads, out-of-order events.
- Load behaviour of the booking transaction under sustained concurrency.
- Webhook processing when the database is briefly unavailable (provider retry).
- Migration upgrade path from a non-empty database (only fresh-database migration is exercised).
