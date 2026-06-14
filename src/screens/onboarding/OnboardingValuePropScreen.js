import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';
import TBLogo from '../../components/TBLogo';

export default function OnboardingValuePropScreen({ navigation }) {
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await api.json('/api/onboarding/profile', {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_step: 1 }),
      });
    } catch {
      // non-fatal — navigate anyway
    } finally {
      setLoading(false);
    }
    navigation.navigate('Profile');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <TBLogo size={72} style={styles.logoImg} />
          <Text style={styles.tagline}>Your buddy, with your tastes.</Text>
          <Text style={styles.sub}>Not what everyone likes. What you like.</Text>
        </View>

        <View style={styles.bullets}>
          <BulletRow icon="📍" text="Log visits & get reminded later" />
          <BulletRow icon="🤖" text="Personalized AI recs from your list" />
          <BulletRow icon="👥" text="Ask friends where they’d eat" />
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleStart} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Get started →</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function BulletRow({ icon, text }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletIcon}>{icon}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: {
    flex: 1, paddingHorizontal: 32, justifyContent: 'space-between', paddingBottom: 40, paddingTop: 24,
  },
  top: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  logoImg: { marginBottom: 24 },
  tagline: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: COLORS.text,
    textAlign: 'center', marginBottom: 10,
  },
  sub: {
    fontFamily: 'DMSans_400Regular', fontSize: 16, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 22,
  },
  bullets: { paddingHorizontal: 8, marginBottom: 32 },
  bullet: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  bulletIcon: { fontSize: 22, marginRight: 14, width: 30, textAlign: 'center' },
  bulletText: {
    fontFamily: 'DMSans_500Medium', fontSize: 16, color: COLORS.text,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17,
    alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
