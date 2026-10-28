# Vercel staging setup

Goal: a live staging site where the public pages (home, Dine-In, venues, events, talent, legal) work with fictional demo content. Login and payments stay off until an SMS vendor and the Razorpay checkout step exist. This is **staging**, not production.

## 1. Database

Vercel project, Storage tab, Create Database, Neon (Postgres). Connect it to the project. Choose the Mumbai or Singapore region if offered. The integration adds `DATABASE_URL` (pooled) and usually `DATABASE_URL_UNPOOLED`. If only `POSTGRES_URL` appears, add `DATABASE_URL` with the same value.

## 2. Environment variables

Vercel project, Settings, Environment Variables. Add each one and tick **Production** only.

| Name | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | added by Neon | App database (pooled connection) |
| `APP_ENV` | `staging` | Turns on staging safety rules (no dev login, no fake payments route) |
| `APP_URL` | your site address, e.g. `https://drnk-website-platform-v1.vercel.app` | Same-origin check and links. Copy it from the project's Domains tab |
| `SESSION_SECRET` | random, 32+ characters | Signs login codes and session tokens. Changing it logs everyone out |
| `OTP_PROVIDER` | `provider` | Real SMS login. The vendor adapter is not built yet, so login shows "temporarily unavailable" |
| `PAYMENT_PROVIDER` | `razorpay` | Real payment provider. Checkout step is not built yet |
| `CRON_SECRET` | random | Lets Vercel's daily job release expired ticket holds |
| `MIGRATE_ON_BUILD` | `1` | Creates/updates database tables during the build |
| `SEED_DEMO_ON_BUILD` | `1` | Loads fictional demo venues, events and talent (no demo accounts) |
| `DB_POOL_MAX` | `3` | Keeps database connections low on serverless |
| `DEMO_LOGIN` | `1` (optional, private testing only) | Lets you log in as a fictional demo customer while text messages are not connected. See "Demo login" below. Leave it unset or `0` otherwise |
| `DEMO_LOGIN_CODE` | a 6-digit code you choose (not `123456`) | The code you type at login. Required when `DEMO_LOGIN=1`. Keep it private |

Add later, not needed to see the site:

| Name | When |
| --- | --- |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | When the checkout step is built. Use the Razorpay **test** key pair |
| `RAZORPAY_WEBHOOK_SECRET` | Same time. Must equal the secret entered in the Razorpay webhook |
| SMS vendor credentials | When the vendor is chosen (names will be defined with the adapter) |

## Demo login (staging only)

With `DEMO_LOGIN=1` and your own `DEMO_LOGIN_CODE`, the login page lists three fictional numbers: two customers (`9000000002`, `9000000003`) and one venue owner (`9000000004`, who owns the demo venues and sees the merchant workspace at `/merchant`). Enter one, press Send code, and type your demo code. Nothing is sent by SMS.

- Only those three numbers work. The demo admin number, and any real number, are refused.
- `APP_ENV` must be `staging` too. If the panel does not appear on the login page, one of `APP_ENV=staging`, `DEMO_LOGIN=1` or `DEMO_LOGIN_CODE` is missing in the environment the site was built from, or you have not redeployed since adding it.
- It only starts when `APP_ENV=staging`. The app refuses to start with it switched on in production, development or test.
- Anyone who knows the site address and your code can act as a demo customer. Use a code you have not shared, keep the address private, and switch it off (`DEMO_LOGIN=0`, then redeploy) before real users arrive.

## Checking you are looking at the latest version

The footer shows `Build <first 7 characters of the commit>`, and `/api/health` returns the same value in `build`. Compare it with the commit on GitHub. If it differs, you are on an older deployment: open the address from Vercel's Deployments tab, not a saved link.

## Photos

The stock photos are downloaded during each build into the site's own files, so pages do not depend on Unsplash at view time. Open `/photos/manifest.json` on the deployed site: it lists how many downloaded and which failed. If the build cannot reach Unsplash, those photos still try the Unsplash address in the browser and then fall back to a tinted tile. Set `SKIP_PHOTO_FETCH=1` to skip the download.

## Database connections

The app handles dropped idle connections (Neon closes them) by replacing them rather than crashing. If you still see "Talent didn't load" or "Something went wrong", send the Vercel runtime log for that request (Deployments, the deployment, Logs).

Changing environment variables only affects new deployments: after you change one, open Deployments, open the menu on the latest one, and choose Redeploy.

Never put these values in GitHub, chat, or screenshots.

## 3. Deploy

Deployments tab, latest deployment, the three dots, Redeploy. Wait for "Ready". The build log should say `migrations applied`, `demo accounts: skipped`, `demo seed complete`.

## 4. Check it

- `https://<your-site>/api/health` shows `{"status":"ok","db":"ok"}`.
- Home shows Demo Taproom, Demo Kitchen and Demo Pub, one event and two artists.
- Dine-In, Events, Talent & Gigs and a venue page open.
- Log in shows a "temporarily unavailable" message. That is expected until the SMS vendor is wired.

## 5. Later: Razorpay webhook

Razorpay dashboard, Test mode, Settings, Webhooks, Add. URL `https://<your-site>/api/webhooks/payments`, secret equal to `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured` and `payment.failed`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `/api/health` shows `db: down` | `DATABASE_URL` missing, or Neon database paused or not connected to the project |
| Build fails with `DATABASE_URL is not set` | `MIGRATE_ON_BUILD`/`SEED_DEMO_ON_BUILD` set but the database is not connected for the Production environment |
| Build fails with `OTP_PROVIDER=dev is forbidden` | `OTP_PROVIDER` is not `provider`, or `APP_ENV` is wrong |
| Build fails mentioning `SESSION_SECRET` | Missing or shorter than 32 characters |
| Site loads but lists are empty | `SEED_DEMO_ON_BUILD` not set at build time. Add it and redeploy |
| Every form returns "Cross-origin request rejected" | The page is served from an address that is neither `APP_URL` nor the address the request was sent to. Check `APP_URL` |
