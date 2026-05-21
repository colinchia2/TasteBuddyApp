import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

const MIN_PLACES = 10;

export default function OnboardingDinnerScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const category = route.params?.category || 'Dinner';
  const isAdditional = route.params?.isAdditional || false;
  const minPlaces = isAdditional ? 1 : MIN_PLACES;

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [places, setPlaces] = useState([]); // [{user_place_id, place_id, name}]
  const [addingId, setAddingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const searchDebounce = useRef(null);

  useEffect(() => {
    loadSuggestions([]);
  }, []);

  async function loadSuggestions(addedNames) {
    setSuggestionsLoading(true);
    try {
      const endpoint = addedNames.length >= 3
        ? '/api/onboarding/adaptive-suggestions'
        : '/api/onboarding/suggestions';
      const body = addedNames.length >= 3
        ? JSON.stringify({ added: addedNames, city })
        : JSON.stringify({ categories: [category] });
      const data = await api.json(endpoint, { method: 'POST', body });
      const raw = data.suggestions || [];
      // Suggestions shape differs: adaptive returns [name], POST returns [{name, category}]
      const names = raw.map(s => (typeof s === 'string' ? s : s.name));
      const filtered = names.filter(n => !places.find(p => p.name === n));
      setSuggestions(filtered.slice(0, 8));
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  function onSearchChange(text) {
    setSearchText(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.json(
          `/api/places/google-autocomplete?q=${encodeURIComponent(text.trim())}&city=${encodeURIComponent(city)}`
        );
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  async function addPlace(name, googlePlaceId) {
    if (places.find(p => p.name === name)) return;
    const key = googlePlaceId || name;
    setAddingId(key);
    try {
      const result = await api.json('/api/onboarding/add-place', {
        method: 'POST',
        body: JSON.stringify({
          name,
          google_place_id: googlePlaceId || null,
          category,
          tier: 'TBE',
        }),
      });
      const newPlace = { user_place_id: result.user_place_id, place_id: result.place_id, name };
      const newPlaces = [...places, newPlace];
      setPlaces(newPlaces);
      setSearchText('');
      setSearchResults([]);
      setSuggestions(prev => prev.filter(s => s !== name));
      if (newPlaces.length >= 3 && newPlaces.length % 3 === 0) {
        loadSuggestions(newPlaces.map(p => p.name));
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setAddingId(null);
    }
  }

  async function removePlace(userPlaceId) {
    try {
      await api.json(`/api/onboarding/remove-place/${userPlaceId}`, { method: 'DELETE' });
      setPlaces(prev => prev.filter(p => p.user_place_id !== userPlaceId));
    } catch (e) {
      Alert.alert('Error removing place', e.message);
    }
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await api.json('/api/onboarding/profile', {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_step: isAdditional ? undefined : 3 }),
      });
      navigation.navigate('Cuisine', {
        places,
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

  const canContinue = places.length >= minPlaces;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {isAdditional ? `Add your ${category} spots` : `Add your 10 favorite\ndinner spots`}
          </Text>
          <Text style={styles.subtitle}>
            {isAdditional
              ? 'Add as many as you like — you can always add more later.'
              : "Just the places you love — we'll rank them next."}
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={onSearchChange}
            placeholder="🔍  Search for a restaurant..."
            placeholderTextColor={COLORS.textMuted}
          />
          {searching && <ActivityIndicator size="small" color={COLORS.gold} style={styles.searchSpinner} />}
        </View>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.slice(0, 5).map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.searchItem, i < Math.min(searchResults.length, 5) - 1 && styles.searchItemBorder]}
                onPress={() => addPlace(item.name || item.description, item.place_id)}
                disabled={!!addingId}
              >
                <Text style={styles.searchItemName} numberOfLines={1}>{item.name || item.description}</Text>
                {item.address ? (
                  <Text style={styles.searchItemAddr} numberOfLines={1}>{item.address}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>SUGGESTIONS</Text>
                <TouchableOpacity onPress={() => loadSuggestions(places.map(p => p.name))} disabled={suggestionsLoading}>
                  <Text style={styles.refreshBtn}>{suggestionsLoading ? '...' : '↻ More'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pillRow}>
                {suggestions.map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggPill}
                    onPress={() => addPlace(name, null)}
                    disabled={!!addingId}
                  >
                    {addingId === name
                      ? <ActivityIndicator size="small" color={COLORS.gold} />
                      : <Text style={styles.suggPillText}>{name}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Added places */}
          {places.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>YOUR PICKS</Text>
                <Text style={styles.counter}>
                  <Text style={places.length >= minPlaces ? styles.counterDone : styles.counterPending}>
                    {places.length}
                  </Text>
                  {!isAdditional && ` / ${minPlaces}`}
                </Text>
              </View>
              {places.map(p => (
                <View key={p.user_place_id} style={styles.placeRow}>
                  <Text style={styles.placeName}>{p.name}</Text>
                  <TouchableOpacity onPress={() => removePlace(p.user_place_id)} style={styles.removeBtn}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {!isAdditional && places.length < minPlaces && (
            <Text style={styles.hint}>
              {minPlaces - places.length} more to go
            </Text>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, !canContinue && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!canContinue || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Continue →</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: COLORS.text, marginBottom: 6 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
  searchWrap: { marginHorizontal: 16, marginBottom: 4, position: 'relative' },
  searchInput: {
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: COLORS.text, fontFamily: 'DMSans_400Regular',
  },
  searchSpinner: { position: 'absolute', right: 14, top: 14 },
  searchDropdown: {
    marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, zIndex: 10,
  },
  searchItem: { paddingHorizontal: 16, paddingVertical: 13 },
  searchItemBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  searchItemName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  searchItemAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  refreshBtn: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.gold },
  counter: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted },
  counterDone: { fontFamily: 'DMSans_700Bold', color: '#27500A' },
  counterPending: { fontFamily: 'DMSans_700Bold', color: COLORS.text },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggPill: {
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  suggPillText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.text },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  placeName: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.text, flex: 1 },
  removeBtn: { paddingLeft: 12, paddingVertical: 4 },
  removeText: { fontFamily: 'DMSans_400Regular', fontSize: 16, color: COLORS.textMuted },
  hint: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', marginTop: 16,
  },
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: COLORS.border },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
