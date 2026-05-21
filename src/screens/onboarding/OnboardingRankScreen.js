import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS, TIER_COLORS } from '../../constants/colors';

const RANK_TIERS = ['S', 'A', 'B', 'C', 'TBE'];
const TIER_LABELS = { S: 'S Tier', A: 'A Tier', B: 'B Tier', C: 'C-Tier — Okay', TBE: 'TBE' };

export default function OnboardingRankScreen({ navigation, route }) {
  const incomingPlaces = route.params?.places || [];
  const city = route.params?.city || '';
  const category = route.params?.category || 'Dinner';
  const isAdditional = route.params?.isAdditional || false;

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(incomingPlaces.length === 0);
  const [selected, setSelected] = useState(null); // place being tiered
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (incomingPlaces.length > 0) {
      setPlaces(incomingPlaces.map(p => ({ ...p, tier: 'TBE' })));
    } else {
      fetchPlaces();
    }
  }, []);

  async function fetchPlaces() {
    try {
      const data = await api.json(`/api/onboarding/my-places?category=${encodeURIComponent(category)}`);
      setPlaces((data.places || []).map(p => ({ ...p, tier: p.tier || 'TBE' })));
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }

  function assignTier(userPlaceId, tier) {
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
          tier: p.tier,
        }))),
      });

      if (!isAdditional) {
        await api.json('/api/onboarding/profile', {
          method: 'PATCH',
          body: JSON.stringify({ onboarding_step: 5 }),
        });
      }

      const sTierPlaces = places.filter(p => p.tier === 'S');
      const tierCounts = RANK_TIERS.reduce((acc, t) => {
        acc[t] = places.filter(p => p.tier === t).length;
        return acc;
      }, {});

      if (sTierPlaces.length > 0) {
        navigation.navigate('STier', {
          sTierPlaces,
          city,
          category,
          isAdditional,
          returnTo: route.params?.returnTo,
          tierCounts,
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Drag each place into a tier</Text>
          <Text style={styles.subtitle}>Tap a place to assign it.</Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {RANK_TIERS.map(tier => {
            const tc = TIER_COLORS[tier];
            const tierPlaces = places.filter(p => p.tier === tier);
            return (
              <View key={tier} style={[styles.bucket, { borderLeftColor: tc.text }]}>
                <View style={[styles.bucketHeader, { backgroundColor: tc.bg }]}>
                  <Text style={[styles.bucketLabel, { color: tc.text }]}>
                    {TIER_LABELS[tier]}
                  </Text>
                  <Text style={[styles.bucketCount, { color: tc.text }]}>
                    {tierPlaces.length > 0 ? tierPlaces.length : ''}
                  </Text>
                </View>
                {tierPlaces.length === 0 ? (
                  <Text style={styles.emptyHint}>Tap a place below to assign here</Text>
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

          {/* Untiered bottom */}
          {places.filter(p => false).length === 0 && (
            <View style={{ height: 16 }} />
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Unassigned list at very top if TBE has items */}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Continue →</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Tier picker modal */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle} numberOfLines={1}>{selected?.name}</Text>
            <Text style={styles.modalSub}>Move to tier:</Text>
            {RANK_TIERS.map(tier => {
              const tc = TIER_COLORS[tier];
              const isActive = selected?.tier === tier;
              return (
                <TouchableOpacity
                  key={tier}
                  style={[styles.tierOption, { backgroundColor: isActive ? tc.bg : '#fff' }]}
                  onPress={() => assignTier(selected.user_place_id, tier)}
                >
                  <Text style={[styles.tierOptionText, { color: isActive ? tc.text : COLORS.text }]}>
                    {TIER_LABELS[tier]}
                  </Text>
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
  bucket: {
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    borderLeftWidth: 3, marginBottom: 10, overflow: 'hidden', backgroundColor: '#fff',
  },
  bucketHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bucketLabel: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
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
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text, marginBottom: 4,
  },
  modalSub: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginBottom: 14,
  },
  tierOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 8,
    borderWidth: 0.5, borderColor: COLORS.border,
  },
  tierOptionText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
});
