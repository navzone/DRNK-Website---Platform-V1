# Architecture

A single Next.js (App Router) application with a modular server layer and one PostgreSQL database. No microservices, queues, or caches were introduced.

```
Browser ── pages (server components) ──┐
   │                                   ├─> src/server/* services ──> PostgreSQL (Drizzle)
   └── client components ── /api/* ────┘          ▲
                                                 │
Payment provider ── signed webhook ── /api/webhooks/payments
```

## Layout

| Path | Role |
| --- | --- |
| `src/app/**` | Pages and `/api` route handlers. Handlers are thin: parse input (zod), call a service. |
| `src/server/auth` | OTP, sessions, rate limiting, provider boundary |
| `src/server/events` | Event booking, inventory holds, ticket issuance |
| `src/server/payments` | Provider abstraction, payment attempts, webhook processing |
| `src/server/dinein` | Reservations, table sessions, orders, state machines |
| `src/server/explore` | Public venue/event queries |
| `src/server/talent`, `merchant`, `admin`, `account`, `rewards` | Feature services |
| `src/server/api.ts` | `handle()` wrapper, cookies, CSRF origin check, `requireUser`/`requireRole` |
| `src/db/schema.ts` | Drizzle schema. `drizzle/` holds generated SQL migrations |
| `src/lib` | env validation, crypto, phone, logging, errors, formatting |
| `src/content/legal.ts` | Draft policy content |

## Server-authoritative rules

Every state-changing endpoint follows: authenticate, validate with zod, authorize and check ownership, recompute values on the server, run in a transaction, persist, return the stored result, audit sensitive changes.

- Clients send ids and quantities only. Prices, totals, names, inventory, status and roles are read or computed on the server. Unknown fields in request bodies are ignored; profile updates use `.strict()` so role/phone fields are rejected.
- Money is integer paise everywhere (`integer` columns, integer math). Display formatting splits rupees/paise with integer operations.
- Roles are read from the database on every request (`getSessionUser`). Changing a user's role revokes their sessions.
- Ownership failures return 404, not 403, so other users' record ids cannot be probed.

## Authentication

Mobile OTP. `requestOtp` normalizes the number, applies per-IP and per-phone sliding-window limits (stored in Postgres), enforces a 30 s resend gap, stores only an HMAC of the code (5 min expiry), and hands delivery to an `OtpProvider`. `verifyOtp` counts each attempt atomically (max 5), compares in constant time, consumes the challenge exactly once, upserts the user, and issues a fresh opaque session token. Only a keyed hash of the token is stored. The token lives in an `HttpOnly; SameSite=Lax` cookie (`Secure` outside development/test). Customer sessions last 30 days, admin sessions 8 hours. Logout revokes server-side.

CSRF: SameSite=Lax plus a required matching `Origin`/`Referer` on every non-GET request. Webhooks skip the origin check and authenticate by signature.

OTP providers:

- `DevOtpProvider`: fixture codes, development/test only. `loadEnv()` refuses `OTP_PROVIDER=dev` when `APP_ENV` is anything but development/test, and the constructor re-checks.
- `ConfiguredOtpProvider`: the real-provider boundary. **Not wired.** It fails closed with a 503 rather than pretending to deliver.

## Event booking and payments

1. `createBooking` (one transaction): locks nothing broadly; for each ticket type (sorted by id to avoid deadlocks) runs `UPDATE ... SET sold = sold + q WHERE sold + q <= capacity`. A `CHECK (sold <= capacity)` constraint backs this up. Creates a `pending_payment` booking with a 15-minute hold and price-snapshotted lines. Zero-price bookings confirm immediately.
2. `startPayment`: server computes the amount from the booking, creates a `payment_attempts` row, asks the provider for an order.
3. Provider webhook → `parseWebhook` verifies the HMAC-SHA256 signature over the raw body → `processWebhook`, one transaction: insert `webhook_events (provider, event_id)` (unique; duplicates and concurrent duplicates stop here), lock the attempt, validate amount and currency, mark `paid`, lock the booking, `confirmBooking` (status flip guarded by `WHERE status='pending_payment'`, tickets inserted under a unique `(booking, ticket_type, seq)` index, optional reward earning, notification).
4. If money was captured but the booking can no longer be confirmed (expired, cancelled, or paid by another attempt), a `refunds` row is queued as `requested` and an audit event written. **No refund is executed automatically.**
5. Expiry: `expireStaleBookings` releases inventory for lapsed holds. It runs lazily on each new booking and via `POST /api/internal/expire-bookings` (bearer `CRON_SECRET`). A scheduler must call that endpoint.
6. Browser redirects are never evidence of payment. The booking page reads status from the database.

Providers: `FakeSandboxProvider` (local, deterministic, no charges; success only via a correctly signed webhook) and `RazorpayProvider` (Orders API + signature scheme). The Razorpay adapter is **unverified**, and the browser checkout step for it is **not implemented** (only the sandbox flow has UI).

`/api/dev/simulate-payment` feeds a signed sandbox webhook through the same pipeline. It 404s unless `APP_ENV` is development/test and the fake provider is active; `loadEnv()` forbids the fake provider in production.

## Rewards

Tables exist for tiers (Silver, Gold, Black), memberships, rules, and two append-only ledgers (`points_ledger`, `alcometer_ledger`). Database triggers reject UPDATE/DELETE on both ledgers and on `audit_events`. `idempotency_key` is unique so duplicate deliveries cannot double-credit.

Because the approved specification was not provided:

- No rates, thresholds, multipliers or expiry are defined. Points are earned only if an operator inserts an active `reward_rules` row with key `earn.event_booking` and value `{ "pointsPerRupee": <non-negative integer> }`. That shape is a proposal and should be confirmed against the spec. A malformed rule awards nothing.
- Tiers are assigned manually by an admin (audited). There is no automatic tiering.
- Alcometer credits have no earning or spending rules. The ledger exists and is displayed separately.

## Dine-in

Venues with `dine_in_enabled` accept orders for available, non-alcohol items. Orders are priced from the database with name/price snapshots. A table session can be opened by a customer at a venue that enables sessions; only the opener can add orders to it. State machines (`src/server/dinein/state.ts`) are pure and unit-tested. Merchants act only on venues they own; admins on any. Dine-in orders are not paid online in this MVP.

## Admin and merchant

Admin: approvals (venues, events, talent, merchant applications), role and tier assignment, support and data-request status, monitoring lists, audit log. All writes are audited in the same transaction. An admin cannot change their own role. Merchant: apply, create venues and events (always `pending` until approved), manage order/reservation status, create menu items and toggle availability (API only; no menu UI yet).

## Data model

See `src/db/schema.ts` (35 tables). Highlights: `ticket_types.sold <= capacity` check; unique `tickets (booking, ticket_type, seq)`; unique `payment_attempts.provider_order_id`; unique `webhook_events (provider, event_id)`; append-only ledgers and audit via triggers (`drizzle/0001_immutable_ledgers.sql`).

## Observability

Structured JSON logs (`src/lib/log.ts`) with key-based redaction of codes, tokens, secrets, and phone numbers. `GET /api/health` checks database connectivity. No error-monitoring service is wired.
