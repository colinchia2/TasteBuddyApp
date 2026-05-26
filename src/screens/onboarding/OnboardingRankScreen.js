import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, Pressable, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS, TIER_COLORS } from '../../constants/colors';

const TIER_BUCKETS = ['S', 'A', 'B', 'C', 'TBE'];

const TIER_LABELS = { S: 'S Tier', A: 'A Tier', B: 'B Tier', C: 'C Tier', TBE: 'TBE' };
const TIER_DESCRIPTIONS = {
  S: 'The absolute best',
  A: 'Love it — go regularly',
  B: 'Like it — worth going',
  C: "It's okay",
  TBE: "Haven't been yet — but I want to go! (To Be Eaten)",
};

export default function OnboardingRankScreen({ navigation, route }) {
  const incomingPlaces = route.params?.places || [];
  const city = route.params?.city || '';
  const category = route.params?.category || 'Dinner';
  const isAdditional = route.params?.isAdditional || false;

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(incomingPlaces.length === 0);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (incomingPlaces.length > 0) {
      setPlaces(incomingPlaces.map(p => ({ ...p, tier: null })));
    } else {
      fetchPlaces();
    }
  }, []);

  async function fetchPlaces() {
    try {
      const data = await api.json(`/api/onboarding/my-places?category=${encodeURIComponent(category)}`);
      setPlaces((data.places || []).map(p => ({ ...p, tier: null })));
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }

  function assignTier(userPlaceId, tier) {
    Vibration.vibrate(40);
    setPlaces(prev => prev.map(p =>
      p.user_place_id === userPlaceId ? { ...p, tier } : p
    ));
    setSelected(null);
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await api.json('/api/onboarding/set-tiers', {
        method: 'POST',
        body: JSON.stringify(places.map(p => ({
          user_place_id: p.user_place_id,
          tier: p.tier || 'TBE',
        }))),
      });

      if (!isAdditional) {
        await api.json('/api/onboarding/profile', {
          method: 'PATCH',
          body: JSON.stringify({ onboarding_step: 5 }),
        });
      }

      const sTierPlaces = places.filter(p => p.tier === 'S');
      const tierCounts = TIER_BUCKETS.reduce((acc, t) => {
        acc[t] = places.filter(p => (p.tier || 'TBE') === t).length;
        return acc;
      }, {});

      if (sTierPlaces.length > 0) {
        navigation.navigate('STier', {
          sTierPlaces, city, category, isAdditional,
          returnTo: route.params?.returnTo, tierCounts,
        });
      } else if (isAdditional) {
        const returnTo = route.params?.returnTo;
        if (returnTo) navigation.navigate(returnTo, { categoryCompleted: category });
        else navigation.navigate('MoreCategories');
      } else {
        navigation.navigate('Milestone', { tierCounts, city });
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

  const unsorted = places.filter(p => !p.tier);
  const sorted = places.filter(p => !!p.tier);
  const allSorted = unsorted.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Rank your places</Text>
          <Text style={styles.subtitle}>Tap any place to assign it to a tier.</Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Unsorted section */}
          {unsorted.length > 0 && (
            <View style={styles.unsortedSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.unsortedLabel}>UNSORTED</Text>
                <Text style={styles.unsortedCount}>{unsorted.length} remaining</Text>
              </View>
              <View style={styles.unsortedGrid}>
                {unsorted.map(p => (
                  <TouchableOpacity
                    key={p.user_place_id}
                    style={styles.unsortedChip}
                    onPress={() => setSelected(p)}
                  >
                    <Text style={styles.unsortedChipText} numberOfLines={1}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tier buckets */}
          {TIER_BUCKETS.map(tier => {
            const tc = TIER_COLORS[tier];
            const tierPlaces = places.filter(p => p.tier === tier);
            return (
              <View key={tier} style={[styles.bucket, { borderLeftColor: tc.text }]}>
                <View style={[styles.bucketHeader, { backgroundColor: tc.bg }]}>
                  <View>
                    <Text style={[styles.bucketLabel, { color: tc.text }]}>{TIER_LABELS[tier]}</Text>
                    <Text style={[styles.bucketDesc, { color: tc.text }]}>{TIER_DESCRIPTIONS[tier]}</Text>
                  </View>
                  {tierPlaces.length > 0 && (
                    <Text style={[styles.bucketCount, { color: tc.text }]}>{tierPlaces.length}</Text>
                  )}
                </View>
                {tierPlaces.length === 0 ? (
                  <Text style={styles.emptyHint}>None yet</Text>
                ) : (
                  tierPlaces.map(p => (
                    <TouchableOpacity
                      key={p.user_place_id}
                      style={[styles.placeChip, { backgroundColor: tc.bg }]}
                      onPress={() => setSelected(p)}
                    >
                      <Text style={[styles.placeChipText, { color: tc.text }]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            );
          })}

          {!allSorted && (
            <Text style={styles.hint}>Unsorted places will be saved as TBE</Text>
          )}

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

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle} numberOfLines={1}>{selected?.name}</Text>
            <Text style={styles.modalSub}>Assign to tier:</Text>

            {/* Unsorted option */}
            <TouchableOpacity
              style={[styles.tierOption, !selected?.tier && styles.tierOptionActive]}
              onPress={() => assignTier(selected.user_place_id, null)}
            >
              <View>
                <Text style={[styles.tierOptionText, !selected?.tier && styles.tierOptionTextActive]}>
                  Unsorted
                </Text>
                <Text style={styles.tierOptionDesc}>Move back to unsorted</Text>
              </View>
              {!selected?.tier && <Text style={styles.tierCheck}>✓</Text>}
            </TouchableOpacity>

            {TIER_BUCKETS.map(tier => {
              const tc = TIER_COLORS[tier];
              const isActive = selected?.tier === tier;
              return (
                <TouchableOpacity
                  key={tier}
                  style={[
                    styles.tierOption,
                    isActive && { backgroundColor: tc.bg, borderColor: tc.text },
                  ]}
                  onPress={() => assignTier(selected.user_place_id, tier)}
                >
                  <View>
                    <Text style={[styles.tierOptionText, { color: isActive ? tc.text : COLORS.text }]}>
                      {TIER_LABELS[tier]}
                    </Text>
                    <Text style={[styles.tierOptionDesc, isActive && { color: tc.text }]}>
                      {TIER_DESCRIPTIONS[tier]}
                    </Text>
                  </View>
                  {isActive && <Text style={{ color: tc.text, fontSize: 14 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
  scroll: { flex: 1, paddingHorizontal: 16 },
  unsortedSection: {
    marginTop: 16, marginBottom: 8,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border, padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  unsortedLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  unsortedCount: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted },
  unsortedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unsortedChip: {
    backgroundColor: COLORS.offWhite, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxWidth: '60%',
  },
  unsortedChipText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.text },
  bucket: {
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    borderLeftWidth: 3, marginBottom: 8, overflow: 'hidden', backgroundColor: '#fff',
  },
  bucketHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bucketLabel: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  bucketDesc: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginTop: 1, opacity: 0.8 },
  bucketCount: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  emptyHint: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight,
    paddingHorizontal: 14, paddingVertical: 8, fontStyle: 'italic',
  },
  placeChip: {
    marginHorizontal: 10, marginVertical: 4, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  placeChipText: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  hint: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight,
    textAlign: 'center', marginTop: 12, fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text, marginBottom: 4,
  },
  modalSub: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginBottom: 12,
  },
  tierOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, marginBottom: 6,
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  tierOptionActive: { backgroundColor: COLORS.borderLight, borderColor: COLORS.border },
  tierOptionText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  tierOptionTextActive: { color: COLORS.textMuted },
  tierOptionDesc: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  tierCheck: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.textMuted },
});
