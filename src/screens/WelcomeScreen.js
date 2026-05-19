import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';

function TBLogo({ size = 80 }) {
  const r = size / 2;
  const eye = size * 0.08;
  return (
    <View style={{
      width: size, height: size, borderRadius: r,
      backgroundColor: '#FFD93D', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#C8960C', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    }}>
      {/* Eyes */}
      <View style={{ flexDirection: 'row', gap: size * 0.2, marginBottom: size * 0.06 }}>
        <View style={{ width: eye, height: eye, borderRadius: eye / 2, backgroundColor: '#5D4E37' }} />
        <View style={{ width: eye, height: eye, borderRadius: eye / 2, backgroundColor: '#5D4E37' }} />
      </View>
      {/* Smile arc via border */}
      <View style={{
        width: size * 0.42, height: size * 0.21,
        borderBottomWidth: size * 0.04, borderBottomColor: '#5D4E37',
        borderLeftWidth: 0, borderRightWidth: 0,
        borderBottomLeftRadius: size * 0.21, borderBottomRightRadius: size * 0.21,
      }} />
    </View>
  );
}
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '918439480148-r36km6tsj5qub0fkhe1i9j8gftod5qms.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '918439480148-skp68m8e98idt494ejr1h1bf14q6mh7k.apps.googleusercontent.com';

export default function WelcomeScreen({ navigation }) {
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) handleGoogleToken(token);
    } else if (response?.type === 'error') {
      setGoogleError('Google sign-in was cancelled or failed.');
      setGoogleLoading(false);
    }
  }, [response]);

  async function handleGoogleToken(token) {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      await loginWithGoogle(token);
      // AuthContext updates user → navigator switches automatically
    } catch (e) {
      setGoogleError(e.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function startGoogle() {
    setGoogleError(null);
    setGoogleLoading(true);
    await promptAsync();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>

        {/* Logo */}
        <TBLogo size={80} />
        <Text style={styles.title}>TasteBuddy</Text>
        <Text style={styles.tagline}>Your personal food intelligence layer</Text>

        <View style={styles.buttonGroup}>
          {/* Google */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={startGoogle}
            disabled={!request || googleLoading}
            activeOpacity={0.82}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {googleError ? (
            <Text style={styles.errorText}>{googleError}</Text>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email sign-up */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryBtnText}>Create an account</Text>
          </TouchableOpacity>

          {/* Email log-in */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.82}
          >
            <Text style={styles.secondaryBtnText}>Log in with email</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legalText}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  inner: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  title: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 34, color: COLORS.text,
    marginBottom: 8, letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted,
    textAlign: 'center', marginBottom: 48, lineHeight: 22,
  },
  buttonGroup: { width: '100%', gap: 12 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 15,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  googleIcon: {
    fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#4285F4',
  },
  googleBtnText: {
    fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: COLORS.border },
  dividerText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textLight,
  },
  primaryBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'DMSans_700Bold', fontSize: 15, color: '#fff',
  },
  secondaryBtn: {
    backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  secondaryBtnText: {
    fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#E24B4A',
    textAlign: 'center',
  },
  legalText: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textLight,
    textAlign: 'center', marginTop: 40, lineHeight: 16,
  },
});
