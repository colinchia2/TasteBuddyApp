# TasteBuddy — React Native / Expo App

## What this is
Expo SDK 56 React Native app. Ships as **EAS dev + production builds → TestFlight** (left Expo Go).
Backend: https://tastebuddy-colinchia2.pythonanywhere.com (same as web app)

## Location (IMPORTANT)
Canonical path is **`C:\dev\TasteBuddyApp`** — moved OFF OneDrive 2026-06-06 because OneDrive
live-sync corrupts `node_modules` and crashes Metro (`TreeFS: Failed to make parent directory
entry`). Do ALL app work here. The OneDrive copy (`…\Documents\Python\TasteBuddyApp`) is a
frozen backup — do not edit it or run Metro from it. Build/EAS/TestFlight detail: AGENTS.md / memory.

## Companion web app
Flask app lives at: `C:\Users\colin\OneDrive\Documents\Python\TasteBuddy`

## Key commands (run from C:\dev\TasteBuddyApp)
```
# Start Metro for the dev build (tunnel = reliable on Windows; LAN often blocked by firewall on 8081)
npx expo start --dev-client --tunnel
npx expo whoami                       # should return: colinchia2

# OTA — the DEFAULT deploy for app-JS changes (build 4 on TestFlight, fingerprint runtime 47b1428…):
eas update --branch production --message "..." --environment production
#   Pull on device: open → wait ~15s → fully quit → reopen.
#   OTA only works for pure-JS changes. NEW native dep / SDK bump / permissions / icon / app.json
#   native config → needs a full build + submit (below) + a new TestFlight build.

# Production → TestFlight (INTERACTIVE Apple 2FA — run in a real terminal, not via tooling):
eas build --profile production --platform ios
eas submit --platform ios --latest    # internal TestFlight only; never submit for public App Store review
```

## Conventions & docs (web repo holds the canonical detail)
- **Datetime (Rule 9):** visit/check-in times are **naive-local** strings — NEVER `new Date(storedValue)`
  (Hermes parses zone-less ISO as UTC and shifts the day); build dates from local Y/M/D
  (`localDateFromYMD`). Full rule: web repo `CLAUDE_CODE_PREAMBLE.md` (Rule 9).
- **Cross-platform parity, endpoints, schema:** web repo `ARCHITECTURE.md`. This cycle's changes: `BUILD LOG.md`.

## Auth
- JWT tokens stored in AsyncStorage (`access_token`, `refresh_token`)
- All API calls go through `src/api/client.js` → `apiFetch()` which auto-refreshes on 401
- **Google sign-in = native `@react-native-google-signin/google-signin` (v16.1.2)** — works in standalone/TestFlight builds. Replaced the old `expo-auth-session/providers/google` proxy flow (the `auth.expo.io` proxy was dead in standalone builds; never worked off Expo Go).
  - `src/auth/google.js` — shared helper: `configureGoogleSignin()` (lazy, idempotent) + `signInWithGoogleAccessToken()`. Opens the native sheet, then `GoogleSignin.getTokens()` → returns the Google **access token** (not idToken) so the backend stays unchanged.
  - All 3 entry points (`WelcomeScreen`, `LoginScreen`, `SignUpScreen`) call the shared helper → `loginWithGoogle(accessToken)` → `POST /api/auth/google`. Backend verifies via Google `userinfo?access_token=` (idToken path NOT used). Cancellation (`statusCodes.SIGN_IN_CANCELLED`) is silent.
  - Config plugin in `app.json`: `["@react-native-google-signin/google-signin", { iosUrlScheme: "com.googleusercontent.apps.918439480148-skp68m8e98idt494ejr1h1bf14q6mh7k" }]` (reversed iOS client ID). **Native change** → needs a full EAS build + submit (NOT OTA); not testable in the old dev client / over Metro.
  - `webClientId`: 918439480148-r36km6tsj5qub0fkhe1i9j8gftod5qms.apps.googleusercontent.com
  - `iosClientId`: 918439480148-skp68m8e98idt494ejr1h1bf14q6mh7k.apps.googleusercontent.com
  - Bundle ID: `com.colinchia.tastebuddy` (the iOS OAuth client matches on this).
  - ⚠️ Apple guideline 4.8: a *public* App Store release offering Google sign-in must also offer Sign in with Apple. Fine for internal TestFlight. `expo-auth-session` left in package.json (now unused) — prune later.

## Folder structure
```
App.js                  # Root navigator — all screens registered here
src/
  api/client.js         # BASE_URL, apiFetch with auto token refresh
  auth/AuthContext.js   # Auth state, login/logout/loginWithGoogle
  constants/colors.js   # COLORS + TIER_COLORS design tokens
  components/
    ScreenHeader.js     # Shared header with back button
  screens/
    WelcomeScreen.js    # Landing — Google OAuth + email options
    LoginScreen.js      # Email login
    SignUpScreen.js     # Registration
    OnboardingScreen.js # First-time setup
    HomeScreen.js       # Main feed + AI chat input
    CheckInScreen.js    # GPS nearby places + search, leads to LogVisit
    LogVisitScreen.js   # Log a visit form
    AddPlaceScreen.js   # Add a place (search + details step 2)
    ActivityScreen.js   # Recent activity feed, edit buttons
    EditVisitScreen.js  # Edit visit (tier, occasion, notes)
    EditPlaceScreen.js  # Edit place (tier, category, cuisine)
    AskScreen.js        # AI chat full screen
    ChatHistoryScreen.js# Past chat sessions
    NotificationsScreen.js
    SettingsScreen.js
    PlacesScreen.js
```

## Navigation (App.js)
All authenticated screens are modal presentation. Entry point after login: `Home`.
Flow: Home → CheckIn (modal) → LogVisit (modal) → back to Home
Flow: Home → AddPlace (modal) → back to Home
Flow: Home → Activity (modal) → EditVisit or EditPlace (modal)

## API endpoints used by the app
All require `Authorization: Bearer <token>` header.
- `POST /api/auth/token` — login
- `POST /api/auth/register` — register
- `POST /api/auth/google` — Google OAuth
- `GET /api/auth/me` — current user (includes live tastie_score)
- `GET /api/places/google-nearby?lat=&lng=` — nearby restaurants
- `GET /api/places/google-autocomplete?q=` — search places
- `POST /api/places/gps-checkin` — check in to a place
- `POST /api/places/add-mobile` — add place to list
- `GET /api/places/users/categories` — user's categories
- `GET /api/places/cuisines` — user's distinct cuisines
- `GET /api/places/<id>/categories-mobile` — place's user_place entries
- `PATCH /api/places/user-place/<id>/mobile` — edit place (tier, category, cuisine)
- `POST /api/visits/mobile` — log a visit
- `PATCH /api/visits/<id>/mobile` — edit visit (tier, occasion, notes)
- `GET /api/activity/feed?page=` — activity feed
- `GET /api/activity/recent?limit=` — recent items for home
- `GET /api/chat/sessions` — chat history list
- `DELETE /api/chat/sessions/<id>` — archive session
- `GET /api/chat/sessions/<id>/messages` — messages in a session
- `POST /api/chat/sessions/<id>/rename` — rename a session
- `POST /api/ask/chat` — AI chat
- `GET /api/notifications?limit=30` — user notifications
- `POST /api/notifications/mark-read` — mark all as read
- `GET /api/photos?visit_id=X` — list photos for a visit (JWT)
- `POST /api/photos/upload` — upload photo via `api.uploadFile()` → expo-file-system `uploadAsync` (multipart `file`+`place_id`+`visit_id`). The New Architecture rejects fetch+FormData file parts, so do NOT use `api.upload()` for files.
- `DELETE /api/photos/delete/<id>` — delete a photo

## Design tokens — src/constants/colors.js
| Tier    | bg       | text    | label    |
|---------|----------|---------|----------|
| S       | #FAEEDA  | #633806 | S Tier   |
| A       | #EAF3DE  | #27500A | A Tier   |
| B       | #E6F1FB  | #0C447C | B Tier   |
| C       | #F1EFE8  | #5F5E5A | C Tier   |
| NEXT_UP | #FCEBEB  | #791F1F | Next Up  |
| TBE     | #FEFCE8  | #713F12 | TBE      |
Gold: #C8960C

## Important rules
- Read Expo SDK 56 docs before writing any Expo-specific code: https://docs.expo.dev/versions/v56.0.0/
- Use `ScrollView` (not `FlatList` with ListHeaderComponent) for forms — FlatList remounts TextInputs on state change, collapsing the keyboard on every keystroke
- `keyboardShouldPersistTaps="handled"` on any ScrollView/FlatList that contains buttons near a TextInput
- All API errors returning HTML (`<`) mean a missing DB table on PythonAnywhere — run `python _dev_scripts/create_missing_tables.py` on PA

## My Places fix pass — 4 on-device issues (2026-06-06)
- `MyPlacesScreen.js` — now single-column tiles from `GET /api/places/categories-summary`: primary (Breakfast/Lunch/Dinner by display_order) first, a divider, then user-added alphabetical, then Other. Each tile shows all 6 tier-count pips (zeros dimmed) + total — same numbers as the site (shared `build_category_summaries`).
- `RankingsScreen.js` — filter UI reworked: the broken horizontal chip ScrollViews (clipped/expanding bars) replaced with a flex-wrap row of filter trigger pills → each opens a searchable **type-and-select** modal. Filters: tier, cuisine, city, neighborhood, country, state (state shown only if any place has one; geo/cuisine shown only when >1 distinct value). Vocabularies derived client-side from the loaded places; all filtering client-side across all 6 tiers. State shows the raw 2-letter code (web shows full name — minor).
- `src/components/FilterSelectModal.js` — NEW searchable picker (type to filter, tap to select, "All X" clears). Mirrors the site's select2 behaviour.
- Keyboard fix: all new search/filter `TextInput`s use the canonical good config (`autoCorrect`/`spellCheck`/`autoCapitalize`/`keyboardType="default"`) — same as the HomeScreen chat input. The bug was `autoCorrect={false}` killing the iOS predictive bar.
- `PlaceCardModal.js` — "Open in Maps" now uses the server's `maps_url` (place-id listing via the shared helper), lat/lng fallback retained.

## My Places — read-only browse (2026-06-06)
- New entry point on `HomeScreen` home: a wide "My Places" tile below the Log a Visit / Add a Place action tiles (white card, gold list icon, `browseTile` styles) → navigates to `MyPlaces`.
- `App.js` — registered `MyPlaces` (Categories) and `Rankings` screens.
- `src/screens/MyPlacesScreen.js` — Categories grid (2-per-row roomy tiles) from `GET /api/places/users/categories`; tap → Rankings.
- `src/screens/RankingsScreen.js` — per-category rankings from `GET /api/places/rankings?category=<id>`. SectionList grouped by tier (tier-colored section headers using `label` from server, e.g. "C-Tier — Okay"), client-side filters (tier chips, cuisine chips, name search — fetches once, refines locally; server always returns all 6 tiers). Tap a row → read-only card. Keys on slug.
- `src/components/PlaceCardModal.js` — read-only bottom-sheet: name, TierBadge, category/cuisine pills, address/neighborhood/city, rating, price level. External links go ONLY to the restaurant's website / reservation_url / Google Maps (no TasteBuddy-site link — JWT app would hit a login wall). "Full details coming soon" note. NO visit/photo/edit/log UI (deferred).
- `src/components/Pill.js` — NEW `CuisinePill` / `CategoryPill` (locked pill tokens, no borders).
- `src/constants/colors.js` — added `pillCatBg/pillCatText/pillCuiBg/pillCuiText` to match design_tokens.css `--pill-*` (parity gate).
- Reuses existing `TierBadge.js`. `PlacesScreen.js` remains orphaned/unused (not registered) — untouched.
- READ-ONLY surface: no mutation endpoints touched. In-app Place Detail (visits/photos/editing) is the natural next phase.

## AI chat streaming — token-by-token (2026-06-06)
- `HomeScreen.js` Ask AI now STREAMS via SSE (was await-full-JSON). Calls `POST /api/ask/chat/stream` (the backend endpoint already existed, mirroring the web `/ask/api/stream` and reusing the shared `_run_pre_sonnet_pipeline()`). Non-streaming `POST /api/ask/chat` is kept as the pre-token fallback.
- `src/api/client.js` — added `api.stream(path, body, {signal, onEvent})` using `import { fetch } from 'expo/fetch'` (the only fetch whose Response exposes `body.getReader()`). NO new native module — pure JS, OTA-pushable via EAS Update. Handles 401 refresh, paywall/non-OK (throws err.status/err.data), skips `: keepalive` comments.
- SSE wire contract (identical to web): events `metadata` / `stream_start` / `text_delta`{delta} / `stream_end`{response,mode,is_clarifying,questions,actions,...} / `done` / `error`{message}.
- Live block-strip: `stripPartialBlocks()` is a port of the web's `_stripPartialBlocks` — hides any opened-but-unclosed `---ACTIONS---/PLACES/FOLLOWUPS/QUESTIONS/META---` block so raw JSON never flashes mid-stream. On `stream_end` the server's already-clean `response` + structured arrays replace the buffer, so the FINAL rendered result (text + clarifying questions OR follow-up chips + action cards) is identical to the old path.
- UI: typing indicator (`awaitingFirstToken`) transitions into the first token; deltas buffered and flushed every 45ms (never per-token); `onContentSizeChange` auto-scrolls while streaming; `AbortController` cancels on unmount / New chat / swipe-back; mid-stream error keeps partial text + shows a Retry chip; pre-token failure falls back to non-streaming.
- Note: `TextDecoder` is a global in Expo SDK 56 (used by the reader loop).

## Recent changes (as of 2026-05-19)
- App moved from `C:\Users\colin\TasteBuddyAppScaffold` → `C:\Users\colin\OneDrive\Documents\Python\TasteBuddyApp`
- `iosClientId` added to Google OAuth in WelcomeScreen + LoginScreen (was throwing "iOS Client ID must be defined")
- `CheckInScreen` — added Google Places search bar; nearby places still load by default
- `AddPlaceScreen` — keyboard bug fixed (FlatList → ScrollView in step 2); cuisine now required with dropdown of existing cuisines
- `ActivityScreen` — edit buttons on each item, navigates to EditVisit/EditPlace
- `EditVisitScreen` — new screen: edit tier, occasion, notes via PATCH /api/visits/<id>/mobile
- `EditPlaceScreen` — new screen: edit tier, category, cuisine via PATCH /api/places/user-place/<id>/mobile
- `HomeScreen` — activity icon in header navigates to ActivityScreen
- `LogVisitScreen` — multi-photo picker (no max), deferred upload after visit save (per-file partial-failure reporting)
- `EditVisitScreen` — photo section: loads existing photos from GET /api/photos, multi-select add + immediate upload/delete
- `ActivityScreen` — now passes `placeId` to EditVisit for photo uploads
- `api/client.js` — `api.uploadFile()` (expo-file-system `uploadAsync`) for file uploads; legacy `api.upload()` (fetch+FormData) is unused for files (New-Arch incompatible)
- `SettingsScreen.js` — fixed `getExpoPushTokenAsync()` to pass `{ projectId }` from `Constants.expoConfig.extra.eas.projectId` (SDK 55 requirement); gracefully falls back to `{}` if projectId not set
- `app.json` — `extra.eas.projectId` is SET (EAS project linked); push tokens resolve in standalone builds
- `App.js` — imports `expo-notifications`; `navigationRef` wired to NavigationContainer; `addNotificationResponseReceivedListener` navigates to LogVisit on `visit_reminder` tap (warm start); `getLastNotificationResponseAsync` in `onReady` handles cold start
- `AuthContext.js` — **backfills the Expo push token on launch/login** (when OS permission is granted) via `PATCH /api/auth/push-token`, fixing already-onboarded users whose token was NULL. Onboarding + Settings also register it.
