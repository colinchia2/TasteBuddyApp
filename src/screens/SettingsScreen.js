import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Switch, ActivityIndicator,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';

export default function SettingsScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(user?.push_notifications_enabled || false);
  const [profilePublic, setProfilePublic] = useState(user?.profile_public || false);
  const [savingPublic, setSavingPublic] = useState(false);

  async function togglePush(val) {
    setPushEnabled(val);
    if (val) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Enable notifications in Settings.');
          setPushEnabled(false);
          return;
        }
        const token = await Notifications.getExpoPushTokenAsync();
        await api.json('/api/auth/push-token', {
          method: 'PATCH',
          body: JSON.stringify({ expo_push_token: token.data }),
        });
        await refreshUser();
      } catch (e) {
        Alert.alert('Error', e.message);
        setPushEnabled(false);
      }
    }
  }

  async function toggleProfilePublic(val) {
    setProfilePublic(val);
    setSavingPublic(true);
    try {
      await api.json('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ profile_public: val }),
      });
      await refreshUser();
    } catch (e) {
      Alert.alert('Error', e.message);
      setProfilePublic(!val);
    } finally {
      setSavingPublic(false);
    }
  }

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Profile & Settings" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Tastie Score hero card */}
        <View style={styles.scoreHero}>
          <Text style={styles.scoreName}>{user?.display_name}</Text>
          <Text style={styles.scoreNumber}>{user?.tastie_score || 0}</Text>
          <Text style={styles.scoreLabel}>Tastie Score</Text>
          <View style={styles.scoreLevelPill}>
            <Text style={styles.scoreLevelText}>{user?.tastie_level || 'Picky Eater'}</Text>
          </View>
        </View>

        {/* Account */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Row label="Email" value={user?.email} />
          <Row label="City" value={user?.city || '—'} />
          <Row label="Plan" value={user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : '—'} />
        </View>

        {/* Profile */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tastie Profile</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Public profile</Text>
              <Text style={styles.switchSub}>Let others see your rankings & taste profile</Text>
            </View>
            {savingPublic
              ? <ActivityIndicator size="small" color={COLORS.gold} />
              : (
                <Switch
                  value={profilePublic}
                  onValueChange={toggleProfilePublic}
                  trackColor={{ true: COLORS.gold, false: COLORS.border }}
                  thumbColor="#fff"
                />
              )
            }
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notifications</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Push notifications</Text>
              <Text style={styles.switchSub}>Visit reminders after check-ins</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={togglePush}
              trackColor={{ true: COLORS.gold, false: COLORS.border }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderColor: COLORS.borderLight },
  label: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
  value: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.text, maxWidth: '60%', textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  scoreHero: {
    backgroundColor: COLORS.gold, margin: 16, borderRadius: 20,
    padding: 24, alignItems: 'center',
  },
  scoreName: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  scoreNumber: { fontFamily: 'Outfit_800ExtraBold', fontSize: 64, color: '#fff', lineHeight: 72 },
  scoreLabel: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scoreLevelPill: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  scoreLevelText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#fff' },
  card: {
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 16,
  },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  switchLabel: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  switchSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  logoutBtn: {
    marginHorizontal: 16, marginBottom: 40, borderRadius: 24,
    borderWidth: 1.5, borderColor: COLORS.danger, paddingVertical: 14, alignItems: 'center',
  },
  logoutText: { fontFamily: 'Outfit_700Bold', color: COLORS.danger, fontSize: 15 },
});
