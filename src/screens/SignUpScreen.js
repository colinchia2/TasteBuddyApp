import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../constants/colors';

export default function SignUpScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      // AuthContext updates user → navigator switches automatically
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
          <TextInput
            style={styles.input}
            placeholder="8+ characters, include a symbol"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="next"
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            placeholder="Same password again"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={handleSignUp}
            returnKeyType="done"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.btn}
            onPress={handleSignUp}
            disabled={loading}
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
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, marginBottom: 32 },
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
