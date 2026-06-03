import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

const MIN_PLACES = 10;

const NEUTRAL_CARD = { bg: '#F5F3F0', text: '#555555', border: '#E0DDD8' };

const MORE_COPIES = ['↻ More suggestions', 'Different spots', 'Try others', 'Show more'];

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
  const [places, setPlaces] = useState([]);
  const [addingSet, setAddingSet] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [moreCopyIdx, setMoreCopyIdx] = useState(0);

  const searchDebounce = useRef(null);
  const nextBatchRef = useRef(null);
  const fetchingBufferRef = useRef(false);

  useEffect(() => {
    loadSuggestions([]);
  }, []);

  async function prefetchNextBatch(currentNames) {
    if (fetchingBufferRef.current) return;
    fetchingBufferRef.current = true;
    try {
      const endpoint = currentNames.length >= 3
        ? '/api/onboarding/adaptive-suggestions'
        : '/api/onboarding/suggestions';
      const body = currentNames.length >= 3
        ? JSON.stringify({ added: currentNames, city })
        : JSON.stringify({ categories: [category] });
      const data = await api.json(endpoint, { method: 'POST', body });
      const raw = data.suggestions || [];
      nextBatchRef.current = raw.map(s => (typeof s === 'string' ? s : s.name));
    } catch {
      nextBatchRef.current = [];
    } finally {
      fetchingBufferRef.current = false;
    }
  }

  async function loadSuggestions(addedNames, useBuffer = false) {
    if (useBuffer && nextBatchRef.current !== null && nextBatchRef.current.length > 0) {
      const buffered = nextBatchRef.current.filter(n => !addedNames.includes(n)).slice(0, 8);
      nextBatchRef.current = null;
      setSuggestions(buffered);
      prefetchNextBatch(addedNames);
      return;
    }

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
      const names = raw.map(s => (typeof s === 'string' ? s : s.name));
      setSuggestions(names.filter(n => !addedNames.includes(n)).slice(0, 8));
      nextBatchRef.current = null;
      prefetchNextBatch(addedNames);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  function handleMorePress() {
    setMoreCopyIdx(i => (i + 1) % MORE_COPIES.length);
    loadSuggestions(places.map(p => p.name), true);
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

    setAddingSet(prev => new Set([...prev, key]));

    try {
      const result = await api.json('/api/onboarding/add-place', {
        method: 'POST',
        // Pass the onboarding city so a new Place always resolves one server-side.
        body: JSON.stringify({ name, google_place_id: googlePlaceId || null, category, tier: 'TBE', city: city || null }),
      });
      const newPlace = { user_place_id: result.user_place_id, place_id: result.place_id, name };
      const newPlaces = [...places, newPlace];
      setPlaces(newPlaces);
      setSearchText('');
      setSearchResults([]);
      setSuggestions(prev => prev.filter(s => s !== name));
      if (newPlaces.length >= 3 && newPlaces.length % 3 === 0) {
        loadSuggestions(newPlaces.map(p => p.name), true);
      }
    } catch (e) {
      if (e.need_city) {
        Alert.alert('City needed', 'Please set your city earlier in onboarding before adding places.');
      } else {
        Alert.alert('Error', e.message);
      }
      setAddingSet(prev => { const next = new Set(prev); next.delete(key); return next; });
      return;
    }
    setAddingSet(prev => { const next = new Set(prev); next.delete(key); return next; });
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
        places, city, category, isAdditional, returnTo: route.params?.returnTo,
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

        {searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            {searchResults.slice(0, 5).map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.searchItem, i < Math.min(searchResults.length, 5) - 1 && styles.searchItemBorder]}
                onPress={() => addPlace(item.name || item.description, item.place_id)}
                disabled={addingSet.size > 0}
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
          {(suggestions.length > 0 || suggestionsLoading) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>SUGGESTIONS</Text>
                <TouchableOpacity onPress={handleMorePress} disabled={suggestionsLoading}>
                  <Text style={styles.refreshBtn}>
                    {suggestionsLoading ? '...' : MORE_COPIES[moreCopyIdx]}
                  </Text>
                </TouchableOpacity>
              </View>

              {suggestionsLoading ? (
                <View style={styles.cardGrid}>
                  {[...Array(4)].map((_, i) => (
                    <View key={i} style={[styles.suggCard, styles.suggCardSkeleton]} />
                  ))}
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  {suggestions.map(name => {
                    const isAdding = addingSet.has(name);
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[
                          styles.suggCard,
                          { backgroundColor: NEUTRAL_CARD.bg, borderColor: isAdding ? COLORS.gold : NEUTRAL_CARD.border },
                          isAdding && styles.suggCardAdding,
                        ]}
                        onPress={() => addPlace(name, null)}
                        disabled={isAdding}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.suggCardText, { color: NEUTRAL_CARD.text }]} numberOfLines={2}>
                          {name}
                        </Text>
                        <View style={styles.suggCardAction}>
                          {isAdding
                            ? <ActivityIndicator size="small" color={COLORS.gold} />
                            : <Text style={[styles.suggCardPlus, { color: NEUTRAL_CARD.text }]}>+</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

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
            <Text style={styles.hint}>{minPlaces - places.length} more to go</Text>
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
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  searchItem: { paddingHorizontal: 16, paddingVertical: 13 },
  searchItemBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  searchItemName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  searchItemAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  refreshBtn: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.gold },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggCard: {
    width: '48%', borderRadius: 12, borderWidth: 1.5,
    padding: 12, minHeight: 76,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  suggCardSkeleton: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  suggCardAdding: { opacity: 0.65 },
  suggCardText: { fontFamily: 'DMSans_700Bold', fontSize: 13, flex: 1, marginRight: 6, lineHeight: 18 },
  suggCardAction: { width: 22, alignItems: 'center' },
  suggCardPlus: { fontFamily: 'DMSans_700Bold', fontSize: 20 },
  counter: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted },
  counterDone: { fontFamily: 'DMSans_700Bold', color: '#27500A' },
  counterPending: { fontFamily: 'DMSans_700Bold', color: COLORS.text },
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
