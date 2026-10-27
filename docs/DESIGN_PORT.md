# AI Studio prototype: what was taken, what was not

Source: `drnk-platform-new.zip` exported from Google AI Studio (Vite + React single-page app, an Express `server.ts`, a JSON file as database, about 42,000 lines). Reviewed 2026-10-27. It was run once in an isolated sandbox folder and screenshotted; its code was not copied into this repository.

## Taken: the visual design and navigation

| Element | In the prototype | In this app |
| --- | --- | --- |
| Palette | Near-black navy `#0B0D14`, gold `#FACC15` / `#D4AF37`, jade and cyan accents | Tokens in `src/app/globals.css` (`ink`, `panel`, `gold`, `jade`, `sky`, `rose`) |
| Type | Outfit (display), Plus Jakarta Sans (body), JetBrains Mono (labels) | Same families, loaded from Google Fonts in the browser with system fallbacks |
| Logo and tagline | `DRNK`, "DRINK. REFILL. NETWORK." | Same |
| Navigation | Top pills on desktop, bottom tab bar on phones | `SiteHeader`, `NavLinks`: Explore, Dine-In, Events, Talent & Gigs, Profile |
| Cards | Rounded panels, mono tags, gold primary buttons | `EventStub`, `VenueCard`, `TalentCard`, `ui.tsx` |

## Not taken, and why

| Prototype feature | Decision | Reason |
| --- | --- | --- |
| Delivery view, rider portal, delivery address bar | Left out | Delivery is excluded from the MVP |
| "DRNK Balance" in rupees (`points × tierMultiplier`), "Wallet & GOLD" | Left out | Would present a spendable balance that does not exist. Points and Alcometer are shown separately and are not money |
| "Up to 20% Gold Points Back", "+15% Cashback", `tierMultipliers` | Left out | Reward rates were never supplied. Nothing is shown or earned until an approved `reward_rules` row exists |
| Real Bengaluru venues (Toit, Byg Brewski, Social, Windmills, Four Seasons and others) with real websites, menus, prices, offers, "Verified Partner" badges | Left out | These claims and prices were generated, not supplied by the businesses. Publishing them implies endorsement and may be false. The seed uses clearly fictional "[Demo]" venues |
| Real-sounding artists ("DJ Ivan (Ivan Nilkon)") | Left out | Same reason |
| Editorial claims ("Karnataka's first licensed copper microbrewery", "Asia 50 Best", "License #001") | Left out | Unverified factual claims about real businesses. Any editorial copy needs a source and the venue's consent |
| Auth by an `x-user-id` header and a "Switch User" demo control | Left out | Trivially spoofable. This app uses OTP sessions with server-side roles |
| `drnk-database.json` and the 4,000-line `server.ts` | Left out | Replaced by PostgreSQL, migrations and tested services |
| Gemini key setup | Left out | No code in the prototype calls Gemini |
| Merchant KYC (FSSAI, excise licence, GSTIN, PAN, bank details) and admin financial BI | Deferred | Needs a compliance decision and secure document storage. Not in the MVP scope |
| Unsplash photography (about 400 hot-linked URLs) | Left out | Photos of unrelated places presented as real venues. Venue art is a typographic placeholder until approved images exist |
| Trending / video story modals | Deferred | Needs real editorial content and rights |

## Status of the port

| Area | Status |
| --- | --- |
| Shell, navigation, footer, tokens | DONE |
| Home, Dine-In (venue directory), venue page, events, event page, talent, talent page, login, account, booking | DONE (restyled, wired to the real APIs) |
| Merchant and admin consoles | PARTIAL: new colours and type, but their layouts are still the earlier simple forms and tables |
| Prototype's richer screens (weekly gig calendar, "My Passes", venue story modals, area switcher with PIN codes) | NOT DONE: each needs a content or backend decision |
| Real photography | NOT DONE: awaiting approved images |

## Decisions needed from DRNK

1. Which real venues, if any, are signed up, and who supplies their approved name, photos, menu and prices.
2. Whether editorial stories are wanted, who writes them, and who verifies claims.
3. Brand fonts and logo files (the prototype uses a typed wordmark in Outfit).
4. Whether to keep neighbourhood and PIN-code discovery from the prototype (needs a locations dataset).
