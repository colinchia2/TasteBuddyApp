import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

function FeatureRow({ check, text, muted }) {
  return (
    <View style={styles.featureRow}>
      <Text style={[styles.featureCheck, muted && styles.featureCheckMuted]}>{check ? '✓' : '—'}</Text>
      <Text style={[styles.featureText, muted && styles.featureTextMuted]}>{text}</Text>
    </View>
  );
}

export default function OnboardingPaywallScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const { refreshUser } = useAuth();
  const [finishing, setFinishing] = useState(false);

  async function complete() {
    // /complete 409s while any place is still UNRANKED (ranked_at IS NULL) — the
    // mandatory-rank backstop. The ranker shouldn't let this happen, but if it
    // does, send the user back to finish instead of stranding them.
    try {
      await api.json('/api/onboarding/complete', { method: 'POST' });
      await refreshUser();
    } catch (e) {
      if (e?.status === 409) {
        Alert.alert('Almost there', 'A few places still need a tier — let’s finish ranking.',
          [{ text: 'Finish', onPress: () => navigation.navigate('TileRanker', { city }) }]);
        setFinishing(false);
        return;
      }
      Alert.alert('Error', e.message);
      setFinishing(false);
    }
  }

  async function handleStartFree() {
    setFinishing(true);
    await complete();
  }

  async function handleGoPro() {
    setFinishing(true);
    try {
      await api.json('/api/onboarding/plan', { method: 'POST', body: JSON.stringify({ plan: 'pro' }) });
    } catch { /* non-fatal — still complete onboarding on Free terms */ }
    await complete();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.badge}>🎉</Text>
          <Text style={styles.heading}>You're all set!</Text>
          <Text style={styles.sub}>
            Your taste profile is ready. Here's what you get:
          </Text>
        </View>

        <View style={styles.plans}>
          {/* Free plan */}
          <View style={styles.planCard}>
            <Text style={styles.planName}>Free</Text>
            <Text style={styles.planPrice}>Always free</Text>
            <FeatureRow check text="Unlimited restaurants" />
            <FeatureRow check text="Tier ranking & taste profile" />
            <FeatureRow check text="GPS check-in reminders" />
            <FeatureRow check text="5 AI questions / month" />
          </View>

          {/* Pro plan — selectable now (no payment; real plan='pro' plumbing) */}
          <View style={[styles.planCard, styles.planCardPro]}>
            <View style={styles.proBadge}><Text style={styles.proBadgeText}>Free in beta</Text></View>
            <Text style={[styles.planName, styles.planNamePro]}>Pro</Text>
            <Text style={[styles.planPrice, styles.planPricePro]}>$4.99/mo · free for now</Text>
            <FeatureRow check text="Unlimited AI questions" muted={false} />
            <FeatureRow check text="Smart recommendations" muted={false} />
            <FeatureRow check text="Monthly taste digest" muted={false} />
            <FeatureRow check text="Everything in Free" muted={false} />
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleGoPro} disabled={finishing}>
            {finishing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Unlock Pro free →</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleStartFree} disabled={finishing}>
            <Text style={styles.secondaryBtnText}>Start with Free</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: {
    flex: 1, paddingHorizontal: 24, justifyContent: 'space-between',
    paddingTop: 40, paddingBottom: 40,
  },
  top: { alignItems: 'center' },
  badge: { fontSize: 44, marginBottom: 12 },
  heading: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: COLORS.text,
    textAlign: 'center', marginBottom: 8,
  },
  sub: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 20,
  },
  plans: { flexDirection: 'row', gap: 12 },
  planCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 16,
  },
  planCardPro: {
    borderColor: COLORS.gold, borderWidth: 1.5, position: 'relative',
  },
  proBadge: {
    position: 'absolute', top: -1, right: 12,
    backgroundColor: COLORS.gold, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  proBadgeText: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: '#fff' },
  planName: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 17, color: COLORS.text, marginBottom: 2,
  },
  planNamePro: { color: COLORS.gold },
  planPrice: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginBottom: 12,
  },
  planPricePro: { color: COLORS.gold },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 6 },
  featureCheck: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#27500A', marginTop: 1 },
  featureCheckMuted: { color: COLORS.textMuted },
  featureText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.text, flex: 1, lineHeight: 17 },
  featureTextMuted: { color: COLORS.textMuted },
  buttons: { gap: 10 },
  primaryBtn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  secondaryBtn: {
    borderRadius: 28, paddingVertical: 15, alignItems: 'center',
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  secondaryBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.textMuted },
});
