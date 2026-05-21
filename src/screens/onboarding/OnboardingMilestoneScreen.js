import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PARTICLE_COUNT = 28;
const COLORS_CONF = ['#C8960C', '#EAF3DE', '#FAEEDA', '#E6F1FB', '#FEFCE8', '#27500A', '#0C447C'];

function Confetti() {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20 - Math.random() * 80),
      rot: new Animated.Value(0),
      color: COLORS_CONF[i % COLORS_CONF.length],
      size: 6 + Math.random() * 6,
    }))
  ).current;

  useEffect(() => {
    particles.forEach((p, i) => {
      const duration = 1800 + Math.random() * 1000;
      const delay = i * 60;
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: 700,
          duration,
          delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(p.rot, {
          toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration,
          delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            transform: [
              { translateY: p.y },
              { rotate: p.rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function OnboardingMilestoneScreen({ navigation, route }) {
  const tierCounts = route.params?.tierCounts || {};
  const city = route.params?.city || '';
  const total = Object.values(tierCounts).reduce((a, b) => a + b, 0);

  const tierSummaryParts = [
    tierCounts.S > 0 ? `${tierCounts.S} S-tier` : null,
    tierCounts.A > 0 ? `${tierCounts.A} A-tier` : null,
    tierCounts.B > 0 ? `${tierCounts.B} B-tier` : null,
    tierCounts.C > 0 ? `${tierCounts.C} C-tier` : null,
    tierCounts.TBE > 0 ? `${tierCounts.TBE} TBE` : null,
  ].filter(Boolean);

  async function handleAddMore() {
    try {
      await api.json('/api/onboarding/profile', {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_step: 7 }),
      });
    } catch {}
    navigation.navigate('MoreCategories', { city });
  }

  async function handleSkip() {
    try {
      await api.json('/api/onboarding/profile', {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_step: 8 }),
      });
    } catch {}
    navigation.navigate('AskAI', { city });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Confetti />
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.heading}>You're on a roll!</Text>
          <Text style={styles.subheading}>
            You ranked {total} place{total !== 1 ? 's' : ''}:
          </Text>
          <Text style={styles.tierSummary}>
            {tierSummaryParts.join(' · ')}
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            <Text style={styles.tipBold}>Tip: </Text>
            On the app — just check in when you arrive. Put your phone down. We'll remind you to rank it later.
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAddMore}>
            <Text style={styles.primaryBtnText}>Add more categories</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSkip}>
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
    paddingTop: 60, paddingBottom: 40,
  },
  top: { alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: 16 },
  heading: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 30, color: COLORS.text,
    textAlign: 'center', marginBottom: 10,
  },
  subheading: {
    fontFamily: 'DMSans_400Regular', fontSize: 16, color: COLORS.textMuted,
    textAlign: 'center',
  },
  tierSummary: {
    fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text,
    textAlign: 'center', marginTop: 6,
  },
  tipBox: {
    backgroundColor: COLORS.goldLight, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  tipIcon: { fontSize: 18, marginTop: 1 },
  tipText: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#633806',
    lineHeight: 20, flex: 1,
  },
  tipBold: { fontFamily: 'DMSans_700Bold' },
  buttons: { gap: 12 },
  primaryBtn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  secondaryBtn: {
    borderWidth: 1.5, borderColor: COLORS.gold, borderRadius: 28,
    paddingVertical: 15, alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.gold },
});
