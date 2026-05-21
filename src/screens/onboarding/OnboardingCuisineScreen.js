import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

export default function OnboardingCuisineScreen({ navigation, route }) {
  const incomingPlaces = route.params?.places || [];
  const city = route.params?.city || '';
  const category = route.params?.category || 'Dinner';
  const isAdditional = route.params?.isAdditional || false;

  const [rows, setRows] = useState([]); // [{user_place_id, place_id, name, cuisine, editing}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    let places = incomingPlaces;

    // Resume support: if no places passed, fetch from API
    if (places.length === 0) {
      try {
        const data = await api.json(`/api/onboarding/my-places?category=${encodeURIComponent(category)}`);
        places = data.places || [];
      } catch {
        places = [];
      }
    }

    if (places.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Guess cuisines
    let cuisineMap = {};
    try {
      const data = await api.json('/api/onboarding/guess-cuisines', {
        method: 'POST',
        body: JSON.stringify({
          places: places.map(p => ({ name: p.name, place_id: p.place_id })),
          city,
        }),
      });
      cuisineMap = data.cuisines || {};
    } catch {
      // non-fatal — show empty cuisines
    }

    setRows(places.map(p => ({
      user_place_id: p.user_place_id,
      place_id: p.place_id,
      name: p.name,
      cuisine: cuisineMap[p.name] || '',
      editing: false,
    })));
    setLoading(false);
  }

  function setRowCuisine(userPlaceId, value) {
    setRows(prev => prev.map(r =>
      r.user_place_id === userPlaceId ? { ...r, cuisine: value } : r
    ));
  }

  function toggleEdit(userPlaceId) {
    setRows(prev => prev.map(r =>
      r.user_place_id === userPlaceId ? { ...r, editing: !r.editing } : r
    ));
  }

  async function handleContinue() {
    setSaving(true);
    try {
      // Save any manually edited cuisines
      const edits = rows.filter(r => r.cuisine);
      if (edits.length > 0) {
        await api.json('/api/onboarding/set-cuisine', {
          method: 'POST',
          body: JSON.stringify(edits.map(r => ({
            user_place_id: r.user_place_id,
            cuisine: r.cuisine,
          }))),
        });
      }

      if (!isAdditional) {
        await api.json('/api/onboarding/profile', {
          method: 'PATCH',
          body: JSON.stringify({ onboarding_step: 4 }),
        });
      }

      navigation.navigate('Rank', {
        places: rows.map(r => ({ user_place_id: r.user_place_id, name: r.name })),
        city,
        category,
        isAdditional,
        returnTo: route.params?.returnTo,
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
          <Text style={styles.loadingText}>Guessing cuisines…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Let's confirm the cuisines</Text>
          <Text style={styles.subtitle}>Tap the pencil to edit any that are wrong.</Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {rows.map(row => (
            <View key={row.user_place_id} style={styles.row}>
              <Text style={styles.placeName} numberOfLines={1}>{row.name}</Text>
              {row.editing ? (
                <TextInput
                  style={styles.cuisineInput}
                  value={row.cuisine}
                  onChangeText={v => setRowCuisine(row.user_place_id, v)}
                  onBlur={() => toggleEdit(row.user_place_id)}
                  placeholder="Cuisine type"
                  placeholderTextColor={COLORS.textLight}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => toggleEdit(row.user_place_id)}
                />
              ) : (
                <TouchableOpacity style={styles.cuisineRow} onPress={() => toggleEdit(row.user_place_id)}>
                  <Text style={[styles.cuisineText, !row.cuisine && styles.cuisinePlaceholder]}>
                    {row.cuisine || 'Tap to add'}
                  </Text>
                  <Text style={styles.editIcon}>✎</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Looks good! →</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, marginTop: 12,
  },
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: COLORS.text, marginBottom: 6 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
  scroll: { flex: 1, paddingHorizontal: 16 },
  row: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 13, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  placeName: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text,
    flex: 1, marginRight: 12,
  },
  cuisineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cuisineText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted },
  cuisinePlaceholder: { color: COLORS.textLight, fontStyle: 'italic' },
  editIcon: { fontSize: 14, color: COLORS.gold },
  cuisineInput: {
    borderBottomWidth: 1, borderBottomColor: COLORS.gold,
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.text,
    minWidth: 100, paddingVertical: 2,
  },
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
