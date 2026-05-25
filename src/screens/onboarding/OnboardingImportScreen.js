import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

export default function OnboardingImportScreen({ navigation, route }) {
  const city = route.params?.city || '';

  const [phase, setPhase] = useState('idle'); // idle | scanning | results | no_access | importing | done
  const [sessionId, setSessionId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [importedCount, setImportedCount] = useState(0);

  async function startScan() {
    setPhase('scanning');
    try {
      const data = await api.json('/api/import/scan', {
        method: 'POST',
        body: JSON.stringify({ is_onboarding: true }),
      });
      setSessionId(data.session_id);

      if (!data.total_found || data.total_found === 0) {
        setPhase('no_access');
        return;
      }

      const cData = await api.json(`/api/import/candidates/${data.session_id}`);
      const importable = (cData.candidates || []).filter(c => c.status === 'selected');
      setCandidates(importable);
      setPhase('results');
    } catch (e) {
      Alert.alert('Error', e.message);
      setPhase('idle');
    }
  }

  async function handleImport() {
    setPhase('importing');
    try {
      const result = await api.json(`/api/import/candidates/${sessionId}/confirm`, { method: 'POST' });
      setImportedCount(result.imported || 0);
      setPhase('done');
    } catch (e) {
      Alert.alert('Error', e.message);
      setPhase('results');
    }
  }

  function handleContinue() {
    navigation.navigate('MoreCategories', { city });
  }

  function handleSkip() {
    navigation.navigate('Dinner', { city });
  }

  // --- IDLE ---
  if (phase === 'idle') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.top}>
            <Text style={styles.badge}>📥</Text>
            <Text style={styles.heading}>Import your restaurant history</Text>
            <Text style={styles.body}>
              We can scan your Gmail and Google Calendar for past reservations — Resy, OpenTable, Google Calendar events, and more.
            </Text>
            <Text style={styles.body}>
              This usually finds 20–50 places and saves you from adding them one by one.
            </Text>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.primaryBtn} onPress={startScan}>
              <Text style={styles.primaryBtnText}>Scan my Google account</Text>
              <Text style={styles.primaryBtnSub}>Gmail & Calendar · Usually takes 30–60s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSkip}>
              <Text style={styles.secondaryBtnText}>Skip — I'll add places manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- SCANNING ---
  if (phase === 'scanning') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.scanningTitle}>Scanning your account…</Text>
          <Text style={styles.scanningBody}>
            Checking Gmail reservations and Calendar events. This takes about 30–60 seconds.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- NO ACCESS ---
  if (phase === 'no_access') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.top}>
            <Text style={styles.badge}>🔒</Text>
            <Text style={styles.heading}>No reservation history found</Text>
            <Text style={styles.body}>
              Your Google account may not have Gmail or Calendar access enabled, or you may not have any reservation emails.
            </Text>
            <Text style={styles.body}>
              You can connect your Google account on the TasteBuddy website later under Settings → Import.
            </Text>
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSkip}>
              <Text style={styles.primaryBtnText}>Continue — I'll add places manually →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- RESULTS ---
  if (phase === 'results') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.resultsHeader}>
            <Text style={styles.heading}>Found {candidates.length} restaurants</Text>
            <Text style={styles.resultsBody}>
              These are places you've visited based on your reservation history.
            </Text>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {candidates.map(c => (
              <View key={c.id} style={styles.candidateRow}>
                <View style={styles.candidateInfo}>
                  <Text style={styles.candidateName} numberOfLines={1}>{c.place_name}</Text>
                  {c.address ? (
                    <Text style={styles.candidateAddr} numberOfLines={1}>{c.address}</Text>
                  ) : null}
                </View>
                {c.ai_tier ? (
                  <View style={[styles.tierBadge, { backgroundColor: COLORS.goldLight }]}>
                    <Text style={styles.tierBadgeText}>{c.ai_tier}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleImport}>
              <Text style={styles.primaryBtnText}>Import {candidates.length} restaurants →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSkip}>
              <Text style={styles.secondaryBtnText}>Skip — start fresh instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- IMPORTING ---
  if (phase === 'importing') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.scanningTitle}>Importing…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- DONE ---
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.badge}>✅</Text>
          <Text style={styles.heading}>{importedCount} restaurants imported!</Text>
          <Text style={styles.body}>
            They've been added to your TBE list. You can rank them anytime from your TasteBoard.
          </Text>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: {
    flex: 1, paddingHorizontal: 28, justifyContent: 'space-between',
    paddingTop: 48, paddingBottom: 40,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  top: { flex: 1, justifyContent: 'center' },
  badge: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  heading: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: COLORS.text,
    textAlign: 'center', marginBottom: 16,
  },
  body: {
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: 12,
  },
  scanningTitle: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: COLORS.text,
    marginTop: 20, marginBottom: 10, textAlign: 'center',
  },
  scanningBody: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 20,
  },
  resultsHeader: { paddingBottom: 12 },
  resultsBody: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginTop: 4,
  },
  scroll: { flex: 1 },
  candidateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  candidateInfo: { flex: 1, marginRight: 10 },
  candidateName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  candidateAddr: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  tierBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tierBadgeText: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: '#633806' },
  footer: { gap: 10 },
  buttons: { gap: 10 },
  primaryBtn: {
    backgroundColor: COLORS.gold, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center',
  },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff', marginBottom: 2 },
  primaryBtnSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  secondaryBtn: {
    borderRadius: 16, paddingVertical: 15, alignItems: 'center',
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  secondaryBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.textMuted },
});
