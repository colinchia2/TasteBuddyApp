import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

export default function OnboardingSTierScreen({ navigation, route }) {
  const incomingSTierPlaces = route.params?.sTierPlaces || [];
  const city = route.params?.city || '';
  const category = route.params?.category || 'Dinner';
  const isAdditional = route.params?.isAdditional || false;
  const tierCounts = route.params?.tierCounts || {};

  const [places, setPlaces] = useState(
    incomingSTierPlaces.length > 0
      ? incomingSTierPlaces.map((p, i) => ({ ...p, position: i + 1 }))
      : []
  );
  const [loading, setLoading] = useState(incomingSTierPlaces.length === 0);
  const [saving, setSaving] = useState(false);
  const skipFired = useRef(false);

  useEffect(() => {
    if (incomingSTierPlaces.length === 0) {
      fetchSTierPlaces();
    }
  }, []);

  useEffect(() => {
    if (!loading && places.length === 0 && !skipFired.current) {
      skipFired.current = true;
      handleContinue();
    }
  }, [loading, places.length]);

  async function fetchSTierPlaces() {
    setLoading(true);
    try {
      const data = await api.json(`/api/onboarding/my-places?category=${encodeURIComponent(category)}`);
      const sTier = (data.places || [])
        .filter(p => p.tier === 'S')
        .map((p, i) => ({ ...p, position: i + 1 }));
      setPlaces(sTier);
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }

  function moveUp(index) {
    if (index === 0) return;
    setPlaces(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((p, i) => ({ ...p, position: i + 1 }));
    });
  }

  function moveDown(index) {
    if (index === places.length - 1) return;
    setPlaces(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((p, i) => ({ ...p, position: i + 1 }));
    });
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await api.json('/api/onboarding/set-s-order', {
        method: 'POST',
        body: JSON.stringify(places.map(p => ({
          user_place_id: p.user_place_id,
          position: p.position,
        }))),
      });

      if (!isAdditional) {
        await api.json('/api/onboarding/profile', {
          method: 'PATCH',
          body: JSON.stringify({ onboarding_step: 6 }),
        });
        navigation.navigate('Milestone', { tierCounts, city });
      } else {
        const returnTo = route.params?.returnTo;
        if (returnTo) navigation.navigate(returnTo, { categoryCompleted: category });
        else navigation.navigate('MoreCategories');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && places.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Rank your S-Tier</Text>
          <Text style={styles.subtitle}>
            You're ranking: {category} S-Tier
          </Text>
          <Text style={styles.hint}>Use the arrows to put your #1 at the top.</Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {places.map((p, i) => (
            <View key={p.user_place_id} style={styles.row}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{p.position}</Text>
              </View>
              <Text style={styles.placeName} numberOfLines={1}>{p.name}</Text>
              <View style={styles.arrows}>
                <TouchableOpacity
                  onPress={() => moveUp(i)}
                  disabled={i === 0}
                  style={[styles.arrowBtn, i === 0 && styles.arrowDisabled]}
                >
                  <Text style={styles.arrowText}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveDown(i)}
                  disabled={i === places.length - 1}
                  style={[styles.arrowBtn, i === places.length - 1 && styles.arrowDisabled]}
                >
                  <Text style={styles.arrowText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Continue →</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.gold, marginBottom: 4 },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted },
  scroll: { flex: 1, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8,
  },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.goldLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rankText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#633806' },
  placeName: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text, flex: 1,
  },
  arrows: { flexDirection: 'row', gap: 4 },
  arrowBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontSize: 12, color: COLORS.text },
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
