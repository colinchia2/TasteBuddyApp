import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import TBLogo from '../components/TBLogo';
import { useAuth } from '../auth/AuthContext';
import { signInWithGoogleAccessToken, statusCodes } from '../auth/google';
import { COLORS } from '../constants/colors';

export default function WelcomeScreen({ navigation }) {
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);

  async function startGoogle() {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const accessToken = await signInWithGoogleAccessToken();
      await loginWithGoogle(accessToken);
      // AuthContext updates user → navigator switches automatically
    } catch (e) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        setGoogleError(e.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
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
            disabled={googleLoading}
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
