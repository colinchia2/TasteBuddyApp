import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';

const TIERS = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];

export default function EditPlaceScreen({ navigation, route }) {
  const {
    userPlaceId, placeName,
    tier: initialTier, cuisine: initialCuisine,
    categoryId: initialCategoryId, categoryName: initialCategoryName,
  } = route.params || {};

  const [tier, setTier] = useState(initialTier || '');
  const [cuisine, setCuisine] = useState(initialCuisine || '');
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.json('/api/places/users/categories')
      .then(data => setCategories(data))
      .catch(() => {});
  }, []);

  async function save() {
    setLoading(true);
    try {
      await api.json(`/api/places/user-place/${userPlaceId}/mobile`, {
        method: 'PATCH',
        body: JSON.stringify({
          tier: tier || undefined,
          category_id: selectedCategoryId || null,
          cuisine: cuisine.trim() || null,
        }),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Place</Text>
            <TouchableOpacity onPress={save} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.gold} size="small" />
                : <Text style={styles.save}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Place name */}
          <View style={styles.placeRow}>
            <Text style={styles.placeName}>{placeName}</Text>
          </View>

          {/* Tier */}
          <View style={styles.section}>
            <Text style={styles.label}>Tier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TIERS.map(t => {
                const tc = TIER_COLORS[t];
                const active = tier === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tierChip, { backgroundColor: active ? tc.bg : COLORS.borderLight, borderColor: active ? tc.text : 'transparent' }]}
                    onPress={() => setTier(active ? '' : t)}
                  >
                    <Text style={[styles.tierChipText, { color: active ? tc.text : COLORS.textMuted }]}>
                      {tc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Category */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.chips}>
                <TouchableOpacity
                  style={[styles.chip, !selectedCategoryId && styles.chipActive]}
                  onPress={() => setSelectedCategoryId(null)}
                >
                  <Text style={[styles.chipText, !selectedCategoryId && styles.chipTextActive]}>None</Text>
                </TouchableOpacity>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, selectedCategoryId === cat.id && styles.chipActive]}
                    onPress={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                  >
                    <Text style={[styles.chipText, selectedCategoryId === cat.id && styles.chipTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Cuisine */}
          <View style={styles.section}>
            <Text style={styles.label}>Cuisine</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Italian, Japanese…"
              placeholderTextColor={COLORS.textLight}
              value={cuisine}
              onChangeText={setCuisine}
              autoCapitalize="words"
              autoCorrect
            />
          </View>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  cancel: { fontSize: 15, color: COLORS.textMuted, fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  save: { fontSize: 15, color: COLORS.gold, fontWeight: '700' },
  placeRow: {
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.goldLight, borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  placeName: { fontSize: 15, fontWeight: '700', color: COLORS.gold },
  section: { paddingHorizontal: 20, marginTop: 24 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: COLORS.text,
  },
  tierChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1.5 },
  tierChipText: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold },
  chipText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  chipTextActive: { color: COLORS.gold, fontWeight: '700' },
});
