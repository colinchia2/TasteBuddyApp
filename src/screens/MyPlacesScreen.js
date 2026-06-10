import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];
const TIER_SHORT = { S: 'S', A: 'A', B: 'B', C: 'C', NEXT_UP: 'Next', TBE: 'TBE' };

// Section header copy — single source of truth (mirrors the web my_places labels).
const SECTION_LABELS = {
  primary: 'Primary Categories',
  user: 'User-Added Categories',
  other: 'Other',
};

// My Places → Categories. Single column, one tile per row. Primary categories
// (Breakfast/Lunch/Dinner) first, a divider, then user-added alphabetical, then
// Other. Each tile shows per-tier counts (all 6) + total — same numbers as the site.
export default function MyPlacesScreen({ navigation }) {
  const [data, setData] = useState({ primary: [], user_added: [], other: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.json('/api/places/categories-summary');
      setData({ primary: d.primary || [], user_added: d.user_added || [], other: d.other || null });
    } catch (_) {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openCategory(cat) {
    navigation.navigate('Rankings', {
      categoryId: cat.id != null ? cat.id : 'other',
      categoryName: cat.name,
    });
  }

  const hasAny = data.primary.length || data.user_added.length || data.other;

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Places" navigation={navigation} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        >
          <Text style={styles.subtitle}>Browse your ranked Places by category</Text>

          {!hasAny ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No categories yet. Add a Place to get started!</Text>
            </View>
          ) : (
            <>
              {/* Straight to the combined view — Rankings with no params renders
                  "All Categories" (selCats = []), same as clearing the category
                  filter from inside any single category. */}
              <TouchableOpacity
                style={styles.allBtn}
                activeOpacity={0.82}
                onPress={() => navigation.navigate('Rankings', {})}
              >
                <View style={styles.tileIconWrap}>
                  <Ionicons name="albums-outline" size={20} color={COLORS.gold} />
                </View>
                <Text style={styles.allBtnText}>See All Categories</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              {data.primary.length > 0 ? (
                <Text style={styles.sectionLabel}>{SECTION_LABELS.primary}</Text>
              ) : null}
              {data.primary.map((cat) => (
                <CategoryTile key={cat.id} cat={cat} onPress={() => openCategory(cat)} />
              ))}

              {data.primary.length > 0 && (data.user_added.length > 0 || data.other) ? (
                <View style={styles.divider} />
              ) : null}

              {data.user_added.length > 0 ? (
                <Text style={styles.sectionLabel}>{SECTION_LABELS.user}</Text>
              ) : null}
              {data.user_added.map((cat) => (
                <CategoryTile key={cat.id} cat={cat} onPress={() => openCategory(cat)} />
              ))}

              {data.other ? (
                <Text style={[styles.sectionLabel, data.user_added.length > 0 && { marginTop: 18 }]}>
                  {SECTION_LABELS.other}
                </Text>
              ) : null}
              {data.other ? (
                <CategoryTile cat={data.other} onPress={() => openCategory(data.other)} muted />
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function CategoryTile({ cat, onPress, muted }) {
  const counts = cat.tier_counts || {};
  return (
    <TouchableOpacity style={styles.tile} activeOpacity={0.82} onPress={onPress}>
      <View style={styles.tileHeader}>
        <View style={styles.tileIconWrap}>
          <Ionicons name="restaurant-outline" size={20} color={COLORS.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tileTitle, muted && { color: COLORS.textMuted }]} numberOfLines={1}>{cat.name}</Text>
          <Text style={styles.tileCount}>{cat.total} place{cat.total !== 1 ? 's' : ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </View>
      <View style={styles.pipRow}>
        {TIER_ORDER.map((t) => {
          const tc = TIER_COLORS[t] || TIER_COLORS.TBE;
          const n = counts[t] || 0;
          return (
            <View key={t} style={[styles.pip, { backgroundColor: tc.bg }, n === 0 && styles.pipEmpty]}>
              <Text style={[styles.pipText, { color: tc.text }]}>{TIER_SHORT[t]} {n}</Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },
  // Muted section subheader — reuses the caption color/font (no new tokens), set
  // bold/uppercase to read as a group label (mirrors the web .tile-section-label).
  sectionLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10, marginHorizontal: 4 },
  // "See All Categories" — tile styling (same bg/border/radius), row layout.
  allBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  allBtnText: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text },
  tile: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  tileHeader: { flexDirection: 'row', alignItems: 'center' },
  tileIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.goldLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  tileTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text },
  tileCount: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  pipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  pip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  pipEmpty: { opacity: 0.4 },
  pipText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14, fontFamily: 'DMSans_400Regular' },
});
