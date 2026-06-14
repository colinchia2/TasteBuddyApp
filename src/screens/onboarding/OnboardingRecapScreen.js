import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

// Onboarding redesign (Part 2) — screen (h). PURE celebration + value. The last
// beat before the paywall: send the user off excited. No data chores here (cuisine
// confirm is its own conditional step before this). Reads the place count
// best-effort for a personalized line.
const VALUE_POINTS = [
  { emoji: '🍝', title: 'Get a rec', body: 'Ask TasteBuddy AI where to eat — grounded in your own list.' },
  { emoji: '📍', title: 'Log a visit', body: 'Check in as you go and we’ll remember the details for you.' },
  { emoji: '🏆', title: 'See your Tastie Score', body: 'Rank more places and watch your taste profile come to life.' },
];

export default function OnboardingRecapScreen({ navigation, route }) {
  const city = route?.params?.city || '';
  const [count, setCount] = useState(null);

  async function goToAskAI() {
    try { await api.patch('/api/onboarding/profile', { onboarding_step: 9 }); } catch { /* best-effort */ }
    navigation.navigate('AskAI', { city });
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await api.json('/api/places/categories-summary');
        const sum = (arr) => (arr || []).reduce((n, c) => n + (c.total || 0), 0);
        const total = sum(data.primary) + sum(data.user_added) + ((data.other && data.other.total) || 0);
        setCount(total);
      } catch { /* show the generic headline */ }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.spark}>🎉</Text>
          <Text style={styles.headline}>
            {count != null && count > 0
              ? `You’ve got ${count} place${count === 1 ? '' : 's'} ranked.`
              : 'Your TasteBoard is ready.'}
          </Text>
          <Text style={styles.sub}>Here’s what you can do now:</Text>

          <View style={styles.points}>
            {VALUE_POINTS.map(p => (
              <View key={p.title} style={styles.point}>
                <Text style={styles.pointEmoji}>{p.emoji}</Text>
                <View style={styles.pointBody}>
                  <Text style={styles.pointTitle}>{p.title}</Text>
                  <Text style={styles.pointText}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.btn} onPress={goToAskAI}>
          <Text style={styles.btnText}>Let’s go →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 40, paddingBottom: 36, justifyContent: 'space-between' },
  top: { flex: 1, justifyContent: 'center' },
  spark: { fontSize: 52, textAlign: 'center', marginBottom: 16 },
  headline: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: COLORS.text, textAlign: 'center', lineHeight: 34, marginBottom: 8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted, textAlign: 'center', marginBottom: 28 },
  points: { gap: 16 },
  point: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  pointEmoji: { fontSize: 24, marginRight: 14, marginTop: 2 },
  pointBody: { flex: 1 },
  pointTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: COLORS.text, marginBottom: 3 },
  pointText: { fontFamily: 'DMSans_400Regular', fontSize: 13.5, color: COLORS.textMuted, lineHeight: 19 },
  btn: { backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
