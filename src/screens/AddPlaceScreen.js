import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';

const TIERS = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];
const PRIMARY_NAMES = new Set(['Breakfast', 'Lunch', 'Dinner']);

export default function AddPlaceScreen({ navigation, route }) {
  const prefillName = route?.params?.placeName || '';
  const prefillGoogleId = route?.params?.googlePlaceId || '';
  const onDone = route?.params?.onDone;
  const fromActionCard = route?.params?.fromActionCard || null;

  const [step, setStep] = useState(1);
  const [query, setQuery] = useState(prefillName);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showAllCats, setShowAllCats] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [cuisineSuggestions, setCuisineSuggestions] = useState([]);
  const [allCuisines, setAllCuisines] = useState([]);
  const [showCuisineDrop, setShowCuisineDrop] = useState(false);
  const [tier, setTier] = useState('TBE');
  const [saving, setSaving] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const searchInputRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    loadCategories();
    loadCuisines();
    fetchLocation();
    if (prefillGoogleId && prefillName) {
      setSelectedPlace({ google_place_id: prefillGoogleId, name: prefillName });
      setStep(2);
    }
  }, []);

  useEffect(() => {
    if (step === 1 && !prefillGoogleId) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [step]);

  async function fetchLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {}
  }

  async function loadCategories() {
    try {
      const data = await api.json('/api/places/users/categories');
      setCategories(data);
    } catch {}
  }

  async function loadCuisines() {
    try {
      const data = await api.json('/api/places/cuisines');
      setAllCuisines(data);
    } catch {}
  }

  useEffect(() => {
    if (query.length >= 2 && step === 1) {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => searchGooglePlaces(query), 400);
      return () => clearTimeout(searchTimer.current);
    } else {
      setResults([]);
    }
  }, [query]);

  function onCuisineChange(text) {
    setCuisine(text);
    if (text.trim().length === 0) {
      setCuisineSuggestions(allCuisines);
      setShowCuisineDrop(allCuisines.length > 0);
    } else {
      const filtered = allCuisines.filter(c =>
        c.toLowerCase().startsWith(text.toLowerCase())
      );
      setCuisineSuggestions(filtered);
      setShowCuisineDrop(filtered.length > 0);
    }
  }

  function selectCuisine(c) {
    setCuisine(c);
    setShowCuisineDrop(false);
    setCuisineSuggestions([]);
  }

  async function searchGooglePlaces(q) {
    setSearching(true);
    try {
      let url = `/api/places/google-autocomplete?q=${encodeURIComponent(q)}`;
      if (userLocation) {
        url += `&lat=${userLocation.lat}&lng=${userLocation.lng}`;
      }
      const data = await api.json(url);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function pickPlace(place) {
    try {
      let url = `/api/places/check-duplicate?name=${encodeURIComponent(place.name)}`;
      if (place.google_place_id) url += `&google_place_id=${encodeURIComponent(place.google_place_id)}`;
      const dup = await api.json(url);
      if (dup.duplicate_type === 'exact') {
        Alert.alert('Already Added', dup.message);
        return;
      }
      if (dup.duplicate_type === 'fuzzy') {
        Alert.alert('Similar Place Found', dup.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: () => { setSelectedPlace(place); setStep(2); } },
        ]);
        return;
      }
    } catch {}
    setSelectedPlace(place);
    setStep(2);
  }

  async function createNewCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const data = await api.json('/api/places/users/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const newCat = { id: data.id, name, is_primary: false };
      setCategories(prev => [...prev, newCat]);
      setSelectedCategory(newCat);
      setNewCategoryName('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function save() {
    if (!selectedPlace) return;
    if (!cuisine.trim()) {
      Alert.alert('Cuisine required', 'Please enter a cuisine before saving.');
      return;
    }
    setSaving(true);
    try {
      await api.json('/api/places/add-mobile', {
        method: 'POST',
        body: JSON.stringify({
          google_place_id: selectedPlace.google_place_id,
          name: selectedPlace.name,
          address: selectedPlace.address,
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
          tier,
          category_id: selectedCategory?.id || null,
          cuisine: cuisine.trim(),
        }),
      });
      if (fromActionCard) {
        navigation.navigate('Home', { actionCompleted: fromActionCard });
      } else if (onDone) {
        onDone();
      } else {
        Alert.alert('Added!', `${selectedPlace.name} has been added to your list.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  const primaryCats = categories.filter(c => c.is_primary || PRIMARY_NAMES.has(c.name));
  const extraCats = categories.filter(c => !c.is_primary && !PRIMARY_NAMES.has(c.name));
  const visibleCats = showAllCats ? categories : primaryCats;

  // ── Step 1: Search ──────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <ScreenHeader title="Add a Place" navigation={navigation} />
          <View style={styles.body}>
            <Text style={styles.sectionLabel}>Search for a restaurant</Text>
            <View style={styles.searchRow}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="e.g. Lilia, NYC"
                placeholderTextColor={COLORS.textLight}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator size="small" color={COLORS.gold} style={{ marginLeft: 8 }} />}
            </View>
            <FlatList
              data={results}
              keyExtractor={(item, i) => item.google_place_id || String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => pickPlace(item)}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultAddr}>{item.address || item.vicinity || ''}</Text>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: Details ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <ScreenHeader title="Add a Place" navigation={navigation} onBack={() => setStep(1)} />
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          {/* Selected place */}
          <View style={styles.selectedCard}>
            <Text style={styles.selectedName}>{selectedPlace?.name}</Text>
            {selectedPlace?.address ? <Text style={styles.selectedAddr}>{selectedPlace.address}</Text> : null}
          </View>

          {/* Category */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chipRow}>
            {visibleCats.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, selectedCategory?.id === cat.id && styles.chipActive]}
                onPress={() => setSelectedCategory(selectedCategory?.id === cat.id ? null : cat)}
              >
                <Text style={[styles.chipText, selectedCategory?.id === cat.id && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {extraCats.length > 0 && !showAllCats && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllCats(true)}>
              <Text style={styles.showMoreText}>Show more ({extraCats.length})</Text>
            </TouchableOpacity>
          )}
          <View style={styles.newCatRow}>
            <TextInput
              style={styles.newCatInput}
              placeholder="+ Create new category"
              placeholderTextColor={COLORS.textLight}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              onSubmitEditing={createNewCategory}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            {newCategoryName.trim().length > 0 && (
              <TouchableOpacity style={styles.newCatBtn} onPress={createNewCategory}>
                <Text style={styles.newCatBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Cuisine */}
          <Text style={styles.sectionLabel}>Cuisine <Text style={styles.required}>*</Text></Text>
          <View>
            <View style={styles.cuisineInputRow}>
              <TextInput
                style={[styles.input, { marginBottom: 0, flex: 1 }]}
                placeholder="e.g. Italian, Japanese"
                placeholderTextColor={COLORS.textLight}
                value={cuisine}
                onChangeText={onCuisineChange}
                onFocus={() => {
                  setCuisineSuggestions(cuisine.trim() ? cuisineSuggestions : allCuisines);
                  setShowCuisineDrop(allCuisines.length > 0);
                }}
                onBlur={() => setTimeout(() => setShowCuisineDrop(false), 150)}
                autoCorrect={false}
                returnKeyType="done"
              />
              {cuisine.trim().length > 0 && (
                <TouchableOpacity onPress={() => { setCuisine(''); setShowCuisineDrop(false); }} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              )}
            </View>
            {showCuisineDrop && cuisineSuggestions.length > 0 && (
              <View style={styles.dropdown}>
                {cuisineSuggestions.map(c => (
                  <TouchableOpacity key={c} style={styles.dropItem} onPress={() => selectCuisine(c)}>
                    <Text style={styles.dropItemText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Tier */}
          <Text style={styles.sectionLabel}>Initial Tier</Text>
          <View style={styles.chipRow}>
            {TIERS.map(t => {
              const tc = TIER_COLORS[t];
              const active = tier === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tierChip, { backgroundColor: active ? tc.bg : COLORS.borderLight, borderColor: active ? tc.text : 'transparent' }]}
                  onPress={() => setTier(t)}
                >
                  <Text style={[styles.tierChipText, { color: active ? tc.text : COLORS.textMuted }]}>{tc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Add to My Places</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  body: { padding: 16, paddingBottom: 60 },
  sectionLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 20,
  },
  required: { color: '#E24B4A', textTransform: 'none' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text,
  },
  resultRow: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 14, marginBottom: 8,
  },
  resultName: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  resultAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  selectedCard: {
    backgroundColor: COLORS.goldLight, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.gold, padding: 14, marginBottom: 4, marginTop: 8,
  },
  selectedName: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: COLORS.gold },
  selectedAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.textMuted },
  chipTextActive: { color: COLORS.gold, fontFamily: 'DMSans_700Bold' },
  showMoreBtn: { marginBottom: 10 },
  showMoreText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.gold },
  newCatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  newCatInput: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 11,
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text,
  },
  newCatBtn: {
    backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11,
  },
  newCatBtnText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 14 },
  cuisineInputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, marginBottom: 4,
  },
  clearBtn: { position: 'absolute', right: 12 },
  dropdown: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, marginTop: 4, overflow: 'hidden',
  },
  dropItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  dropItemText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text },
  tierChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    marginRight: 8, marginBottom: 8, borderWidth: 1.5,
  },
  tierChipText: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  saveBtn: {
    backgroundColor: COLORS.gold, borderRadius: 24, paddingVertical: 16,
    alignItems: 'center', marginTop: 32, marginBottom: 40,
  },
  saveBtnText: { color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 16 },
});
