import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';
import { getCalendarAccessToken, statusCodes } from '../../auth/google';

// Onboarding redesign (Part 2) — screens (c) calendar consent + (d) names-only
// "Did you go?" review. Find Place is DEFERRED to keep (Part-1 backend): scan
// makes ZERO Google calls and returns cleaned names only. Reused by the text-list
// flow via a `sessionId` route param (skips the calendar/range/scan steps).
//
// ≥10 gate: after keep, read place_count from /confirm → ≥10 skips manual and goes
// straight to the tile-ranker; <10 drops into the manual Dinner screen with a nudge.

const RANGES = [
  { key: '1w', label: 'Last week', days: 7 },
  { key: '3m', label: '3 months', days: 90 },
  { key: '6m', label: '6 months', days: 183 },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Rule 9 — format a naive 'YYYY-MM-DD' as wall-clock text WITHOUT new Date()
// (Hermes would shift the day across the UTC boundary).
function formatNaiveDate(ymd) {
  if (!ymd || ymd.length < 10) return '';
  const y = ymd.slice(0, 4);
  const m = parseInt(ymd.slice(5, 7), 10);
  const d = parseInt(ymd.slice(8, 10), 10);
  if (!m || !d) return '';
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// Local YYYY-MM-DD for the scan window (no UTC conversion; the backend clamps too).
function ymdDaysAgo(days) {
  const t = new Date();
  t.setDate(t.getDate() - days);
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${mm}-${dd}`;
}
function ymdToday() {
  const t = new Date();
  const mm = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${mm}-${dd}`;
}

export default function OnboardingImportScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const incomingSession = route.params?.sessionId || null;
  const fromText = !!route.params?.fromText;

  // sessionId param (text-list) → jump straight to review.
  const [phase, setPhase] = useState(incomingSession ? 'loading' : 'range'); // range|consent|scanning|loading|review|no_access
  const [range, setRange] = useState('3m');
  const [sessionId, setSessionId] = useState(incomingSession);
  const [cards, setCards] = useState([]);       // {id, place_name, visited_date, kept}
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (incomingSession) loadCandidates(incomingSession);
  }, [incomingSession]);

  const keptCount = cards.filter(c => c.kept).length;

  async function loadCandidates(sid) {
    try {
      const cData = await api.json(`/api/import/candidates/${sid}`);
      const importable = (cData.candidates || [])
        .filter(c => c.status === 'selected')
        .map(c => ({
          id: c.id,
          place_name: c.place_name,
          visited_date: c.visited_date,   // naive 'YYYY-MM-DD' or null
          kept: true,
        }));
      if (importable.length === 0) { setPhase('no_access'); return; }
      setCards(importable);
      setPhase('review');
    } catch (e) {
      Alert.alert('Hmm', e.message || 'Could not load your places.');
      setPhase(incomingSession ? 'no_access' : 'range');
    }
  }

  async function startCalendarScan() {
    setPhase('consent');
    let token;
    try {
      token = await getCalendarAccessToken();   // consent branches 1–3
    } catch (e) {
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) { setPhase('range'); return; }
      Alert.alert('Google sign-in', 'We couldn’t connect your Google Calendar. Please try again.');
      setPhase('range');
      return;
    }

    setPhase('scanning');
    const days = (RANGES.find(r => r.key === range) || RANGES[1]).days;
    try {
      const data = await api.json('/api/import/scan', {
        method: 'POST',
        body: JSON.stringify({
          is_onboarding: true,
          sources: ['gcal'],
          google_access_token: token,
          date_from: ymdDaysAgo(days),
          date_to: ymdToday(),
        }),
      });
      setSessionId(data.session_id);
      if (!data.total_found) { setPhase('no_access'); return; }
      await loadCandidates(data.session_id);
    } catch (e) {
      // Backend returns 401 {reauth:true} when the handed-in token is rejected.
      if (e?.status === 401 && e?.data?.reauth) {
        Alert.alert('Reconnect Google', 'Your Google sign-in expired — let’s try again.',
          [{ text: 'Retry', onPress: startCalendarScan }, { text: 'Cancel', style: 'cancel', onPress: () => setPhase('range') }]);
        return;
      }
      Alert.alert('Scan failed', e.message || 'Please try again.');
      setPhase('range');
    }
  }

  async function dismissCard(id) {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, kept: false } : c)));
    try { await api.json('/api/import/dismiss', { method: 'POST', body: JSON.stringify({ candidate_id: id }) }); }
    catch { /* non-fatal; UI already reflects it */ }
  }
  function restoreCard(id) {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, kept: true } : c)));
  }

  async function finishKeep() {
    if (keptCount === 0) { goToGate(0); return; }
    setBusy(true);
    try {
      // Dismissed cards already called /dismiss; confirm imports the rest (SELECTED).
      const result = await api.json(`/api/import/candidates/${sessionId}/confirm`, { method: 'POST' });
      goToGate(result.place_count != null ? result.place_count : keptCount);
    } catch (e) {
      Alert.alert('Import', e.message || 'Could not add those places.');
      setBusy(false);
    }
  }

  // ≥10 gate (floor, not cap): count includes the unranked imports we just added.
  async function goToGate(placeCount) {
    const target = placeCount >= 10 ? 'TileRanker' : 'Dinner';
    const step = placeCount >= 10 ? 4 : 3;
    try { await api.patch('/api/onboarding/profile', { onboarding_step: step }); } catch { /* best-effort */ }
    if (target === 'Dinner') {
      navigation.navigate('Dinner', { city, fromImport: true, currentCount: placeCount });
    } else {
      navigation.navigate('TileRanker', { city });
    }
  }

  // --- RANGE PICK (calendar only) ---
  if (phase === 'range') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.top}>
            <Text style={styles.badge}>📅</Text>
            <Text style={styles.heading}>Scan your calendar</Text>
            <Text style={styles.body}>
              We’ll look for restaurants you’ve been to. How far back should we look?
            </Text>
            <View style={styles.rangeRow}>
              {RANGES.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
                  onPress={() => setRange(r.key)}
                >
                  <Text style={[styles.rangeChipText, range === r.key && styles.rangeChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.primaryBtn} onPress={startCalendarScan}>
              <Text style={styles.primaryBtnText}>Scan my calendar</Text>
              <Text style={styles.primaryBtnSub}>Read-only · usually 20–50 places</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Dinner', { city })}>
              <Text style={styles.secondaryBtnText}>I’ll add them myself</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- CONSENT / SCANNING / LOADING ---
  if (phase === 'consent' || phase === 'scanning' || phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.scanningTitle}>
            {phase === 'consent' ? 'Connecting Google…' : 'Finding your places…'}
          </Text>
          <Text style={styles.scanningBody}>
            {phase === 'consent'
              ? 'Approve calendar access in the Google sheet.'
              : 'Reading your calendar for restaurants. Takes a few seconds.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- NO ACCESS / EMPTY ---
  if (phase === 'no_access') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.top}>
            <Text style={styles.badge}>🔍</Text>
            <Text style={styles.heading}>Nothing to import yet</Text>
            <Text style={styles.body}>
              {fromText
                ? 'We couldn’t find restaurants in that list — no worries, you can add them by hand.'
                : 'We didn’t find restaurants in that window. You can add a few yourself instead.'}
            </Text>
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Dinner', { city })}>
              <Text style={styles.primaryBtnText}>Add places myself →</Text>
            </TouchableOpacity>
            {!fromText && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('range')}>
                <Text style={styles.secondaryBtnText}>Try a different date range</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- REVIEW (names-only "Did you go?") ---
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.resultsHeader}>
          <Text style={styles.heading}>{keptCount} place{keptCount === 1 ? '' : 's'} found</Text>
          <Text style={styles.resultsBody}>
            Tap any you didn’t actually go to. We’ll add the rest.
          </Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {cards.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.candidateRow, !c.kept && styles.candidateRowDropped]}
              activeOpacity={0.8}
              onPress={() => (c.kept ? dismissCard(c.id) : restoreCard(c.id))}
            >
              <View style={styles.candidateInfo}>
                <Text style={[styles.candidateName, !c.kept && styles.droppedText]} numberOfLines={1}>
                  {c.place_name}
                </Text>
                {c.visited_date ? (
                  <Text style={styles.candidateAddr}>{formatNaiveDate(c.visited_date)}</Text>
                ) : null}
              </View>
              <Text style={[styles.keepMark, !c.kept && styles.dropMark]}>{c.kept ? '✓' : '＋'}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={finishKeep} disabled={busy}>
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Add {keptCount} place{keptCount === 1 ? '' : 's'} →</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  top: { flex: 1, justifyContent: 'center' },
  badge: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  heading: { fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: COLORS.text, textAlign: 'center', marginBottom: 12 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  rangeRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  rangeChip: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  rangeChipActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldLight },
  rangeChipText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.textMuted },
  rangeChipTextActive: { color: COLORS.tierSText, fontFamily: 'DMSans_700Bold' },
  scanningTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 20, color: COLORS.text, marginTop: 20, marginBottom: 10, textAlign: 'center' },
  scanningBody: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  resultsHeader: { paddingBottom: 14 },
  resultsBody: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  scroll: { flex: 1 },
  candidateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
  },
  candidateRowDropped: { backgroundColor: COLORS.borderLight, borderColor: COLORS.borderLight },
  candidateInfo: { flex: 1, marginRight: 10 },
  candidateName: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  droppedText: { color: COLORS.textLight, textDecorationLine: 'line-through' },
  candidateAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  keepMark: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: COLORS.tierAText, width: 26, textAlign: 'center' },
  dropMark: { color: COLORS.textLight },
  footer: { paddingTop: 6 },
  buttons: { gap: 10 },
  primaryBtn: { backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff', marginBottom: 2 },
  primaryBtnSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  secondaryBtn: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  secondaryBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.textMuted },
});
