import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import TierBadge from '../components/TierBadge';
import { COLORS } from '../constants/colors';

export default function PlacesScreen({ navigation }) {
  const [places, setPlaces] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(q = '') {
    try {
      const path = q ? `/api/places/search-mine?q=${encodeURIComponent(q)}` : '/api/places/search-mine?q=a';
      const data = await api.json(path);
      setPlaces(data);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(query); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  }

  function onSearch(text) {
    setQuery(text);
    load(text);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.gold} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your places…"
          placeholderTextColor={COLORS.textLight}
          value={query}
          onChangeText={onSearch}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={places}
        keyExtractor={(item) => String(item.user_place_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {query ? 'No places match your search.' : 'No places yet. Add some!'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('PlaceDetail', { slug: String(item.place_id) })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {[item.category, item.cuisine, item.address].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <TierBadge tier={item.tier} size="sm" />
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: COLORS.text,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border, padding: 14,
  },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
