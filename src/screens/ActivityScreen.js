import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import TierBadge from '../components/TierBadge';
import { CategoryPill, CuisinePill } from '../components/Pill';
import { COLORS } from '../constants/colors';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Rule 9: visited_at / checkin_at are NAIVE LOCAL wall-clock strings
// ("YYYY-MM-DDTHH:MM:SS", no zone). NEVER pass them to new Date() — Hermes parses
// a zone-less ISO string as UTC and then shifts to local, re-dating near-midnight
// events to the wrong day (web shows the right day from the same value). So we
// pull the literal Y/M/D out of the string and format with ZERO timezone math.
//
// NOW is a genuine instant, so a fresh new Date() for "today" is legitimate — the
// distinction is: the device's current time is real; the STORED wall-clock is not
// an instant and must not be reinterpreted through Date parsing.
function formatDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const y = +m[1], mo = +m[2], d = +m[3];

  const now = new Date();                                  // NOW only — a real instant
  if (y === now.getFullYear() && mo === now.getMonth() + 1 && d === now.getDate()) {
    return 'Today';
  }
  const yd = new Date(now);
  yd.setDate(now.getDate() - 1);                           // device-local yesterday
  if (y === yd.getFullYear() && mo === yd.getMonth() + 1 && d === yd.getDate()) {
    return 'Yesterday';
  }
  return `${MONTHS[mo - 1]} ${d}`;                         // literal local Y/M/D, no tz math
}

// Wall-clock time from the naive stored string (Rule 9 — literal, no new Date()).
function formatTime(iso) {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return '';
  let h = +m[1];
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

// One row's category/cuisine/tier pairs: a grouped visit carries `members`;
// a new-place row is a single implicit pair from its top-level fields.
function membershipPairs(item) {
  if (item.type === 'visit' && Array.isArray(item.members) && item.members.length) {
    return item.members;
  }
  return [{ category: item.category, cuisine: item.cuisine, tier: item.tier }];
}

// Line 3: date · (visits only) time · meal_period · occasion. No new Date() on stored values.
function line3(item) {
  const parts = [formatDate(item.date)];
  if (item.type === 'visit') {
    const t = formatTime(item.visited_at || item.date);
    if (t) parts.push(t);
    if (item.meal_period) parts.push(item.meal_period);
    if (item.occasion && item.occasion !== item.meal_period) parts.push(item.occasion);
  }
  // Phase 3: grouped address-add carries detail "Address Added" (web parity).
  if (item.detail) parts.push(item.detail);
  return parts.filter(Boolean).join(' · ');
}

// Muted action label = the type indicator (replaces the old colored pill/dot).
const ACTION_LABELS = { visit: 'Visited', new_place: 'Added' };

// Top filter — mirrors web Activity's chips (All / Visits / New Places). Filters
// the loaded feed client-side by the item `type` the endpoint already returns.
const FEED_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'visit', label: 'Visits' },
  { key: 'new_place', label: 'New Places' },
  { key: 'pending_checkin', label: 'Pending' },   // unfinished check-ins to continue
];

function deleteEndpoint(item) {
  if (item.type === 'visit')           return `/api/visits/${item.visit_id}/mobile`;
  if (item.type === 'new_place')       return `/api/places/user-place/${item.user_place_id}/mobile`;
  if (item.type === 'pending_checkin') return `/api/places/pending-checkin/${item.checkin_id}/mobile`;
  return null;
}

function SwipeableCard({ item, onDelete, children, cardStyle }) {
  const swipeRef = useRef(null);

  function renderRightActions() {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeRef.current?.close();
          Alert.alert(
            'Delete?',
            `Remove "${item.name}" from your activity? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
            ]
          );
        }}
        activeOpacity={0.85}
      >
        <View style={styles.deleteCircle}>
          <Ionicons name="close" size={20} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <View style={[styles.card, cardStyle]}>
        {children}
      </View>
    </Swipeable>
  );
}

export default function ActivityScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [feedFilter, setFeedFilter] = useState('all');   // all | visit | new_place

  async function load(p = 1) {
    if (p === 1) setError(null);
    try {
      const data = await api.json(`/api/activity/feed?page=${p}`);
      if (p === 1) {
        setItems(data.items || []);
      } else {
        setItems(prev => [...prev, ...(data.items || [])]);
      }
      setTotalPages(data.total_pages || 1);
      setPage(p);
    } catch (e) {
      if (p === 1) setError('Could not load activity. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(1); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  }

  function loadMore() {
    if (page < totalPages) load(page + 1);
  }

  // Client-side filter on the type the feed already returns. 'all' keeps
  // everything (incl. pending check-ins, which are neither a visit nor a place-add
  // and so only appear under All).
  const visibleItems = feedFilter === 'all'
    ? items
    : items.filter(i => i.type === feedFilter);

  async function handleDelete(item) {
    const endpoint = deleteEndpoint(item);
    if (!endpoint) return;
    try {
      await api.json(endpoint, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i !== item));
    } catch (e) {
      Alert.alert('Error', 'Could not delete. Please try again.');
    }
  }

  function handleEdit(item) {
    if (item.type === 'visit' && item.visit_id) {
      navigation.navigate('EditVisit', {
        visitId: item.visit_id,
        placeId: item.place_id,
        placeName: item.name,
        tier: item.tier || '',
        occasion: item.occasion || '',
        notes: item.notes || '',
        visited_at: item.visited_at || null,
      });
    } else if (item.type === 'new_place' && item.user_place_id) {
      navigation.navigate('EditPlace', {
        userPlaceId: item.user_place_id,
        placeName: item.name,
        tier: item.tier || '',
        cuisine: item.cuisine || '',
      });
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Activity</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        style={styles.container}
        data={visibleItems}
        keyExtractor={(item, i) => `${item.type}-${item.place_id}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={() => (
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.header}>Activity</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterRow}>
              {FEED_FILTERS.map(f => {
                const active = feedFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setFeedFilter(f.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {feedFilter === 'all' ? 'No activity yet.'
                : feedFilter === 'visit' ? 'No visits yet.'
                : feedFilter === 'pending_checkin' ? 'No pending check-ins.'
                : 'No new Places yet.'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          if (item.type === 'pending_checkin') {
            return (
              <SwipeableCard item={item} onDelete={() => handleDelete(item)} cardStyle={styles.pendingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.action}>
                    <Text style={styles.pendingLabel}>Unfinished checkin · </Text>
                    <Text style={styles.placeName}>{item.name}</Text>
                  </Text>
                  <Text style={styles.meta}>{formatDate(item.date)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => navigation.navigate('LogVisit', {
                    placeId: item.place_id,
                    placeName: item.name,
                    checkinId: item.checkin_id,
                    checkinAt: item.date,   // seed date/time from when the check-in happened
                  })}
                >
                  <Text style={styles.continueBtnText}>Continue</Text>
                </TouchableOpacity>
              </SwipeableCard>
            );
          }
          return (
            <SwipeableCard item={item} onDelete={() => handleDelete(item)}>
              <View style={{ flex: 1 }}>
                {/* Line 1: muted action label + place name (no tier badge, no dot) */}
                <Text style={styles.line1} numberOfLines={1}>
                  <Text style={styles.actionLabel}>{ACTION_LABELS[item.type] || ''} </Text>
                  <Text style={styles.placeName}>{item.name}</Text>
                </Text>

                {/* Line 2: per-membership category + cuisine pills + that membership's
                    tier. Grouped visit → one pair-row per membership. Pills tappable. */}
                <View style={styles.pairsWrap}>
                  {membershipPairs(item).map((p, i) => (
                    <View key={i} style={styles.pairRow}>
                      {p.category ? (
                        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Rankings', { categoryName: p.category })}>
                          <CategoryPill label={p.category} />
                        </TouchableOpacity>
                      ) : null}
                      {p.cuisine ? (
                        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Rankings', { cuisine: p.cuisine })}>
                          <CuisinePill label={p.cuisine} />
                        </TouchableOpacity>
                      ) : null}
                      {p.tier ? <TierBadge tier={p.tier} size="sm" /> : null}
                    </View>
                  ))}
                </View>

                {/* Line 3: date (Rule-9 literal) + time/occasion for visits */}
                <Text style={styles.meta}>{line3(item)}</Text>
              </View>
              {(item.type === 'visit' || item.type === 'new_place') && (
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </SwipeableCard>
          );
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  header: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  closeBtn: { padding: 4 },

  // Top filter segment (All / Visits / New Places). Filled-active, light-inactive,
  // no borders (locked rule) — reads as a segmented control.
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: COLORS.borderLight,
  },
  filterPillActive: { backgroundColor: COLORS.text },
  filterPillText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  filterPillTextActive: { color: COLORS.white },

  // Per-item type pill — makes visit vs new-place obvious even on the All tab.
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border, padding: 14,
  },
  line1: { fontSize: 14 },
  actionLabel: { fontSize: 14, fontWeight: '500', color: COLORS.textMuted },
  placeName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  pairsWrap: { marginTop: 6, gap: 6 },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  action: { fontSize: 14, color: COLORS.text },          // pending row label
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
  editBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.gold,
  },
  editBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.gold },
  pendingCard: {
    borderColor: '#E8B84B', backgroundColor: '#FFFBF0',
  },
  pendingLabel: { fontWeight: '500', color: '#B8860B' },
  continueBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
    backgroundColor: COLORS.gold,
  },
  continueBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  deleteAction: {
    justifyContent: 'center', alignItems: 'center',
    width: 72, marginBottom: 8, marginRight: 16,
  },
  deleteCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.danger,
    justifyContent: 'center', alignItems: 'center',
  },
});
