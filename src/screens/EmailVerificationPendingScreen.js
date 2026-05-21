import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { BASE_URL } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/colors';

export default function EmailVerificationPendingScreen() {
  const { user, refreshUser, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(pollVerified, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  async function pollVerified() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${BASE_URL}/api/auth/check-verified`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.verified) {
        clearInterval(intervalRef.current);
        await refreshUser();
      }
    } catch {
      // network error — keep polling
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await fetch(`${BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      // ignore
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>TasteBuddy</Text>

      <View style={styles.iconWrap}>
        <Text style={styles.icon}>✉</Text>
      </View>

      <Text style={styles.title}>Check your inbox</Text>
      <Text style={styles.body}>
        We sent a verification email to{'\n'}
        <Text style={styles.email}>{user?.email}</Text>
        {'\n\n'}
        Tap the link in the email to activate your account. This screen will update automatically.
      </Text>

      <ActivityIndicator color={COLORS.gold} style={{ marginTop: 24 }} />

      {resent ? (
        <Text style={styles.resentText}>Email resent! Check your inbox.</Text>
      ) : (
        <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendBtn}>
          {resending
            ? <ActivityIndicator size="small" color={COLORS.gold} />
            : <Text style={styles.resendText}>Resend email</Text>
          }
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Use a different email</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 36,
  },
  logo: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 22,
    color: COLORS.gold, marginBottom: 32,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FAEEDA', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  icon: { fontSize: 32 },
  title: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 24,
    color: COLORS.text, marginBottom: 14, textAlign: 'center',
  },
  body: {
    fontFamily: 'DMSans_400Regular', fontSize: 15,
    color: COLORS.textMuted, lineHeight: 22, textAlign: 'center',
  },
  email: {
    fontFamily: 'DMSans_700Bold', color: COLORS.text,
  },
  resendBtn: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 16 },
  resendText: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.gold,
  },
  resentText: {
    fontFamily: 'DMSans_400Regular', fontSize: 14,
    color: '#27500A', marginTop: 20,
  },
  logoutBtn: { marginTop: 12, paddingVertical: 8 },
  logoutText: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted,
  },
});
