import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';

// Onboarding redesign (Part 2) — screen (b). "How do you want to add your places?"
// The default path for every new user. Calendar + Paste are active; Maps is a
// disabled "coming soon". A quiet skip drops to the manual suggest-and-type screen.
// This screen IS onboarding_step 2, so a mid-import bail resumes right back here.
export default function OnboardingImportChooserScreen({ navigation, route }) {
  const city = route.params?.city || '';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>LET’S FILL YOUR LIST</Text>
        <Text style={styles.title}>How do you want to add your places?</Text>
        <Text style={styles.subtitle}>
          Pull in spots you’ve already been — then you’ll rank them in a few taps.
        </Text>

        <Card
          emoji="📅"
          title="Sync your Calendar"
          body="We’ll scan your Google Calendar for restaurants you’ve been to. Usually finds 20–50."
          accent
          onPress={() => navigation.navigate('Import', { method: 'calendar', city })}
        />

        <Card
          emoji="📝"
          title="Paste a list"
          body="Already keep a list in Notes? Paste it and we’ll sort out the restaurants."
          onPress={() => navigation.navigate('TextList', { city })}
        />

        <Card
          emoji="🗺️"
          title="Google Maps list"
          body="Import a saved Maps list."
          comingSoon
        />

        <TouchableOpacity
          style={styles.skip}
          onPress={() => navigation.navigate('Dinner', { city })}
        >
          <Text style={styles.skipText}>I’ll add them myself →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ emoji, title, body, onPress, accent, comingSoon }) {
  return (
    <TouchableOpacity
      style={[styles.card, accent && styles.cardAccent, comingSoon && styles.cardDisabled]}
      onPress={onPress}
      disabled={comingSoon}
      activeOpacity={0.85}
    >
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          {comingSoon && <Text style={styles.soonPill}>Coming soon</Text>}
        </View>
        <Text style={styles.cardText}>{body}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { padding: 24, paddingTop: 32 },
  kicker: {
    fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.gold,
    letterSpacing: 1, marginBottom: 8,
  },
  title: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: COLORS.text,
    marginBottom: 8, lineHeight: 32,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted,
    marginBottom: 24, lineHeight: 21,
  },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 18, marginBottom: 14,
  },
  cardAccent: { borderColor: COLORS.gold, borderWidth: 1.5 },
  cardDisabled: { opacity: 0.55 },
  cardEmoji: { fontSize: 28, marginRight: 14, marginTop: 2 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text },
  soonPill: {
    fontFamily: 'DMSans_700Bold', fontSize: 10, color: COLORS.textMuted,
    backgroundColor: COLORS.borderLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, marginLeft: 8, overflow: 'hidden',
  },
  cardText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13.5, color: COLORS.textMuted,
    lineHeight: 19,
  },
  skip: { alignItems: 'center', paddingVertical: 18, marginTop: 4 },
  skipText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.textMuted },
});
