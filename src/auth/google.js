import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Native Google Sign-In (Option A). Replaces the dead expo-auth-session
// auth.expo.io proxy flow, which never worked in standalone/TestFlight builds.
//
// We deliberately send Google's *access token* (not the idToken) to the backend
// so /api/auth/google stays UNCHANGED — it verifies via Google's
// userinfo?access_token= endpoint. webClientId is still supplied so the SDK can
// also mint an idToken if we ever switch the backend to idToken verification.
const GOOGLE_WEB_CLIENT_ID =
  '918439480148-r36km6tsj5qub0fkhe1i9j8gftod5qms.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID =
  '918439480148-skp68m8e98idt494ejr1h1bf14q6mh7k.apps.googleusercontent.com';

let configured = false;

export function configureGoogleSignin() {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
  configured = true;
}

// Opens the native Google sheet and resolves to a Google ACCESS token to POST
// to /api/auth/google. Throws on failure; cancellation surfaces as
// statusCodes.SIGN_IN_CANCELLED so callers can stay silent.
export async function signInWithGoogleAccessToken() {
  configureGoogleSignin();
  await GoogleSignin.hasPlayServices(); // no-op on iOS
  await GoogleSignin.signIn();
  const { accessToken } = await GoogleSignin.getTokens();
  if (!accessToken) throw new Error('Google did not return an access token.');
  return accessToken;
}

// Read-only Google Calendar scope for onboarding import. Requested at RUNTIME via
// incremental consent (addScopes) — NOT in app.json. It's a network OAuth scope,
// so no iOS EventKit/Info.plist permission is involved. The GCP project (number
// 918439480148, shared by the iOS + web client IDs above) already authorizes this
// scope for the web import flow, so the consent sheet grants it.
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

// True when a Google account is already linked on this device (the user signed in
// with Google at login). False for email/password users — they must connect Google
// before we can request the calendar scope (branch 3 in the import flow).
export function hasGoogleAccount() {
  configureGoogleSignin();
  try {
    return !!GoogleSignin.getCurrentUser();
  } catch {
    return false;
  }
}

// Ensure the user is Google-signed-in AND has granted calendar.readonly, then
// return a fresh access token that carries the scope — to send ONCE in the
// /api/import/scan body (never persisted). Branches:
//   1. Google-linked + scope already granted → getTokens() (addScopes is a no-op).
//   2. Google-linked, no scope → addScopes() shows the incremental-consent sheet.
//   3. Email/password (no Google) → signIn() first, then addScopes().
// Cancellation surfaces as statusCodes.SIGN_IN_CANCELLED; other failures throw so
// the screen can show a clean retry (the backend 401 {reauth:true} path).
export async function getCalendarAccessToken() {
  configureGoogleSignin();
  await GoogleSignin.hasPlayServices(); // no-op on iOS

  if (!GoogleSignin.getCurrentUser()) {
    await GoogleSignin.signIn();            // branch 3: connect Google first
  }

  // Incremental consent. Returns the updated user when new scopes are granted, or
  // null when they were already granted — either way getTokens() below carries them.
  try {
    await GoogleSignin.addScopes({ scopes: [CALENDAR_SCOPE] });
  } catch (e) {
    if (e?.code === statusCodes.SIGN_IN_CANCELLED) throw e;
    // Some SDK paths resolve "already granted" as a throw; fall through and let
    // getTokens() be the source of truth (it 401s server-side if the scope is missing).
  }

  const { accessToken } = await GoogleSignin.getTokens();
  if (!accessToken) throw new Error('Google did not return an access token.');
  return accessToken;
}

export { statusCodes };
