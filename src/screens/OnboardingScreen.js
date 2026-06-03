import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';

const TIERS = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];
const DEFAULT_CATEGORIES = ['Breakfast', 'Lunch', 'Dinner'];

export default function OnboardingScreen() {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  // step 0: city | step 1: categories | step 2: suggestions | step 3: done

  const [city, setCity] = useState('');
  const [cityPlaceId, setCityPlaceId] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);
  const cityDebounce = useRef(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [customCategory, setCustomCategory] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [tieredPlaces, setTieredPlaces] = useState({});
  const [loading, setLoading] = useState(false);

  function onCityChange(text) {
    setCity(text);
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (text.trim().length < 2) { setCitySuggestions([]); return; }
    cityDebounce.current = setTimeout(async () => {
      setCityLoading(true);
      try {
        const results = await api.json(`/api/places/city-autocomplete?q=${encodeURIComponent(text.trim())}`);
        setCitySuggestions(results || []);
      } catch {
        setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 350);
  }

  function selectCity(item) {
    setCity(item.name);
    setCityPlaceId(item.place_id || '');
    setCitySuggestions([]);
  }

  async function submitCity() {
    if (!city.trim()) { Alert.alert('Enter your city'); return; }
    setLoading(true);
    try {
      await api.json('/api/onboarding/profile', {
        method: 'POST',
        body: JSON.stringify({
          city: city.trim(),
          city_place_id: cityPlaceId || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      setStep(1);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitCategories() {
    const cats = [...selectedCategories];
    if (customCategory.trim()) cats.push(customCategory.trim());
    if (cats.length === 0) { Alert.alert('Pick at least one category'); return; }
    setLoading(true);
    try {
      const data = await api.json('/api/onboarding/suggestions', {
        method: 'POST',
        body: JSON.stringify({ categories: cats }),
      });
      setSuggestions(data.suggestions || []);
      setStep(2);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(name) {
    setSelectedCategories(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  }

  function setTier(placeName, tier) {
    setTieredPlaces(prev => ({ ...prev, [placeName]: tier }));
  }

  async function submitTiers() {
    const entries = Object.entries(tieredPlaces);
    if (entries.length === 0) { Alert.alert('Tier at least one place'); return; }
    setLoading(true);
    try {
      const addedPlaces = [];
      for (const [name, tier] of entries) {
        const sugg = suggestions.find(s => s.name === name);
        const result = await api.json('/api/onboarding/add-place', {
          method: 'POST',
          body: JSON.stringify({ name, category: sugg?.category, tier, city: city || null }),
        });
        if (result.place_id) {
          addedPlaces.push({ name, place_id: result.place_id });
        }
      }
      if (addedPlaces.length > 0) {
        await api.json('/api/onboarding/guess-cuisines', {
          method: 'POST',
          body: JSON.stringify({ places: addedPlaces }),
        });
      }
      await api.json('/api/onboarding/complete', { method: 'POST' });
      await refreshUser();
    } catch (e) {
      if (e.need_city) {
        Alert.alert('City needed', 'Please choose your city above before continuing.');
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to TasteBuddy!</Text>
        <Text style={styles.subtitle}>Let's set up your food list. What city are you in?</Text>
        <View style={styles.cityWrapper}>
          <TextInput
            style={styles.input}
            placeholder="e.g. New York"
            placeholderTextColor={COLORS.textLight}
            value={city}
            onChangeText={onCityChange}
            onSubmitEditing={submitCity}
            autoCorrect={false}
          />
          {cityLoading && (
            <ActivityIndicator size="small" color={COLORS.gold} style={styles.citySpinner} />
          )}
          {citySuggestions.length > 0 && (
            <View style={styles.dropdown}>
              {citySuggestions.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.dropdownItem, i < citySuggestions.length - 1 && styles.dropdownItemBorder]}
                  onPress={() => selectCity(item)}
                >
                  <Text style={styles.dropdownName}>{item.name}</Text>
                  <Text style={styles.dropdownDesc} numberOfLines={1}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.btn} onPress={submitCity} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 1) {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>What do you want to track?</Text>
        <Text style={styles.subtitle}>Pick your meal categories</Text>
        {DEFAULT_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catRow, selectedCategories.includes(cat) && styles.catRowActive]}
            onPress={() => toggleCategory(cat)}
          >
            <Text style={[styles.catText, selectedCategories.includes(cat) && styles.catTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
        <TextInput
          style={[styles.input, { marginTop: 16 }]}
          placeholder="Add another (e.g. Coffee, Ramen…)"
          placeholderTextColor={COLORS.textLight}
          value={customCategory}
          onChangeText={setCustomCategory}
        />
        <TouchableOpacity style={styles.btn} onPress={submitCategories} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Get suggestions</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === 2) {
    return (
      <FlatList
        data={suggestions}
        keyExtractor={(item, i) => `${item.name}-${i}`}
        ListHeaderComponent={() => (
          <View style={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 16 }}>
            <Text style={styles.title}>Tier these places</Text>
            <Text style={styles.subtitle}>How well do you know these spots?</Text>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={{ padding: 24 }}>
            <TouchableOpacity style={styles.btn} onPress={submitTiers} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Finish setup</Text>}
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.suggCard}>
            <Text style={styles.suggName}>{item.name}</Text>
            <Text style={styles.suggCat}>{item.category}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {TIERS.map(t => {
                const tc = TIER_COLORS[t];
                const active = tieredPlaces[item.name] === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tierChip,
                      { backgroundColor: active ? tc.bg : COLORS.borderLight, borderColor: active ? tc.text : 'transparent' },
                    ]}
                    onPress={() => setTier(item.name, t)}
                  >
                    <Text style={[styles.tierChipText, { color: active ? tc.text : COLORS.textMuted }]}>
                      {tc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite, justifyContent: 'center', paddingHorizontal: 32 },
  scrollContainer: { flex: 1, backgroundColor: COLORS.offWhite },
  scrollContent: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24 },
  input: {
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.text, marginBottom: 12,
  },
  cityWrapper: { position: 'relative', marginBottom: 12, zIndex: 10 },
  citySpinner: { position: 'absolute', right: 14, top: 16 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    zIndex: 20,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownItemBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  dropdownName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  dropdownDesc: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 24, paddingVertical: 15,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  catRow: {
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, padding: 16, marginBottom: 10,
  },
  catRowActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldLight },
  catText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  catTextActive: { color: COLORS.gold, fontWeight: '700' },
  suggCard: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.white,
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border, padding: 16,
  },
  suggName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  suggCat: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  tierChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    marginRight: 8, borderWidth: 1.5,
  },
  tierChipText: { fontSize: 12, fontWeight: '600' },
});
