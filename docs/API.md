# API Reference

All endpoints are JSON under `/api`. Errors return `{ "error": { "code": string, "message": string } }` with an appropriate status. Non-GET requests from browsers must carry a same-origin `Origin` or `Referer` header (except the webhook and cron endpoints). Money is always integer paise (`*Paise` fields). Records owned by another user return `404`.

Auth column: **public** = no login; **user** = any logged-in user (cookie `drnk_session`); `merchant` routes accept merchant or admin (admins see all venues, merchants only their own); `talent` routes accept talent or admin; `admin` routes require admin.

This is a route inventory generated from the source at the time of writing. For exact request bodies, read the zod schema at the top of each `src/app/api/**/route.ts`; those schemas are the contract.

## Auth and identity

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/otp/request` | public | Send an OTP to an Indian mobile number. Rate limited |
| POST | `/auth/otp/verify` | public | Verify code, create session cookie |
| POST | `/auth/logout` | user | Revoke the session |
| GET | `/me` | user | Current user and role |
| GET | `/health` | public | Liveness and database check |

## Explore

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/venues`, `/venues/{slug}` | public | Approved venues, offers, menu |
| GET | `/events`, `/events/{slug}` | public | Published events with ticket types and remaining inventory |
| GET | `/talents`, `/talents/{slug}` | public | Approved talent profiles |

## Event booking and payments

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/bookings` | user | Own bookings |
| POST | `/bookings` | user | Body: `eventId`, `lines[{ticketTypeId, quantity}]` (max 5 lines, qty 1-10). Reserves inventory for 15 minutes. Prices are server-side |
| GET | `/bookings/{ref}` | user (owner) | Booking, lines, tickets, status |
| POST | `/bookings/{ref}/pay` | user (owner) | Start a payment attempt for the stored amount; returns `paymentRef`, status `pending`, `amountPaise`, `checkout` |
| POST | `/bookings/{ref}/cancel` | user (owner) | Cancel an unpaid booking and release inventory |
| POST | `/webhooks/payments` | signature | Provider webhook. HMAC-SHA256 of raw body in `x-razorpay-signature`, event id in `x-razorpay-event-id`. Idempotent |
| POST | `/internal/expire-bookings` | `Authorization: Bearer CRON_SECRET` | Release expired holds. 404 if secret is wrong or unset |
| POST | `/dev/simulate-payment` | user (owner) | Local/test only; 404 elsewhere. Body: `paymentRef`, `outcome` (`captured` or `failed`). Sends a signed sandbox webhook through the real pipeline |

## Dine-in

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET, POST | `/reservations` | user | List own / request a reservation |
| POST | `/reservations/{ref}/cancel` | user (owner) | Cancel |
| POST | `/table-sessions` | user | Open a table session at a dine-in venue |
| GET, POST | `/orders` | user | List own / place an order (ids and quantities only; alcohol items refused) |
| GET | `/orders/{ref}` | user (owner) | Order detail |
| POST | `/orders/{ref}/cancel` | user (owner) | Cancel while cancellable |

## Talent

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/talents/{slug}/enquiries` | user | Send an enquiry |
| GET | `/enquiries` | user | Own enquiries |
| GET | `/talent/enquiries` | talent/admin | Enquiries addressed to the caller's profile |
| POST | `/talent/enquiries/{id}/respond` | talent/admin | Accept or decline |

## Account

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET, PATCH | `/account` | user | Profile (`displayName`, `email` only; strict schema) |
| GET | `/account/history` | user | Bookings, orders, reservations |
| GET | `/account/rewards` | user | Tier, DRNK Points balance and entries, Alcometer balance and entries (separate ledgers) |
| GET | `/account/notifications` | user | Notifications |
| POST | `/account/consents` | user | Record consent decisions |
| GET, POST | `/account/data-requests` | user | List / raise an access or deletion request |
| GET, POST | `/support` | user | List / create support tickets |

## Merchant

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/merchant/applications` | user | Apply to become a merchant |
| GET, POST | `/merchant/venues` | merchant/admin | Own venues / create (starts pending) |
| POST | `/merchant/events` | merchant/admin | Create an event on an owned venue (starts pending) |
| GET, POST | `/merchant/venues/{slug}/menu-items` | merchant/admin | List own menu / add an item (`category` optional) |
| POST | `/merchant/menu-items/{id}/availability` | merchant/admin | Toggle availability |
| GET | `/merchant/orders`, `/merchant/reservations` | merchant/admin | Incoming, scoped to own venues. Orders include items, table and masked guest phone |
| POST | `/merchant/orders/{ref}/status`, `/merchant/reservations/{ref}/status` | merchant/admin | Advance status through allowed transitions |

## Admin

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/lists/{kind}` | admin | Monitoring lists (users with masked phones, bookings, payments, etc.) |
| POST | `/admin/approvals` | admin | `entity` (venue, event, talent, merchant_application), `id`, `status` (approved, rejected, suspended) |
| POST | `/admin/users/{id}/role` | admin | Change role (not own). Revokes target's sessions |
| POST | `/admin/users/{id}/tier` | admin | Assign Silver, Gold or Black manually |
| POST | `/admin/talents` | admin | Create a talent profile |
| POST | `/admin/support/{id}/status` | admin | Update support ticket status |
| POST | `/admin/data-requests/{id}/status` | admin | Update data-request status |

## Idempotency and concurrency notes

- Webhook events are de-duplicated on `(provider, event id)`.
- Ledger entries carry unique idempotency keys.
- Booking creation uses a conditional inventory update; concurrent requests for the last ticket yield one success and one `409`.
