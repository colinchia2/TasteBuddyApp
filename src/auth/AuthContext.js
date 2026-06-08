import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { BASE_URL } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootCheck();
  }, []);

  // Send the device's IANA timezone so the stored zone stays accurate (heals
  // legacy NULLs; device-wins). The endpoint no-ops when unchanged.
  async function _captureTimezone(token) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz || !token) return;
      await fetch(`${BASE_URL}/api/user/timezone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ timezone: tz }),
      });
    } catch {}
  }

  // Backfill the Expo push token for already-onboarded users (FIX 1). The token was
  // only ever registered at onboarding / the Settings toggle — users who onboarded
  // in Expo Go got a NULL token and there was no backfill, so push silently skipped
  // them forever. Runs once per launch (bootCheck) and per login — NOT per render.
  // Only acts when OS permission is already granted (prompts ONLY if undetermined,
  // never nags a user who denied), and only PATCHes when the token actually changed.
  async function _registerPushToken(token) {
    try {
      if (!token) return;
      let status = (await Notifications.getPermissionsAsync()).status;
      if (status === 'undetermined') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted') return;            // denied → skip (no nag)
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : {});
      const expoToken = tokenData?.data;
      if (!expoToken) return;
      const lastSynced = await AsyncStorage.getItem('synced_push_token');
      if (lastSynced === expoToken) return;        // unchanged → no needless write
      const res = await fetch(`${BASE_URL}/api/auth/push-token`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expo_push_token: expoToken }),
      });
      if (res.ok) await AsyncStorage.setItem('synced_push_token', expoToken);
    } catch {
      // Expo Go / no projectId / network — fail gracefully, never crash boot.
    }
  }

  async function bootCheck() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUser(await res.json());
        _captureTimezone(token);
        _registerPushToken(token);
      } else {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      }
    } catch {
      // network error — stay logged out
    } finally {
      setLoading(false);
    }
  }

  async function _saveTokensAndLoadUser(data) {
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const meBody = await meRes.json();
    if (meRes.ok) {
      setUser(meBody);
      _captureTimezone(data.access_token);
      _registerPushToken(data.access_token);
    } else {
      throw new Error('Could not load user after authentication');
    }
  }

  async function login(email, password) {
    const res = await fetch(`${BASE_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    await _saveTokensAndLoadUser(data);
  }

  async function register(displayName, email, password) {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    await _saveTokensAndLoadUser(data);
  }

  async function loginWithGoogle(googleAccessToken) {
    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: googleAccessToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
    await _saveTokensAndLoadUser(data);
  }

  async function logout() {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
    setUser(null);
  }

  async function refreshUser() {
    await bootCheck();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
