import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import TierBadge from '../components/TierBadge';
import { COLORS } from '../constants/colors';

const TYPE_LABELS = {
  visit: 'Visited',
  new_place: 'Added',
  tier_change: 'Re-tiered',
  delete: 'Removed',
};

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

  function handleEdit(item) {
    if (item.type === 'visit' && item.visit_id) {
      navigation.navigate('EditVisit', {
        visitId: item.visit_id,
        placeName: item.name,
        tier: item.tier || '',
        occasion: item.occasion || '',
        notes: item.notes || '',
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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.action}>
                <Text style={styles.actionType}>{TYPE_LABELS[item.type] || item.type}</Text>
                {' · '}
                <Text style={styles.placeName}>{item.name}</Text>
              </Text>
              <Text style={styles.meta}>
                {[item.category, item.occasion, item.date].filter(Boolean).join(' · ')}
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
          </View>
        )}
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
});
