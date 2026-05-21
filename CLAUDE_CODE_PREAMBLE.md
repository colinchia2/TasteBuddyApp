# TasteBuddy v2 — Claude Code Preamble

> Paste this at the top of EVERY Claude Code prompt. It ensures consistency across web and app.

## Stack

| Layer | Tech |
|---|---|
| Backend | Flask + SQLAlchemy + MySQL on PythonAnywhere |
| Web frontend | Bootstrap 5, Jinja2, DM Sans + Outfit fonts, Tabler Icons (outline only) |
| Mobile app | React Native + Expo (iPhone only) |
| AI | Anthropic Claude (Sonnet for answers, Haiku for classification), Perplexity API, Google Places API |
| Photos | Local filesystem now (`app/static/uploads/photos/`), Cloudinary migration planned. Always use `photo.storage_url` as-is — never concatenate paths. Pillow compression: 1600px max, JPEG 82%. |
| Push notifications | Expo Push Notifications |
| Live URL | tastebuddy-colinchia2.pythonanywhere.com |

---

## Cross-Platform Consistency Rules — ALWAYS ENFORCE

Every user-facing flow that exists on **both web and app** must be identical:

1. **Same API endpoints** — app and web call the same Flask JSON API routes. Never create a duplicate endpoint.
2. **Same JSON payloads** — request/response shapes identical regardless of client.
3. **Same fields in the same order** — if web shows Place → Category → Tier → Date → (expandable: Occasion, Meal period, Spending, Would return, Notes, Photo), app shows the same.
4. **Same labels and copy** — tier labels: S, A, B, C, Next Up, TBE. C-tier = "C-Tier — Okay". AI feature = "Ask TasteBuddy AI Anything". Always "Places", never "restaurants" or "listings".
5. **Same validation errors** — identical error messages on both platforms.
6. **Same design tokens** — `static/css/design_tokens.css` (web) and `src/constants/tokens.js` (app) must have identical hex values. Change one → change the other.

---

## Design Tokens (LOCKED — never deviate)

| Element | Background | Text |
|---|---|---|
| Tier S | `#FAEEDA` | `#633806` |
| Tier A | `#EAF3DE` | `#27500A` |
| Tier B | `#E6F1FB` | `#0C447C` |
| Tier C | `#F1EFE8` | `#5F5E5A` |
| Next Up | `#FCEBEB` | `#791F1F` |
| TBE | `#FEFCE8` | `#713F12` |
| Category pill | `#85B7EB` | `#042C53` |
| Cuisine pill | `#B4B2A9` | `#2C2C2A` |
| Brand gold | `#C8960C` | — |
| Active nav | `#FAEEDA` | `#C8960C` |
| Nav background | `#fafaf8` | — |
| Nav border | `#e0ddd8` | — |

**Rules:**
- No borders on any badges or pills
- Category pills link to `/my-places?view=rankings&category=X`
- Cuisine pills link to `/my-places?view=rankings&cuisine=X`
- Fonts: DM Sans (body), Outfit (headings/brand)
- Tabler Icons (outline only, never `-filled`)
- Import `design_tokens.css` FIRST before any other CSS in `base.html`
- Use inline styles with exact hex values in templates rather than relying on class inheritance

---

## Naming Conventions — ALWAYS USE

| Concept | Correct term |
|---|---|
| A restaurant/listing | **Place** |
| Rankings page | **My Places** (nav) / **Rankings** (page title) |
| A persona/profile | **Tastie Persona** |
| Personas nav item | **Tastie Personas** |
| AI feature name | **Ask TasteBuddy AI Anything** |
| AI nav item | **Ask AI** |
| Dashboard | **TasteBoard** |
| Visit history | **Activity** |
| HP-TBE | **Next Up** |
| To Be Eaten | **TBE** |
| C-Tier label | **C-Tier — Okay** |

---

## Nav Structure (web, locked)

`Logo (left) → TasteBoard · Ask AI · My Places · Tastie Personas → Search · Bell · Log a Visit (gold outline) · + Add a Place (gold filled) · Profile dropdown`

- Nav bg: `#fafaf8`, height 62px, border-bottom `#e0ddd8`
- Home page (`/`): no nav link highlighted — pass `active_nav=None`
- Footer: "TasteBuddy — Your Buddy, with your Taste in mind"
- **No sub-navs on any page**

---

## Key Rules — ALWAYS ENFORCED

1. Every place link uses slug URL: `/my-places/[slug]` — never `/places/[id]`
2. Tier badge colors from design tokens — never hardcoded Bootstrap colors
3. No borders on any badges or pills
4. No sub-navs on any page
5. No horizontal scrolling — use CSS grid auto-fill or flex-wrap
6. All UI text says "Places" — never "restaurants" or "listings"
7. All interactions (edit, log, add) use popups or inline editors — never navigate away
8. Every API call gets a row in `api_log` — no exceptions
9. All datetimes stored UTC — timezone applied at display time from `user.timezone`
10. Data is user-specific — persona places never auto-merge into user DB
11. Default categories on new account: Breakfast, Lunch, Dinner (`is_primary=True`, cannot be deleted)
12. Zero visits created during onboarding
13. Log a Visit modal lives in `base.html` (available on every page), triggered by `.log-visit-trigger` class
14. Place detail uses `container-fluid` — override any `<main class="container">` from base template
15. Always include all 6 tiers (S, A, B, C, Next Up, TBE) in every query — never filter out Next Up or TBE

---

## AI Modes (8 + 2 special)

Auto-classified by Haiku. User never picks a mode.

| Mode | Pipeline | Cost |
|---|---|---|
| `search_database` | Haiku + Sonnet | $0.01–0.03 |
| `discover_new` | Haiku + Perplexity + Sonnet | $0.05–0.07 |
| `plan_visit` | Haiku + Google Places + Sonnet | $0.02–0.05 |
| `organize_nextup` | Haiku + Sonnet | $0.01 |
| `food_crawl` | Haiku + Sonnet (+ optional Perplexity) | $0.02–0.05 |
| `log_visit` | Haiku + Sonnet | $0.01 |
| `taste_analysis` | Haiku + Sonnet | $0.02–0.03 |
| `set_reminder` | Haiku + Sonnet → reminders table → push/email | $0.01 |
| `add_place` (special) | Haiku only → UI redirect | $0.0002 |
| `persona_mode` (special) | Haiku + Sonnet (persona context) | $0.02–0.03 |

Action modules: Sonnet appends `---ACTIONS---` JSON block. Web renders interactive cards (add_place, log_visit, set_reminder, add_category). ~$0.0002/quality check via Haiku.

---

## Auth Pattern

- **Web routes:** `@login_required` + `current_user`
- **Mobile API routes:** `@jwt_required()` + `get_jwt_user()`
- **Dual-auth endpoints** (serve both JWT and session): use `user_from_bearer(auth_header)` from `utils_jwt.py` — do NOT call `get_jwt_user()` without the decorator or it raises AttributeError → Flask 500 → HTML response
- Mobile AI endpoint: `POST /api/ask/chat` (not `/api/ask`)

---

## Shared vs Platform-Specific Flows

**Shared (web + app, must be identical):**
Log a Visit, Add a Place, Ask AI, Onboarding

**Web-only:**
TasteBoard, Place Detail, My Places/Rankings, Activity, Tastie Personas, Settings, Admin, Analytics (`/analytics?key=wdwd`)

**App-only:**
GPS check-in, Push notification prompts, 8-screen onboarding (primary)

---

## Pre-Commit Checklist (include in every prompt)

Before completing ANY change:
- [ ] Does this flow exist on both web and app? If yes, update both.
- [ ] Are design tokens still in sync between CSS and JS?
- [ ] Are all badges/pills using locked colors with no borders?
- [ ] Are all labels using correct naming conventions?
- [ ] Does the API endpoint return the same shape for both clients?
- [ ] Is the new API call logged in `api_log`?
- [ ] Are datetimes stored in UTC?
- [ ] Do all place links use `/my-places/[slug]`?
- [ ] Are all 6 tiers included in queries?

---

## Known Claude Code Pitfalls (watch for these)

| Issue | Fix |
|---|---|
| Migration row count mismatch | v1 has one `user_places` row per (place + category) combo. Verify counts match v1 exactly. |
| Hardcoded Bootstrap colors | Use design tokens. Inline styles with exact hex > class inheritance. |
| TBE + Next Up filtered out | Always include all 6 tiers in every query. |
| ID-based place URLs | Must be `/my-places/[slug]`, never `/places/[id]`. |
| Log a Visit modal placement | Must be in `base.html`, not in a page-specific template. |
| Single-column place detail | Use `container-fluid`, override base template's `<main class="container">`. |
| Skipped verification checklist | Explicitly ask "do not proceed until all checks pass". |
| `get_jwt_user()` without decorator | Use `user_from_bearer()` for dual-auth endpoints — calling `get_jwt_user()` without `@jwt_required()` raises AttributeError → 500 → HTML → JSON parse error in app. |
| HTML response from API in app | Means a missing DB table on PythonAnywhere. Run `python _dev_scripts/create_missing_tables.py`. |
