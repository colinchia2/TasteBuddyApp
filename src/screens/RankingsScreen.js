import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SectionList,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';
import { CuisinePill } from '../components/Pill';
import PlaceCardModal from '../components/PlaceCardModal';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];

// Per-category rankings. Fetches the read-only rankings endpoint ONCE, then filters
// by tier / cuisine / name search CLIENT-SIDE for instant, native-feeling refinement
// (the server always returns all 6 tiers — Rule #15). Tap a row → read-only card.
export default function RankingsScreen({ navigation, route }) {
  const { categoryId, categoryName } = route.params || {};
  const [tiers, setTiers] = useState([]);          // [{tier,label,places:[...]}]
  const [cuisines, setCuisines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tierFilter, setTierFilter] = useState(null);
  const [cuisineFilter, setCuisineFilter] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = categoryId != null ? `?category=${categoryId}` : '';
      const data = await api.json(`/api/places/rankings${params}`);
      setTiers(Array.isArray(data.tiers) ? data.tiers : []);
      setCuisines(Array.isArray(data.cuisines) ? data.cuisines : []);
    } catch (_) {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build SectionList sections from the fetched tiers, applying client-side filters.
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tiers
      .filter((t) => !tierFilter || t.tier === tierFilter)
      .map((t) => ({
        tier: t.tier,
        label: t.label,
        data: t.places.filter((p) => {
          if (cuisineFilter && p.cuisine !== cuisineFilter) return false;
          if (needle && !(p.display_name || '').toLowerCase().includes(needle)) return false;
          return true;
        }),
      }))
      .filter((s) => s.data.length > 0);
  }, [tiers, tierFilter, cuisineFilter, q]);

  const isEmpty = !loading && sections.length === 0;

  return (
    <View style={styles.container}>
      <ScreenHeader title={categoryName || 'Rankings'} navigation={navigation} />

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textLight} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search this category…"
          placeholderTextColor={COLORS.textLight}
          value={q}
          onChangeText={setQ}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>

      {/* Tier filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label="All tiers" active={!tierFilter} onPress={() => setTierFilter(null)} />
        {TIER_ORDER.map((t) => (
          <FilterChip
            key={t}
            label={TIER_COLORS[t]?.label || t}
            active={tierFilter === t}
            activeBg={TIER_COLORS[t]?.bg}
            activeText={TIER_COLORS[t]?.text}
            onPress={() => setTierFilter(tierFilter === t ? null : t)}
          />
        ))}
      </ScrollView>

      {/* Cuisine filter chips (only when the category has cuisines) */}
      {cuisines.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="All cuisines" active={!cuisineFilter} onPress={() => setCuisineFilter(null)} />
          {cuisines.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={cuisineFilter === c}
              onPress={() => setCuisineFilter(cuisineFilter === c ? null : c)}
            />
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} /></View>
      ) : isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {q || tierFilter || cuisineFilter ? 'No places match your filters.' : 'No places in this category yet.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.slug || String(item.user_place_id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderSectionHeader={({ section }) => {
            const tc = TIER_COLORS[section.tier] || TIER_COLORS.TBE;
            return (
              <View style={[styles.sectionHeader, { backgroundColor: tc.bg }]}>
                <Text style={[styles.sectionTitle, { color: tc.text }]}>{section.label}</Text>
                <Text style={[styles.sectionCount, { color: tc.text }]}>{section.data.length}</Text>
              </View>
            );
          }}
          renderItem={({ item, section }) => (
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setSelected(item)}>
              {section.tier === 'S' && item.s_tier_position != null ? (
                <Text style={styles.position}>#{item.s_tier_position}</Text>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
                {(item.neighborhood || item.city || item.address) ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {[item.neighborhood, item.city].filter(Boolean).join(', ') || item.address}
                  </Text>
                ) : null}
              </View>
              {item.cuisine ? <CuisinePill label={item.cuisine} /> : null}
              <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        />
      )}

      <PlaceCardModal place={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function FilterChip({ label, active, onPress, activeBg, activeText }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && styles.chipActive,
        active && activeBg ? { backgroundColor: activeBg } : null,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, active && activeText ? { color: activeText } : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, paddingVertical: 11 },
  chipRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  chip: {
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  chipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: COLORS.textMuted },
  chipTextActive: { color: '#fff' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
  },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  sectionCount: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, padding: 14,
  },
  position: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: COLORS.gold, marginRight: 12, minWidth: 30 },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  emptyState: { paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
});
