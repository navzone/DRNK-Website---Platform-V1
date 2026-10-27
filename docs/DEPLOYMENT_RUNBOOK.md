# Deployment Runbook

**Status: NOT EXECUTED.** No hosting platform, domain, database service or credentials were provided, so nothing has been deployed. This runbook is a procedure to follow once those exist. It contains no claim that any environment is live.

## Environments

| Environment | `APP_ENV` | Database | OTP | Payments |
| --- | --- | --- | --- | --- |
| Local | `development` | local Postgres | `dev` adapter | `fake-sandbox` |
| CI / tests | `test` | throwaway Postgres | `dev` | `fake-sandbox` |
| Staging | `staging` | **separate** managed Postgres | real provider (dev adapter is rejected at startup) | Razorpay **test** keys |
| Production | `production` | **separate** managed Postgres | real provider | Razorpay **live** keys, only after sign-off below |

Never share a database, secret, webhook secret or API key between environments. Staging must never be pointed at the production database.

## Requirements for any deployment target

- Node 22, a long-running or serverless Node runtime able to run `next start` (the app uses Node APIs and `pg`; it is not edge-compatible).
- PostgreSQL 16 with TLS, automated backups and point-in-time recovery if offered.
- HTTPS termination in front of the app, with the proxy setting `x-forwarded-for` and stripping client-supplied copies.
- A scheduler able to POST to the app every minute or so.
- Log collection for structured JSON stdout.

## Environment variables

See `.env.example`. Required on staging and production:

| Variable | Notes |
| --- | --- |
| `APP_ENV` | `staging` or `production`. Startup throws on unsafe combinations |
| `APP_URL` | Public https origin |
| `DATABASE_URL` | Managed Postgres connection string with TLS |
| `SESSION_SECRET` | 32+ random characters, unique per environment. Rotating it logs everyone out |
| `OTP_PROVIDER` | `provider`. `dev` is rejected outside development/test |
| `PAYMENT_PROVIDER` | `razorpay`. `fake-sandbox` is rejected in production |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Test keys on staging, live keys only on production |
| `CRON_SECRET` | Bearer secret for the expiry endpoint |

Store them in the platform's secret manager. Do not commit them or paste them into tickets. The OTP provider's own credentials variables will be defined when that adapter is implemented.

## First-time setup (staging)

1. Provision Postgres; create a database and a least-privilege application role (no superuser).
2. Set environment variables.
3. Build: `npm ci && npm run build`.
4. Migrate: `npm run db:migrate` (forward-only SQL in `drizzle/`). Run it as a release step before starting the new version.
5. Start: `npm start`.
6. Seed demo data **only on staging, only if wanted**: `npm run db:seed` (the script refuses `APP_ENV=production`). Seed users have fixed phone numbers; on staging with a real OTP provider they receive real SMS, so do not seed unless you control those numbers or change them.
7. Create the first admin: there is no signup path to admin by design. Insert/update a user's role directly in the database for the first admin, then manage roles through the admin console (audited).
8. Configure the scheduler: `POST {APP_URL}/api/internal/expire-bookings` with header `Authorization: Bearer $CRON_SECRET`, every 1 to 5 minutes.
9. Configure the Razorpay webhook to `POST {APP_URL}/api/webhooks/payments`, with the same secret as `RAZORPAY_WEBHOOK_SECRET`. Confirm the signature header and event-id header against Razorpay's real deliveries (the adapter is unverified).
10. Smoke test (below).

## Vercel specifics (chosen platform; NOT yet deployed)

- `vercel.json` sets the build to `scripts/vercel-build.mjs`: it runs forward-only migrations **only when `MIGRATE_ON_BUILD=1`**, then `next build`. Set `MIGRATE_ON_BUILD=1` for the Production environment only, so preview deployments never migrate a database.
- Use a Postgres with a pooled connection string (for example Neon's pooled URL) and set `DB_POOL_MAX=3` so serverless instances do not exhaust connections.
- Vercel Cron calls `GET /api/internal/expire-bookings` and sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. The schedule in `vercel.json` is daily (03:00 UTC) because Hobby plans reject anything more frequent. Expired holds are also released lazily on every new booking, so a daily job is a backstop. On Pro, change the schedule to every few minutes.
- Vercel Postgres/Neon integrations inject `DATABASE_URL`; check that the variable name matches (some integrations add `POSTGRES_URL` instead; copy it into `DATABASE_URL`).
- Required env vars are listed above. Without a real `OTP_PROVIDER`, the app starts but nobody can log in.
- The Vercel connector available to Claude is read-only (projects, deployments, logs); environment variables and databases are set in the Vercel dashboard.

## Staging smoke test

- `GET /api/health` returns ok with database connectivity.
- Log in with a real phone number you control; confirm the SMS arrives and the code works once.
- Confirm the dev code `123456` is rejected.
- Book a ticket; pay with Razorpay test mode; confirm the booking becomes `confirmed` only after the webhook arrives; confirm a ticket appears.
- Replay the same webhook from the Razorpay dashboard; confirm no second ticket or points entry.
- Confirm `POST /api/dev/simulate-payment` returns 404.
- Confirm `POST /api/internal/expire-bookings` returns 404 without the bearer token.
- Confirm another user cannot open your booking URL (404).
- Check response headers over HTTPS (HSTS, frame deny, nosniff).

## Release procedure (staging → production)

1. CI green on the commit (lint, typecheck, tests, audit, build, e2e).
2. Deploy to staging; run the smoke test above.
3. Take a database backup (or confirm automated PITR) before migrating production.
4. Run `npm run db:migrate` against production, then deploy the same build artifact.
5. Run the read-only parts of the smoke test (health, headers, 404s on internal/dev routes). Do not create real payments except an agreed live test purchase.
6. Watch logs and error monitoring for 30 minutes.

## Rollback

- Application: redeploy the previous build artifact. Migrations are forward-only; write migrations to be backward-compatible with the previous build (add columns before using them, drop later).
- Database: restore from backup/PITR only for data-corrupting incidents; this loses writes after the restore point, including payments, so reconcile with Razorpay's records afterwards.
- Payments in flight: bookings stay `pending_payment` until the webhook arrives; replayed webhooks are idempotent, so re-sending missed webhooks after recovery is safe.
- Emergency stop for payments: no kill switch exists. Add one (feature flag or setting) before launch; until then the only reliable lever is taking the app down or removing the payment keys at the platform.

## Operations

- Health: `GET /api/health`.
- Logs: structured JSON; search by event name. Secrets and phone numbers are redacted.
- Reconciliation: periodically compare `payment_attempts` and `refunds` with Razorpay's dashboard. `refunds.status = 'requested'` rows need a human to refund via Razorpay and then record the outcome (no UI for this yet).
- Cleanup: no job exists for `rate_limit_hits` / `otp_challenges`; schedule one before volume grows.
- Backups: platform-dependent. **Not configured. Not tested.** Do a restore drill into a scratch database before launch.

## Not done / blocked

Hosting platform, domain, DNS, TLS, managed Postgres, secret store, scheduler, OTP provider, Razorpay account, monitoring, backup drill, first-admin bootstrap helper, and any actual deployment.
