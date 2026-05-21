import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '918439480148-r36km6tsj5qub0fkhe1i9j8gftod5qms.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '918439480148-skp68m8e98idt494ejr1h1bf14q6mh7k.apps.googleusercontent.com';

export default function SignUpScreen({ navigation }) {
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'tastebuddy', preferLocalhost: true });
  console.log('[SignUpScreen] Google OAuth redirectUri:', redirectUri);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) handleGoogleToken(token);
    } else if (response?.type === 'error') {
      setError('Google sign-in was cancelled or failed.');
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

  async function handleSignUp() {
    setError(null);
    if (!name.trim() || name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setError('Password must include at least one special character.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
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

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.sub}>Start building your personal food list.</Text>

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
          <Text style={styles.dividerText}>or sign up with email</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex Smith"
            placeholderTextColor={COLORS.textLight}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="8+ characters, include a symbol"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
              <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Same password again"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={setConfirm}
              onSubmitEditing={handleSignUp}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
              <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.btn}
            onPress={handleSignUp}
            disabled={loading || googleLoading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create account</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={{ color: COLORS.gold, fontFamily: 'DMSans_700Bold' }}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>
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
  form: { gap: 4 },
  label: {
    fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text,
  },
  passwordWrapper: { position: 'relative' },
  passwordInput: { paddingRight: 60 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.gold },
  errorText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#E24B4A',
    marginTop: 12, lineHeight: 18,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  btnText: { fontFamily: 'DMSans_700Bold', color: '#fff', fontSize: 15 },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
});
