# TasteBuddy — React Native / Expo App

## What this is
Expo (SDK 55) React Native app. Runs in Expo Go on iOS via QR code.
Backend: https://tastebuddy-colinchia2.pythonanywhere.com (same as web app)

## Companion web app
Flask app lives at: `C:\Users\colin\OneDrive\Documents\Python\TasteBuddy`

## Key commands
```
# Start (preferred — same WiFi as phone)
npx expo start --lan --clear

# Start with tunnel (requires ngrok auth)
npx expo start --tunnel

# Check logged-in Expo user
npx expo whoami   # should return: colinchia2
```

## Auth
- JWT tokens stored in AsyncStorage (`access_token`, `refresh_token`)
- All API calls go through `src/api/client.js` → `apiFetch()` which auto-refreshes on 401
- Google OAuth uses `expo-auth-session/providers/google` v7
  - `webClientId`: 918439480148-r36km6tsj5qub0fkhe1i9j8gftod5qms.apps.googleusercontent.com
  - `iosClientId`: 918439480148-skp68m8e98idt494ejr1h1bf14q6mh7k.apps.googleusercontent.com
  - Bundle ID: `com.colinchia.tastebuddy` (set in app.json)
- Expo slug: `tastebuddy` (used in OAuth redirect URI: https://auth.expo.io/@colinchia2/tastebuddy)

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
- `POST /api/photos/upload` — upload photo; send as multipart with `file` field + `place_id` + `visit_id`
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
- Read Expo SDK 55 docs before writing any Expo-specific code: https://docs.expo.dev/versions/v55.0.0/
- Use `ScrollView` (not `FlatList` with ListHeaderComponent) for forms — FlatList remounts TextInputs on state change, collapsing the keyboard on every keystroke
- `keyboardShouldPersistTaps="handled"` on any ScrollView/FlatList that contains buttons near a TextInput
- All API errors returning HTML (`<`) mean a missing DB table on PythonAnywhere — run `python _dev_scripts/create_missing_tables.py` on PA

## Recent changes (as of 2026-05-19)
- App moved from `C:\Users\colin\TasteBuddyAppScaffold` → `C:\Users\colin\OneDrive\Documents\Python\TasteBuddyApp`
- `iosClientId` added to Google OAuth in WelcomeScreen + LoginScreen (was throwing "iOS Client ID must be defined")
- `CheckInScreen` — added Google Places search bar; nearby places still load by default
- `AddPlaceScreen` — keyboard bug fixed (FlatList → ScrollView in step 2); cuisine now required with dropdown of existing cuisines
- `ActivityScreen` — edit buttons on each item, navigates to EditVisit/EditPlace
- `EditVisitScreen` — new screen: edit tier, occasion, notes via PATCH /api/visits/<id>/mobile
- `EditPlaceScreen` — new screen: edit tier, category, cuisine via PATCH /api/places/user-place/<id>/mobile
- `HomeScreen` — activity icon in header navigates to ActivityScreen
- `LogVisitScreen` — photo picker section (max 5), deferred upload after visit save
- `EditVisitScreen` — photo section: loads existing photos from GET /api/photos, immediate upload/delete
- `ActivityScreen` — now passes `placeId` to EditVisit for photo uploads
- `api/client.js` — added `api.upload()` for multipart form data
- `SettingsScreen.js` — fixed `getExpoPushTokenAsync()` to pass `{ projectId }` from `Constants.expoConfig.extra.eas.projectId` (SDK 55 requirement); gracefully falls back to `{}` if projectId not set
- `app.json` — added `extra.eas.projectId` field (currently empty — fill in from expo.dev or `eas project:init` to enable push tokens in production builds)
- `App.js` — imports `expo-notifications`; `navigationRef` wired to NavigationContainer; `addNotificationResponseReceivedListener` navigates to LogVisit on `visit_reminder` tap (warm start); `getLastNotificationResponseAsync` in `onReady` handles cold start
