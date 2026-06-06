import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';

// My Places → Categories. Roomy app-optimized tiles (2 per row), one per category.
// Tap → Rankings for that category. Read-only browse; no mutations here.
export default function MyPlacesScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.json('/api/places/users/categories');
      setCategories(Array.isArray(data) ? data : []);
    } catch (_) {
      // keep stale list
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
          {categories.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No categories yet. Add a Place to get started!</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.tile}
                  activeOpacity={0.82}
                  onPress={() => navigation.navigate('Rankings', { categoryId: cat.id, categoryName: cat.name })}
                >
                  <View style={styles.tileIconWrap}>
                    <Ionicons name="restaurant-outline" size={22} color={COLORS.gold} />
                  </View>
                  <Text style={styles.tileTitle} numberOfLines={2}>{cat.name}</Text>
                  <View style={styles.tileFooter}>
                    <Text style={styles.tileSub}>View rankings</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 14,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  tileIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },
  tileTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text, marginTop: 14 },
  tileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  tileSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted },
  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14, fontFamily: 'DMSans_400Regular' },
});
