# Security Checklist

Statuses: PASS (verified by an automated test or command that was run), IMPLEMENTED (in code, not independently exercised), FAIL, BLOCKED, NOT TESTED.

This is an engineering checklist, **not a security certification**. No penetration test or third-party review has been done.

## Authentication and sessions

| Control | Status | Evidence |
| --- | --- | --- |
| OTP stored only as keyed hash, 5 min TTL | PASS | `auth.test.ts` |
| Max 5 verify attempts per challenge; atomic counting | PASS | `auth.test.ts` |
| Resend throttle (30 s), per-phone and per-IP limits | PASS | `auth.test.ts` |
| Challenge single-use; concurrent verifies cannot both succeed | PASS | `auth.test.ts` |
| Session token opaque, only hash stored; fresh token on login | PASS | `auth.test.ts` |
| Cookie HttpOnly and SameSite=Lax | PASS | `auth.test.ts` asserts both |
| Cookie `Secure` flag outside dev/test | IMPLEMENTED; NOT TESTED (needs HTTPS environment) | |
| Logout revokes session server-side | PASS | `auth.test.ts`, smoke |
| Admin sessions capped at 8 h | PASS | `auth.test.ts` |
| Dev OTP adapter impossible in staging/production | PASS | `foundation.test.ts` (env guard + constructor guard) |
| Real OTP delivery | BLOCKED | No provider chosen; adapter fails closed (503) |
| Admin MFA | NOT DONE | Decision #13 |

## Authorization

| Control | Status | Evidence |
| --- | --- | --- |
| Server-side role check on every protected route | PASS | integration tests per module |
| Roles read from DB per request, not trusted from client | PASS | `auth.test.ts` |
| Cross-user access returns 404 (bookings, orders, reservations, enquiries, notifications) | PASS | `booking-payments`, `explore-dinein`, `talent-account-admin` tests; smoke |
| Merchant limited to own venues | PASS | `explore-dinein.test.ts`, `talent-account-admin.test.ts` |
| Admin cannot change own role; role change revokes target sessions | PASS | `talent-account-admin.test.ts` |
| Mass-assignment (role/phone/status in bodies) ignored or rejected | PASS | `talent-account-admin.test.ts` |
| Mutation check: removing the booking ownership filter makes tests fail | PASS | manual mutation run |

## Payments and money

| Control | Status | Evidence |
| --- | --- | --- |
| Amounts computed server-side from stored prices, integer paise | PASS | `booking-payments.test.ts` |
| Client-supplied price/total/status ignored | PASS | `booking-payments.test.ts` |
| Webhook signature verified over raw body, constant time | PASS | tests; mutation check |
| Webhook replay and concurrent duplicates processed once | PASS | tests; mutation check |
| Amount/currency mismatch leaves booking pending and is audited | PASS | `booking-payments.test.ts` |
| Late payment after expiry/cancel queues a refund row, never confirms | PASS | `booking-payments.test.ts` |
| Overselling impossible under concurrency (conditional UPDATE + CHECK) | PASS | concurrency test; mutation check |
| Browser redirect is not proof of payment | PASS | status read from DB; Chromium e2e confirms the booking stays pending until the signed webhook is processed |
| Sandbox simulator unavailable outside dev/test | PASS | `booking-payments.test.ts` |
| Razorpay adapter and real webhook payloads | NOT TESTED | No credentials |
| Refund execution | NOT DONE | |

## Data integrity and privacy

| Control | Status | Evidence |
| --- | --- | --- |
| Points/Alcometer ledgers and audit events reject UPDATE/DELETE (DB triggers) | PASS | `foundation.test.ts` |
| Duplicate reward earning prevented by idempotency key | PASS | `booking-payments.test.ts` |
| Logs redact codes, tokens, secrets, phones | PASS | `foundation.test.ts` |
| Admin user list masks phone numbers | IMPLEMENTED (route applies `maskPhone`); only the helper is unit-tested, the route is NOT directly tested | `foundation.test.ts` |
| Consent records and data-request workflow | PASS (records created); erasure NOT DONE | |
| Privacy notice text | DRAFT | needs counsel |

## Application hardening

| Control | Status | Evidence |
| --- | --- | --- |
| Input validation with zod on all mutating routes | IMPLEMENTED; malformed-input cases PASS in tests | |
| CSRF origin/referer check on non-GET | PASS | tests; mutation check |
| SQL injection | Parameterised queries via Drizzle; no raw string concatenation | IMPLEMENTED |
| XSS | React escaping; no `dangerouslySetInnerHTML` | IMPLEMENTED (no `dangerouslySetInnerHTML` anywhere in `src`, checked by grep) |
| Security headers (nosniff, frame deny, referrer policy, permissions policy, HSTS) | IMPLEMENTED in `next.config.ts` | header presence NOT TESTED over HTTPS |
| Content-Security-Policy | NOT DONE | |
| Rate limiting on OTP endpoints | PASS | |
| Rate limiting on other endpoints | NOT DONE | rely on platform/WAF |
| Secrets only via environment; `.env*` ignored by git; `.env.example` has placeholders | PASS | |
| Dependency audit (production deps) | PASS: 0 vulnerabilities at last run. 4 moderate advisories remain in dev-only `drizzle-kit` tooling | `npm audit` |
| Secret scanning, SAST, container scanning | NOT DONE | |
| Backups and restore | NOT DONE | platform-dependent; see runbook |

## Before any production traffic

- [ ] Real OTP provider wired and tested with real phones
- [ ] Payment adapter verified in Razorpay test mode, then reviewed for live mode
- [ ] Admin MFA or equivalent
- [ ] CSP added and tested
- [ ] Platform-level rate limiting / WAF in front of the app, trusted proxy header configured
- [ ] Backups and a rehearsed restore
- [ ] Error monitoring and alerting
- [ ] Independent security review
