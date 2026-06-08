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

export { statusCodes };
