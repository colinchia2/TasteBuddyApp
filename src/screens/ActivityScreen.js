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
import { COLORS } from '../constants/colors';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_LABELS = {
  visit: 'Visited',
  new_place: 'Added',
  tier_change: 'Re-tiered',
  delete: 'Removed',
  pending_checkin: 'Checked in',
};

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
        data={items}
        keyExtractor={(item, i) => `${item.type}-${item.place_id}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={() => (
          <View style={styles.headerRow}>
            <Text style={styles.header}>Activity</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No activity yet.</Text>
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
                <Text style={styles.action}>
                  <Text style={styles.actionType}>{TYPE_LABELS[item.type] || item.type}</Text>
                  {' · '}
                  <Text style={styles.placeName}>{item.name}</Text>
                </Text>
                <Text style={styles.meta}>
                  {[item.category, item.occasion, formatDate(item.date)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.cardRight}>
                {item.tier && <TierBadge tier={item.tier} size="sm" />}
                {(item.type === 'visit' || item.type === 'new_place') && (
                  <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editBtn}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
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
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border, padding: 14,
  },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  action: { fontSize: 14, color: COLORS.text },
  actionType: { fontWeight: '500', color: COLORS.textMuted },
  placeName: { fontWeight: '700' },
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
