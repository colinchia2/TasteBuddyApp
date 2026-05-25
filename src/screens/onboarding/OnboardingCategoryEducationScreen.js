import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';

function ExampleRow({ emoji, label }) {
  return (
    <View style={styles.exRow}>
      <Text style={styles.exEmoji}>{emoji}</Text>
      <Text style={styles.exLabel}>{label}</Text>
    </View>
  );
}

export default function OnboardingCategoryEducationScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const tierCounts = route.params?.tierCounts || {};
  const total = Object.values(tierCounts).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.badge}>🏆</Text>
          <Text style={styles.heading}>Your Dinner tier list is set!</Text>
          <Text style={styles.sub}>
            {total} place{total !== 1 ? 's' : ''} ranked. TasteBuddy's recommendations already know your taste.
          </Text>
        </View>

        <View style={styles.educationBox}>
          <Text style={styles.educationHeading}>TasteBuddy works across all the ways you eat</Text>
          <ExampleRow emoji="☕" label="Morning coffee & brunch runs" />
          <ExampleRow emoji="🍸" label="Cocktail bars with friends" />
          <ExampleRow emoji="🌮" label="Late-night taco spots" />
          <ExampleRow emoji="🥗" label="Cheap weekday lunch haunts" />
        </View>

        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            Each category gets its own tier list. The more you add, the smarter your AI recommendations get.
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('MoreCategories', { city })}
          >
            <Text style={styles.primaryBtnText}>Add more categories</Text>
            <Text style={styles.primaryBtnSub}>Brunch, bars, coffee & more</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('AskAI', { city })}
          >
            <Text style={styles.secondaryBtnText}>Skip — take me to Ask AI →</Text>
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
  top: { alignItems: 'center' },
  badge: { fontSize: 48, marginBottom: 14 },
  heading: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: COLORS.text,
    textAlign: 'center', marginBottom: 10,
  },
  sub: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 20,
  },
  educationBox: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 18,
  },
  educationHeading: {
    fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.text,
    marginBottom: 14,
  },
  exRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exEmoji: { fontSize: 20, width: 32 },
  exLabel: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, flex: 1 },
  callout: {
    backgroundColor: COLORS.goldLight, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  calloutText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#633806',
    lineHeight: 19, textAlign: 'center',
  },
  buttons: { gap: 10 },
  primaryBtn: {
    backgroundColor: COLORS.gold, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center',
  },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff', marginBottom: 3 },
  primaryBtnSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  secondaryBtn: {
    borderRadius: 16, paddingVertical: 15, alignItems: 'center',
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  secondaryBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 15, color: COLORS.textMuted },
});
