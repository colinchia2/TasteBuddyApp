import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '918439480148-r36km6tsj5qub0fkhe1i9j8gftod5qms.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '918439480148-skp68m8e98idt494ejr1h1bf14q6mh7k.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) handleGoogleToken(token);
    } else if (response?.type === 'error') {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  }, [response]);

  async function handleGoogleToken(token) {
    setGoogleLoading(true);
    setError(null);
    try {
      await loginWithGoogle(token);
    } catch (e) {
      setError(e.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.offWhite }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your TasteBuddy account.</Text>

        {/* Google */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={async () => { setError(null); setGoogleLoading(true); await promptAsync(); }}
          disabled={!request || googleLoading || loading}
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

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign in with email</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />
        <TextInput
          style={[styles.input, { marginBottom: 0 }]}
          placeholder="Password"
          placeholderTextColor={COLORS.textLight}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          returnKeyType="done"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading || googleLoading} activeOpacity={0.82}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Sign in</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('SignUp')}
          style={styles.signUpLink}
        >
          <Text style={styles.signUpText}>
            Don't have an account? <Text style={{ color: COLORS.gold, fontFamily: 'DMSans_700Bold' }}>Create one</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40 },
  backRow: { marginBottom: 32 },
  backText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.gold },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: COLORS.text, marginBottom: 6 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, marginBottom: 28 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 15,
    borderWidth: 1, borderColor: COLORS.border, gap: 10, marginBottom: 4,
  },
  googleIcon: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: '#4285F4' },
  googleBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: COLORS.border },
  dividerText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight },
  input: {
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, marginBottom: 12,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#E24B4A',
    marginTop: 8, marginBottom: 4,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  btnText: { fontFamily: 'DMSans_700Bold', color: '#fff', fontSize: 15 },
  signUpLink: { marginTop: 20, alignItems: 'center' },
  signUpText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
});
