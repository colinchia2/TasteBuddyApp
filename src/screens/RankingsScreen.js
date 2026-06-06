import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SectionList,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';
import { CuisinePill } from '../components/Pill';
import PlaceCardModal from '../components/PlaceCardModal';
import FilterSelectModal from '../components/FilterSelectModal';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];
const TIER_OPTIONS = [
  { key: 'S', label: 'S Tier' }, { key: 'A', label: 'A Tier' }, { key: 'B', label: 'B Tier' },
  { key: 'C', label: 'C-Tier — Okay' }, { key: 'NEXT_UP', label: 'Next Up' }, { key: 'TBE', label: 'TBE' },
];
const tierKeyToLabel = (k) => (TIER_OPTIONS.find((o) => o.key === k) || {}).label || null;
const tierLabelToKey = (l) => (TIER_OPTIONS.find((o) => o.label === l) || {}).key || null;

const uniqSorted = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

// Per-category rankings. Fetches the read-only rankings endpoint ONCE, derives the
// filter vocabularies from the loaded places, and filters by tier / cuisine / geo /
// name search CLIENT-SIDE for instant, native-feeling type-and-select refinement
// (the server always returns all 6 tiers — Rule #15). Tap a row → read-only card.
export default function RankingsScreen({ navigation, route }) {
  const { categoryId, categoryName } = route.params || {};
  const [tiers, setTiers] = useState([]);          // [{tier,label,places:[...]}]
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ tier: null, cuisine: null, city: null, neighborhood: null, country: null, state: null });
  const [activeModal, setActiveModal] = useState(null);   // which filter modal is open
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = categoryId != null ? `?category=${encodeURIComponent(categoryId)}` : '';
      const data = await api.json(`/api/places/rankings${params}`);
      setTiers(Array.isArray(data.tiers) ? data.tiers : []);
    } catch (_) {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const allPlaces = useMemo(() => tiers.flatMap((t) => t.places), [tiers]);

  // Filter vocabularies derived from the loaded places, so options always match data.
  const vocab = useMemo(() => ({
    cuisine: uniqSorted(allPlaces.map((p) => p.cuisine)),
    city: uniqSorted(allPlaces.map((p) => p.city)),
    neighborhood: uniqSorted(allPlaces.map((p) => p.neighborhood)),
    country: uniqSorted(allPlaces.map((p) => p.country)),
    state: uniqSorted(allPlaces.map((p) => p.state)),
  }), [allPlaces]);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setActiveModal(null); };
  const clearAll = () => setFilters({ tier: null, cuisine: null, city: null, neighborhood: null, country: null, state: null });
  const anyActive = Object.values(filters).some(Boolean) || !!q;

  // Apply all active filters client-side; keep the 6-tier grouping.
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tiers
      .filter((t) => !filters.tier || t.tier === filters.tier)
      .map((t) => ({
        tier: t.tier,
        label: t.label,
        data: t.places.filter((p) => {
          if (filters.cuisine && p.cuisine !== filters.cuisine) return false;
          if (filters.city && p.city !== filters.city) return false;
          if (filters.neighborhood && p.neighborhood !== filters.neighborhood) return false;
          if (filters.country && p.country !== filters.country) return false;
          if (filters.state && p.state !== filters.state) return false;
          if (needle && !(p.display_name || '').toLowerCase().includes(needle)) return false;
          return true;
        }),
      }))
      .filter((s) => s.data.length > 0);
  }, [tiers, filters, q]);

  const isEmpty = !loading && sections.length === 0;

  // Filter triggers: tier always; a geo/cuisine trigger only when there's >1 value to
  // choose between (state only when any place has one — mirrors the site's conditional).
  const triggers = [
    { key: 'tier', title: 'Tier', show: allPlaces.length > 0 },
    { key: 'cuisine', title: 'Cuisine', show: vocab.cuisine.length > 1 },
    { key: 'city', title: 'City', show: vocab.city.length > 1 },
    { key: 'neighborhood', title: 'Neighborhood', show: vocab.neighborhood.length > 1 },
    { key: 'country', title: 'Country', show: vocab.country.length > 1 },
    { key: 'state', title: 'State', show: vocab.state.length > 0 },
  ].filter((t) => t.show);

  const triggerLabel = (key, title) => {
    if (key === 'tier') return filters.tier ? tierKeyToLabel(filters.tier) : title;
    return filters[key] || title;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={categoryName || 'Rankings'} navigation={navigation} />

      {/* Search — standard iOS keyboard with predictive text (autoCorrect/spellCheck) */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textLight} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search this category…"
          placeholderTextColor={COLORS.textLight}
          value={q}
          onChangeText={setQ}
          clearButtonMode="while-editing"
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
          keyboardType="default"
        />
      </View>

      {/* Filter triggers — flex-wrap row (no horizontal scroll → no clipping/expanding) */}
      <View style={styles.filterRow}>
        {triggers.map((t) => {
          const active = !!filters[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.trigger, active && styles.triggerActive]}
              onPress={() => setActiveModal(t.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.triggerText, active && styles.triggerTextActive]} numberOfLines={1}>
                {triggerLabel(t.key, t.title)}
              </Text>
              <Ionicons name="chevron-down" size={13} color={active ? '#fff' : COLORS.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          );
        })}
        {anyActive ? (
          <TouchableOpacity style={styles.clearAll} onPress={() => { clearAll(); setQ(''); }} activeOpacity={0.75}>
            <Text style={styles.clearAllText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} /></View>
      ) : isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {anyActive ? 'No places match your filters.' : 'No places in this category yet.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.slug || String(item.user_place_id)}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
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

      {/* Type-and-select filter modals */}
      <FilterSelectModal
        visible={activeModal === 'tier'}
        title="Tier"
        options={TIER_OPTIONS.map((o) => o.label)}
        value={tierKeyToLabel(filters.tier)}
        onSelect={(label) => setFilter('tier', label ? tierLabelToKey(label) : null)}
        onClose={() => setActiveModal(null)}
      />
      {['cuisine', 'city', 'neighborhood', 'country', 'state'].map((key) => (
        <FilterSelectModal
          key={key}
          visible={activeModal === key}
          title={key.charAt(0).toUpperCase() + key.slice(1)}
          options={vocab[key]}
          value={filters[key]}
          onSelect={(v) => setFilter(key, v)}
          onClose={() => setActiveModal(null)}
        />
      ))}

      <PlaceCardModal place={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </View>
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  trigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 7, maxWidth: 200,
  },
  triggerActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  triggerText: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: COLORS.textMuted },
  triggerTextActive: { color: '#fff' },
  clearAll: { justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 7 },
  clearAllText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.danger },
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
