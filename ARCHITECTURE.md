# TasteBuddy v2 — Architecture Reference

## Directory Structure

```
app/
├── __init__.py              # App factory, extensions, blueprint registration
├── models.py                # All 19 SQLAlchemy models
├── utils.py                 # Shared helpers
├── utils_jwt.py             # JWT token helpers for mobile auth + user_from_bearer()
├── static/
│   ├── css/
│   │   └── design_tokens.css   # ← CANONICAL web design tokens
│   └── uploads/photos/         # Local photo storage (future: Cloudinary)
├── templates/
│   ├── base.html               # Layout + Log a Visit modal (available on every page)
│   ├── home.html
│   ├── activity/index.html
│   ├── admin/personas.html
│   ├── analytics/dashboard.html, login.html
│   ├── ask/index.html, how_it_works.html
│   ├── auth/login.html, register.html, welcome.html, email_verified.html
│   ├── errors/404.html, 500.html
│   ├── main/features.html, onboarding_gate.html, tasteboard.html, tastie_score.html
│   ├── notifications/index.html
│   ├── personas/detail.html, index.html, my_profile_private.html, private.html, public_profile.html, request.html
│   ├── places/my_places.html, pairwise.html, place_detail.html, resort.html
│   └── settings/index.html
├── routes/                     # Web routes (session auth)
│   ├── activity.py
│   ├── analytics.py
│   ├── ask.py                  # Web chat + create_reminder_api + report_response
│   ├── auth.py
│   ├── main.py                 # Home, TasteBoard, features, onboarding gate
│   ├── notifications.py
│   ├── personas.py
│   ├── places.py
│   ├── settings.py
│   └── welcome.py
├── routes/api/                 # JSON API routes (JWT auth for app)
│   ├── activity.py
│   ├── ask.py                  # Mobile chat endpoint — POST /api/ask/chat
│   ├── auth.py
│   ├── categories.py
│   ├── chat.py
│   ├── notifications.py
│   ├── onboarding.py           # 10+ functions for 8-screen flow
│   ├── photos.py
│   ├── places.py               # add_mobile, gps_checkin, categories, cuisines, photos
│   └── visits.py               # Full CRUD: log_visit, log_visit_mobile, edit, delete
└── services/
    ├── ai.py                   # Classifier + Sonnet pipeline + action parsing
    ├── google_places.py
    ├── notifications.py
    └── onboarding_ai.py        # Perplexity suggestions, Haiku cuisine classification

src/                            # React Native Expo app
└── constants/tokens.js         # ← CANONICAL app design tokens (must match design_tokens.css)
```

---

## Database Schema (19 tables)

### Core Entities

| Table | Key Columns | Notes |
|---|---|---|
| `users` | plan, ai_questions_used, tastie_score, push/expo token, profile_public, timezone | Session auth (web) + JWT (app) |
| `cities` | name, country, lat, lng | |
| `places` | google_place_id, slug, display_name, address, neighborhood, city_id, rating, price_level, website, reservation_url | Slug is canonical URL identifier |
| `categories` | user_id, name, is_primary, display_order | Default: Breakfast, Lunch, Dinner (is_primary=True) |

### Rankings & Visits

| Table | Key Columns | Notes |
|---|---|---|
| `user_places` | user_id, place_id, category_id, cuisine, tier, s_tier_position, is_active | **One row per (place + category) combo** — a place in 2 categories = 2 rows |
| `visits` | user_id, place_id, visited_at, occasion, party_size, meal_period, notes, spending, would_return, tier_at_visit, log_source | |
| `photos` | user_id, visit_id, place_id, storage_url | `storage_url` is single source of truth |
| `tier_history` | user_id, user_place_id, place_id, old_tier, new_tier, changed_at, dismissed | |

### AI & Analytics

| Table | Key Columns | Notes |
|---|---|---|
| `ai_conversations` | user_id, conversation_id, question_text, response_text, mode, persona_id, flagged, auto_flagged, response_quality, detected_actions, is_demo | |
| `chat_sessions` | id (UUID), user_id, title, persona_id, is_archived | |
| `api_log` | user_id, conversation_id, model, phase, service, tokens_in/out, cost_cents, cache_hit, duration_ms, is_demo | Every API call logged |
| `reminders` | user_id, place_id, place_name_raw, reminder_at, reason, sent | Created by AI set_reminder action |

### Personas

| Table | Key Columns | Notes |
|---|---|---|
| `tastie_personas` | name, slug, type, avatar_url, is_public, follower_count, status | |
| `persona_places` | persona_id, place_id, category, cuisine, tier, s_tier_position | |
| `persona_requests` | name, type, source_url, status, rejection_reason | |
| `persona_follows` | user_id, persona_id | |

### Notifications & Check-ins

| Table | Key Columns | Notes |
|---|---|---|
| `notifications` | user_id, type, title, body, related_place_id, related_visit_id, is_read | |
| `pending_checkins` | user_id, place_id, checkin_at, notification_sent_at, completed, visit_id | GPS check-in flow |

### Onboarding

| Table | Key Columns | Notes |
|---|---|---|
| `onboarding_suggestions` | city_id, category, place_name, source | Perplexity-generated dinner spot suggestions |

---

## Route Map

### Web Routes (session auth)

| File | Key Routes |
|---|---|
| `main.py` | `/` (home), `/tasteboard`, `/features`, `/onboarding-gate` |
| `places.py` | `/my-places`, `/my-places/<slug>` (detail), `/my-places/pairwise` |
| `ask.py` | `/ask` (chat UI), `POST /ask/api` (web chat), `POST /ask/reminder`, `POST /ask/report` |
| `activity.py` | `/activity` (list + calendar views) |
| `personas.py` | `/tastie-personas`, `/tastie-personas/<slug>`, persona follow/request/admin |
| `auth.py` | `/login`, `/register`, `/logout`, `/verify-email`, Google OAuth |
| `welcome.py` | `/welcome` (landing), demo mode |
| `analytics.py` | `/analytics` (password: `wdwd`) |
| `notifications.py` | `/notifications` |
| `settings.py` | `/settings` |

### API Routes (JWT auth for mobile)

| File | Key Endpoints |
|---|---|
| `api/ask.py` | `POST /api/ask/chat` — mobile AI chat |
| `api/places.py` | `POST /api/places/add-mobile`, `POST /api/places/gps-checkin`, `GET /api/places/users/categories`, `GET /api/places/cuisines` |
| `api/visits.py` | `POST /api/visits/mobile` (log), `PATCH /api/visits/<id>/mobile` (edit), `DELETE /api/visits/<id>/mobile` |
| `api/photos.py` | `POST /api/photos/upload`, `GET /api/photos`, `DELETE /api/photos/delete/<id>` |
| `api/categories.py` | Category CRUD |
| `api/onboarding.py` | 10+ endpoints for 8-screen onboarding flow |
| `api/auth.py` | `POST /api/auth/token`, `POST /api/auth/register`, `POST /api/auth/google`, `GET /api/auth/me`, token refresh |
| `api/notifications.py` | `GET /api/notifications`, mark-read |
| `api/activity.py` | `GET /api/activity/feed`, `GET /api/activity/recent` |
| `api/chat.py` | `GET /api/chat/sessions`, `DELETE /api/chat/sessions/<id>`, `GET /api/chat/sessions/<id>/messages`, `POST /api/chat/sessions/<id>/rename` |

---

## Key Architectural Decisions

1. **One Log a Visit modal for both create and edit** — avoids maintaining two implementations. Lives in `base.html`.
2. **Action modules use `---ACTIONS---` separator** in Sonnet response — no extra API call, parsed out before display.
3. **Onboarding is app-only** — web gates to "download the app" page.
4. **Demo mode uses session flag** — logs in as Colin (ID 4) but blocks POST/PATCH/DELETE (except `/api/ask/chat`).
5. **`photo.storage_url` is single source of truth** — no path concatenation. Future Cloudinary = one-line change.
6. **One `user_places` row per (place + category) combo** — a place in 2 categories has 2 rows. This is intentional and matches v1 behavior.
7. **All 6 tiers always included** — S, A, B, C, Next Up, TBE. Never filter out any tier from queries.
8. **Dual-auth pattern** — endpoints serving both JWT (app) and session (web) use `user_from_bearer(auth_header)` from `utils_jwt.py`, not `get_jwt_user()`.

---

## Prompt Patterns That Work Well with Claude Code

| Pattern | Why it works |
|---|---|
| **Audit first, then build** | Send diagnostic prompt, get findings, write targeted build prompt |
| **Split big features** | e.g. quality classifier (4a) → multi-mode (4b) → action modules (4c) → polish |
| **HTML-first design** | Design every modal/card/badge as static HTML in chat first, then pass verbatim to Claude Code |
| **Verification checklists** | Claude Code skips them unless you explicitly say "do not proceed until all checks pass" |
| **SQL verification queries** | Post-deploy data checks catch issues early |
| **IMPERATIVE marking** | For things that MUST match existing flows exactly |
| **Cross-platform rule in every prompt** | Prevents web/app drift |
| **Include exact hex values** | Claude Code hardcodes Bootstrap colors if you don't give it the exact tokens |
