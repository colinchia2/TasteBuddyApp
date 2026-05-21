import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../../api/client';

export default function AddCategoryActionCard({ data }) {
  const [category, setCategory] = useState(data.suggested_category || '');
  const [cuisine, setCuisine] = useState(data.suggested_cuisine || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const placeName = data.place_name || '';

  async function submit() {
    const catName = category.trim();
    if (!catName) { setError('Please enter a category.'); return; }
    if (!placeName) { setError('No place to look up.'); return; }
    setSaving(true);
    setError('');
    try {
      // 1. Find place in user's list
      const searchResults = await api.json(`/api/places/search?q=${encodeURIComponent(placeName)}`);
      const match = (searchResults || []).find(r => r.name.toLowerCase() === placeName.toLowerCase())
        || (searchResults || [])[0];
      if (!match) {
        setError(`${placeName} isn't in your TasteBuddy list yet. Add it first.`);
        return;
      }
      // 2. Find or create category
      const cats = await api.json('/api/places/users/categories');
      const existingCat = (cats || []).find(c => c.name.toLowerCase() === catName.toLowerCase());
      let catId;
      if (existingCat) {
        catId = existingCat.id;
      } else {
        const created = await api.json('/api/places/users/categories', {
          method: 'POST',
          body: JSON.stringify({ name: catName, cuisine: cuisine.trim() || null }),
        });
        catId = created.id;
      }
      // 3. Add category to place
      try {
        await api.json(`/api/places/${match.id}/add-category-mobile`, {
          method: 'POST',
          body: JSON.stringify({ category_id: catId, cuisine: cuisine.trim() || null }),
        });
        setDone(true);
      } catch (e) {
        if (e.message && e.message.toLowerCase().includes('already')) {
          setError(`${placeName} is already in ${catName}.`);
        } else {
          throw e;
        }
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <Text style={styles.successText}>✓ {category} added to {placeName}!</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Add Category</Text>
      {placeName ? <Text style={styles.cardPlace}>{placeName}</Text> : null}
      <Text style={styles.fieldLabel}>Category</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Brunch, Dinner…"
        placeholderTextColor="#bbb"
      />
      <Text style={styles.fieldLabel}>Cuisine (optional)</Text>
      <TextInput
        style={styles.input}
        value={cuisine}
        onChangeText={setCuisine}
        placeholder="e.g. Italian, Japanese…"
        placeholderTextColor="#bbb"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.goldButton, saving && styles.goldButtonDisabled]}
        onPress={submit}
        disabled={saving}
      >
        <Text style={styles.goldButtonText}>{saving ? 'Saving…' : 'Add Category'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    borderColor: '#D97706',
    borderLeftWidth: 3,
    borderLeftColor: '#C8960C',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    backgroundColor: '#FEFCE8',
  },
  cardSuccess: {
    backgroundColor: '#EAF3DE',
    borderColor: '#27500A',
    borderLeftColor: '#27500A',
  },
  cardHeader: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: '#713F12',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardPlace: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: '#713F12',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    borderWidth: 0.5,
    borderColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: '#1a1a1a',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#791F1F',
    marginBottom: 8,
  },
  goldButton: {
    backgroundColor: '#C8960C',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  goldButtonDisabled: { opacity: 0.5 },
  goldButtonText: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 13,
  },
  successText: {
    fontFamily: 'DMSans_700Bold',
    color: '#27500A',
    fontSize: 14,
  },
});
