import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';

export default function PairwiseScreen({ navigation, route }) {
  const { newId, category } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [newPlace, setNewPlace] = useState(null);
  const [existing, setExisting] = useState([]);
  const [vsIdx, setVsIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await api.json(`/api/places/pairwise/s-tier?new_id=${newId}&category=${encodeURIComponent(category)}`);
      setNewPlace(data.new_place);
      setExisting(data.existing);
    } catch (e) {
      Alert.alert('Error', 'Could not load pairwise data.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function pick(winner) {
    if (saving) return;
    setSaving(true);
    try {
      const data = await api.json('/api/places/pairwise/pick', {
        method: 'POST',
        body: JSON.stringify({ new_id: newId, vs_idx: vsIdx, winner, category }),
      });
      if (data.done) {
        navigation.replace('Home');
      } else {
        setVsIdx(data.next_vs_idx);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save pick.');
    } finally {
      setSaving(false);
    }
  }

  async function skipToBottom() {
    setSaving(true);
    try {
      await api.json('/api/places/pairwise/pick', {
        method: 'POST',
        body: JSON.stringify({ new_id: newId, vs_idx: 9999, winner: 'existing', category }),
      });
    } catch (_) {}
    navigation.replace('Home');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /></View>
      </SafeAreaView>
    );
  }

  const vsPlace = existing[vsIdx];
  const total = existing.length;
  const progress = total > 0 ? vsIdx / total : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.rankingLine}>
            {'You\'re ranking: '}
            <Text style={styles.rankingBold}>{newPlace?.name}</Text>
            {' for '}
            <Text style={styles.rankingBold}>{category}</Text>
            {' S-Tier'}
          </Text>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{vsIdx + 1} of {total}</Text>
        </View>

        {/* Cards */}
        {vsPlace ? (
          <View style={styles.cardRow}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => pick('new')}
              disabled={saving}
              activeOpacity={0.75}
            >
              <Text style={styles.cardTagNew}>NEW ✦</Text>
              <Text style={styles.cardName}>{newPlace?.name}</Text>
              {newPlace?.cuisine ? <Text style={styles.cardMeta}>{newPlace.cuisine}</Text> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => pick('existing')}
              disabled={saving}
              activeOpacity={0.75}
            >
              <Text style={styles.cardTagExisting}>#{vsIdx + 1} CURRENTLY</Text>
              <Text style={styles.cardName}>{vsPlace.name}</Text>
              {vsPlace.cuisine ? <Text style={styles.cardMeta}>{vsPlace.cuisine}</Text> : null}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No existing S-Tier places to compare.</Text>
          </View>
        )}

        {/* Other options */}
        <View style={styles.altSection}>
          <Text style={styles.altLabel}>Other options for ranking</Text>
          <View style={styles.altRow}>
            <TouchableOpacity onPress={skipToBottom} disabled={saving} style={styles.altBtn}>
              <Text style={styles.altBtnText}>Skip — rank at bottom</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Resort', { category })}
              style={styles.altBtn}
            >
              <Text style={styles.altBtnText}>Drag and Drop Full List</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  headerBlock: { alignItems: 'center', marginBottom: 32 },
  rankingLine: {
    fontSize: 14, color: '#888', fontFamily: 'DMSans_400Regular',
    textAlign: 'center', marginBottom: 16, lineHeight: 22,
  },
  rankingBold: { color: '#1a1a1a', fontFamily: 'DMSans_700Bold' },
  progressTrack: {
    backgroundColor: '#f0f0ee', borderRadius: 20, height: 6, width: 220, marginBottom: 8,
  },
  progressFill: {
    backgroundColor: COLORS.gold, borderRadius: 20, height: 6,
  },
  progressLabel: { fontSize: 12, color: '#bbb', fontFamily: 'DMSans_400Regular' },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e0ddd8',
    padding: 20, alignItems: 'center',
  },
  cardTagNew: {
    fontSize: 10, fontWeight: '700', color: COLORS.gold,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
    fontFamily: 'DMSans_700Bold',
  },
  cardTagExisting: {
    fontSize: 10, fontWeight: '700', color: '#888',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
    fontFamily: 'DMSans_700Bold',
  },
  cardName: {
    fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#1a1a1a',
    textAlign: 'center', marginBottom: 6, lineHeight: 22,
  },
  cardMeta: {
    fontSize: 11, color: '#888', fontFamily: 'DMSans_400Regular', textAlign: 'center',
  },
  altSection: { alignItems: 'center', marginTop: 24 },
  altLabel: {
    fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 10, fontFamily: 'DMSans_700Bold',
  },
  altRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  altBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.gold, borderRadius: 20,
    backgroundColor: '#fff',
  },
  altBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.gold, fontFamily: 'DMSans_700Bold' },
  emptyText: { fontSize: 14, color: COLORS.textMuted, fontFamily: 'DMSans_400Regular' },
});
