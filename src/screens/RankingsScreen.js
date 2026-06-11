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
import { CuisinePill, CategoryPill } from '../components/Pill';
import PlaceCardModal from '../components/PlaceCardModal';
import FilterSelectModal from '../components/FilterSelectModal';

const TIER_ORDER = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];
const TIER_OPTIONS = [
  { key: 'S', label: 'S Tier' }, { key: 'A', label: 'A Tier' }, { key: 'B', label: 'B Tier' },
  { key: 'C', label: 'C-Tier — Okay' }, { key: 'NEXT_UP', label: 'Next Up' }, { key: 'TBE', label: 'TBE' },
];
const tierKeyToLabel = (k) => (TIER_OPTIONS.find((o) => o.key === k) || {}).label || k;
const tierLabelToKey = (l) => (TIER_OPTIONS.find((o) => o.label === l) || {}).key || null;

const uniqSorted = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
// A row's category name, with null (uncategorized) shown as the literal "Other"
// (mirrors the web's "Other" bucket). Used for filtering + the per-row pill.
const rowCat = (p) => (p.category ? p.category.name : 'Other');

// My Places → Rankings. Fetches ALL of the user's memberships ONCE (one
// user_places row per place+category), then filters client-side. Category /
// Cuisine / Tier are MULTI-select (OR within each); geo + name are single.
//
// COMBINED VIEW: when 0 (All) or >1 categories are selected, a place appears ONCE
// PER MATCHING (category,tier) membership — e.g. A-Tier in Bar AND B-Tier in
// Chicken Sandwich shows in BOTH the A and B sections, each tagged with its
// category pill (load-bearing). Single-category selection behaves as before.
export default function RankingsScreen({ navigation, route }) {
  const { categoryId, categoryName } = route.params || {};
  // Entering via a CUISINE pill scopes to that cuisine across ALL categories
  // (mirrors the web's ?view=rankings&cuisine=X link) — so no category baseline.
  const initCuisine = route.params?.cuisine || null;
  const initCat = initCuisine ? null : (categoryName || (categoryId === 'other' ? 'Other' : null));
  const baselineCats = useMemo(() => (initCat ? [initCat] : []), [initCat]);
  const baselineCuisines = useMemo(() => (initCuisine ? [initCuisine] : []), [initCuisine]);

  const [tiers, setTiers] = useState([]);          // raw fetch [{tier,label,places:[...]}]
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selCats, setSelCats] = useState(baselineCats);   // category names (+ 'Other')
  const [selCuisines, setSelCuisines] = useState(baselineCuisines);
  const [selTiers, setSelTiers] = useState([]);           // tier KEYS
  const [geo, setGeo] = useState({ city: null, neighborhood: null, country: null, state: null });
  const [activeModal, setActiveModal] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      // Fetch ALL memberships (no category param) — client filters from here.
      const data = await api.json('/api/places/rankings');
      setTiers(Array.isArray(data.tiers) ? data.tiers : []);
    } catch (_) {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Flat list of membership rows, each carrying its own tier (serializer field).
  const allRows = useMemo(() => tiers.flatMap((t) => t.places), [tiers]);

  const vocab = useMemo(() => ({
    category: uniqSorted(allRows.map(rowCat)),
    cuisine: uniqSorted(allRows.map((p) => p.cuisine)),
    city: uniqSorted(allRows.map((p) => p.city)),
    neighborhood: uniqSorted(allRows.map((p) => p.neighborhood)),
    country: uniqSorted(allRows.map((p) => p.country)),
    state: uniqSorted(allRows.map((p) => p.state)),
  }), [allRows]);

  const combined = selCats.length !== 1;   // 0 (All) or >1 → show category pills

  const title = selCats.length === 1 ? selCats[0]
    : selCats.length > 1 ? selCats.join(' + ')
    : 'All Categories';

  // Build the six tier buckets from the filtered membership rows (once per
  // membership — NO dedupe). All 6 sections in combined view; single-category
  // drops empty sections (unchanged from before — no regression).
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const catSet = new Set(selCats);
    const cuiSet = new Set(selCuisines);
    const tierSet = new Set(selTiers);
    const buckets = TIER_ORDER.map((tk) => ({ tier: tk, label: tierKeyToLabel(tk), data: [] }));
    const byTier = Object.fromEntries(buckets.map((b) => [b.tier, b]));

    allRows.forEach((p) => {
      if (catSet.size && !catSet.has(rowCat(p))) return;
      if (cuiSet.size && !cuiSet.has(p.cuisine)) return;
      if (tierSet.size && !tierSet.has(p.tier)) return;
      if (geo.city && p.city !== geo.city) return;
      if (geo.neighborhood && p.neighborhood !== geo.neighborhood) return;
      if (geo.country && p.country !== geo.country) return;
      if (geo.state && p.state !== geo.state) return;
      if (needle && !(p.display_name || '').toLowerCase().includes(needle)) return;
      if (byTier[p.tier]) byTier[p.tier].data.push(p);
    });
    byTier.S.data.sort((a, b) => (a.s_tier_position || 999) - (b.s_tier_position || 999));
    return buckets.filter((b) => combined || b.data.length > 0);
  }, [allRows, selCats, selCuisines, selTiers, geo, q, combined]);

  const isEmpty = !loading && sections.every((s) => s.data.length === 0);

  // ── Filter triggers ──────────────────────────────────────────────────────
  const CAT_CUISINE = [
    { key: 'category', title: 'Category' },
    { key: 'cuisine', title: 'Cuisine' },
    { key: 'tier', title: 'Tier' },
  ];
  const LOCATION = [
    { key: 'country', title: 'Country' },
    { key: 'state', title: 'State' },
    { key: 'city', title: 'City' },
    { key: 'neighborhood', title: 'Neighborhood' },
  ];

  const isEnabled = (key) => {
    if (key === 'category') return vocab.category.length > 0;   // un-greyed
    if (key === 'cuisine') return vocab.cuisine.length > 0;
    if (key === 'tier') return allRows.length > 0;
    if (key === 'state') return vocab.state.length >= 1;
    return (vocab[key] || []).length >= 2;
  };

  const multiCount = { category: selCats.length, cuisine: selCuisines.length, tier: selTiers.length };
  const triggerLabel = (key, t) => {
    if (key === 'category') return selCats.length === 1 ? selCats[0]
      : selCats.length > 1 ? `Categories (${selCats.length})` : 'All categories';
    if (key === 'cuisine' || key === 'tier') {
      const n = multiCount[key];
      return n > 0 ? `${t} (${n})` : t;
    }
    return geo[key] || t;
  };
  const isActive = (key) => {
    if (key === 'category') return selCats.length >= 1;
    if (key === 'cuisine') return selCuisines.length > 0;
    if (key === 'tier') return selTiers.length > 0;
    return !!geo[key];
  };

  const setGeoFilter = (key, value) => { setGeo((g) => ({ ...g, [key]: value })); setActiveModal(null); };
  const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const arrEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const anyActive = !arrEq(selCats, baselineCats) || !arrEq(selCuisines, baselineCuisines)
    || selTiers.length > 0 || Object.values(geo).some(Boolean) || !!q;
  const resetAll = () => {
    setSelCats(baselineCats); setSelCuisines(baselineCuisines); setSelTiers([]);
    setGeo({ city: null, neighborhood: null, country: null, state: null }); setQ('');
  };

  const scopeToCategory = (name, id) => {
    setSelected(null);
    navigation.push('Rankings', { categoryId: id != null ? id : 'other', categoryName: name });
  };
  // Cuisine pill → that cuisine across ALL categories (mirrors web's cuisine link).
  const scopeToCuisine = (name) => {
    setSelected(null);
    navigation.push('Rankings', { cuisine: name });
  };

  const renderTrigger = (t) => {
    const enabled = isEnabled(t.key);
    const active = enabled && isActive(t.key);
    return (
      <TouchableOpacity
        key={t.key}
        style={[styles.trigger, active && styles.triggerActive, !enabled && styles.triggerDisabled]}
        onPress={() => { if (enabled) setActiveModal(t.key); }}
        disabled={!enabled}
        activeOpacity={0.75}
      >
        <Text
          style={[styles.triggerText, active && styles.triggerTextActive, !enabled && styles.triggerTextDisabled]}
          numberOfLines={1}
        >
          {triggerLabel(t.key, t.title)}
        </Text>
        <Ionicons name="chevron-down" size={13}
          color={active ? '#fff' : (enabled ? COLORS.textMuted : COLORS.textLight)} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={title} navigation={navigation} />

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textLight} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search places…"
          placeholderTextColor={COLORS.textLight}
          value={q}
          onChangeText={setQ}
          clearButtonMode="while-editing"
          autoCorrect spellCheck autoCapitalize="sentences" keyboardType="default"
        />
      </View>

      <Text style={styles.groupLabel}>Category, Cuisine &amp; Tier</Text>
      <View style={styles.filterRow}>{CAT_CUISINE.map(renderTrigger)}</View>

      <Text style={styles.groupLabel}>Location</Text>
      <View style={styles.filterRow}>{LOCATION.map(renderTrigger)}</View>

      {anyActive ? (
        <View style={styles.clearRow}>
          <TouchableOpacity style={styles.clearAll} onPress={resetAll} activeOpacity={0.75}>
            <Text style={styles.clearAllText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} /></View>
      ) : isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {anyActive ? 'No places match your filters.' : 'No places yet.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.user_place_id)}
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
              <View style={styles.nameCol}>
                <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
                {(item.neighborhood || item.city || item.address) ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {[item.neighborhood, item.city].filter(Boolean).join(', ') || item.address}
                  </Text>
                ) : null}
              </View>
              {/* Pills are capped at ~half the row so the place name always keeps the
                  other half and ellipsizes rather than getting crushed. Long category /
                  cuisine text truncates inside its pill. In the combined view the
                  category pill is load-bearing (shows WHICH membership this row is). */}
              <View style={styles.pillsCol}>
                {combined ? (
                  <TouchableOpacity activeOpacity={0.7} style={styles.pillTouch} onPress={() => scopeToCategory(rowCat(item), item.category ? item.category.id : null)}>
                    <CategoryPill label={rowCat(item)} style={styles.rowPill} />
                  </TouchableOpacity>
                ) : null}
                {item.cuisine ? (
                  <TouchableOpacity activeOpacity={0.7} style={styles.pillTouch} onPress={() => scopeToCuisine(item.cuisine)}>
                    <CuisinePill label={item.cuisine} style={styles.rowPill} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Multi-select: Category / Cuisine / Tier (OR). Geo: single. */}
      <FilterSelectModal
        visible={activeModal === 'category'} title="Categories" multi
        options={vocab.category} value={selCats}
        onToggle={(name) => setSelCats((a) => toggleIn(a, name))}
        onClearAll={() => setSelCats([])}
        onClose={() => setActiveModal(null)}
      />
      <FilterSelectModal
        visible={activeModal === 'cuisine'} title="Cuisines" multi
        options={vocab.cuisine} value={selCuisines}
        onToggle={(name) => setSelCuisines((a) => toggleIn(a, name))}
        onClearAll={() => setSelCuisines([])}
        onClose={() => setActiveModal(null)}
      />
      <FilterSelectModal
        visible={activeModal === 'tier'} title="Tiers" multi
        options={TIER_OPTIONS.map((o) => o.label)}
        value={selTiers.map(tierKeyToLabel)}
        onToggle={(label) => { const k = tierLabelToKey(label); if (k) setSelTiers((a) => toggleIn(a, k)); }}
        onClearAll={() => setSelTiers([])}
        onClose={() => setActiveModal(null)}
      />
      {['city', 'neighborhood', 'country', 'state'].map((key) => (
        <FilterSelectModal
          key={key}
          visible={activeModal === key}
          title={key.charAt(0).toUpperCase() + key.slice(1)}
          options={vocab[key]}
          value={geo[key]}
          onSelect={(v) => setGeoFilter(key, v)}
          onClose={() => setActiveModal(null)}
        />
      ))}

      <PlaceCardModal
        place={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onCategoryPress={(name, id) => scopeToCategory(name, id)}
        onCuisinePress={(name) => scopeToCuisine(name)}
      />
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
  groupLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 16, marginTop: 14, marginBottom: 6,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  trigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 7, maxWidth: 220,
  },
  triggerActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  triggerDisabled: { backgroundColor: COLORS.offWhite, borderColor: COLORS.borderLight, opacity: 0.55 },
  triggerText: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: COLORS.textMuted },
  triggerTextActive: { color: '#fff' },
  triggerTextDisabled: { color: COLORS.textLight },
  clearRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12 },
  clearAll: { justifyContent: 'center', paddingVertical: 4 },
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
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, padding: 14, gap: 6,
  },
  position: { fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: COLORS.gold, marginRight: 6, minWidth: 30 },
  // Name takes the remaining space (≥ half, since the pill column is capped) and
  // truncates; pill column is capped at ~46% and its pills wrap/ellipsize inside it.
  nameCol: { flex: 1, minWidth: 0 },
  pillsCol: { maxWidth: '46%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  pillTouch: { maxWidth: '100%' },
  rowPill: { maxWidth: '100%' },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  meta: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  emptyState: { paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
});
