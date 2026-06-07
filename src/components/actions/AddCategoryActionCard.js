import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../../api/client';

export default function AddCategoryActionCard({ data }) {
  const [allCategories, setAllCategories] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [customCatName, setCustomCatName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false); // collapsed "create new" link
  const [cuisineQuery, setCuisineQuery] = useState(data.suggested_cuisine || '');
  const [allCuisines, setAllCuisines] = useState([]);
  const [cuisineMatches, setCuisineMatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [doneCatName, setDoneCatName] = useState('');

  const placeName = data.place_name || '';
  const suggestedCat = data.suggested_category || '';

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [cats, cuisines] = await Promise.all([
        api.json('/api/places/users/categories'),
        api.json('/api/places/cuisines'),
      ]);
      const catList = cats || [];
      setAllCategories(catList);
      setAllCuisines(cuisines || []);
      if (suggestedCat) {
        const match = catList.find(c => c.name.toLowerCase() === suggestedCat.toLowerCase());
        if (match) setSelectedCatId(match.id);
        else { setCustomCatName(suggestedCat); setShowNewCatInput(true); }
      }
    } catch (_) {}
  }

  function handleCuisineChange(text) {
    setCuisineQuery(text);
    if (text.length > 0) {
      const filtered = allCuisines.filter(c => c.toLowerCase().includes(text.toLowerCase()));
      setCuisineMatches(filtered.slice(0, 6));
    } else {
      setCuisineMatches([]);
    }
  }

  function selectCuisine(c) {
    setCuisineQuery(c);
    setCuisineMatches([]);
  }

  function selectPill(id) {
    if (selectedCatId === id) {
      setSelectedCatId(null);
    } else {
      setSelectedCatId(id);
      setCustomCatName('');
      setShowNewCatInput(false);
    }
  }

  async function submit() {
    const catId = selectedCatId;
    const catName = customCatName.trim();
    if (!catId && !catName) { setError('Please select or enter a category.'); return; }
    if (!placeName) { setError('No place to look up.'); return; }
    setSaving(true);
    setError('');
    try {
      // 1. Find place in user's list (JWT endpoint)
      const searchResults = await api.json(`/api/places/search-mine?q=${encodeURIComponent(placeName)}`);
      const match = (searchResults || []).find(r => r.name.toLowerCase() === placeName.toLowerCase())
        || (searchResults || [])[0];
      if (!match) {
        setError(`${placeName} isn't in your TasteBuddy list yet. Add it first.`);
        return;
      }
      // 2. Resolve category ID
      let finalCatId = catId;
      const finalCatName = catId
        ? (allCategories.find(c => c.id === catId)?.name || '')
        : catName;
      if (!finalCatId) {
        const created = await api.json('/api/places/users/categories', {
          method: 'POST',
          body: JSON.stringify({ name: catName }),
        });
        finalCatId = created.id;
      }
      // 3. Add category to place
      try {
        await api.json(`/api/places/${match.place_id}/add-category-mobile`, {
          method: 'POST',
          body: JSON.stringify({ category_id: finalCatId, cuisine: cuisineQuery.trim() || null }),
        });
        setDoneCatName(finalCatName);
        setDone(true);
      } catch (e) {
        if (e.message && e.message.toLowerCase().includes('already')) {
          setError(`${placeName} is already in ${finalCatName}.`);
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

  const primaryCats = allCategories.filter(c => c.is_primary);
  const moreCats = allCategories.filter(c => !c.is_primary);

  if (done) {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <Text style={styles.successText}>✓ {doneCatName} added to {placeName}!</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Add Category</Text>
      {placeName ? <Text style={styles.cardPlace}>{placeName}</Text> : null}

      <Text style={styles.fieldLabel}>1. Select a Category</Text>

      {primaryCats.length > 0 && (
        <View style={styles.pillRow}>
          {primaryCats.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.pill, selectedCatId === cat.id && styles.pillSelected]}
              onPress={() => selectPill(cat.id)}
            >
              <Text style={[styles.pillText, selectedCatId === cat.id && styles.pillTextSelected]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {moreCats.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setShowMore(v => !v)} style={styles.moreCatsBtn}>
            <Text style={styles.moreCatsText}>{showMore ? '− Less' : '+ More categories'}</Text>
          </TouchableOpacity>
          {showMore && (
            <View style={[styles.pillRow, { marginTop: 4 }]}>
              {moreCats.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.pill, selectedCatId === cat.id && styles.pillSelected]}
                  onPress={() => selectPill(cat.id)}
                >
                  <Text style={[styles.pillText, selectedCatId === cat.id && styles.pillTextSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {showNewCatInput ? (
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          value={customCatName}
          onChangeText={text => { setCustomCatName(text); if (text) setSelectedCatId(null); }}
          placeholder="New category name…"
          placeholderTextColor="#bbb"
          autoFocus
        />
      ) : (
        <TouchableOpacity onPress={() => { setShowNewCatInput(true); setSelectedCatId(null); }} style={styles.newCatLink}>
          <Text style={styles.newCatLinkText}>or create a new category</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.fieldLabel}>2. Select a Cuisine (optional)</Text>
      <TextInput
        style={styles.input}
        value={cuisineQuery}
        onChangeText={handleCuisineChange}
        placeholder="e.g. Italian, Japanese…"
        placeholderTextColor="#bbb"
      />
      {cuisineMatches.length > 0 && (
        <View style={styles.cuisineSuggestions}>
          {cuisineMatches.map(c => (
            <TouchableOpacity key={c} style={styles.cuisineOption} onPress={() => selectCuisine(c)}>
              <Text style={styles.cuisineOptionText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 0.5, borderColor: '#D97706', backgroundColor: '#fff',
  },
  pillSelected: { backgroundColor: '#FAEEDA', borderColor: '#C8960C' },
  pillText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#713F12' },
  pillTextSelected: { fontFamily: 'DMSans_700Bold', color: '#633806' },
  moreCatsBtn: { paddingVertical: 3, marginBottom: 2, alignSelf: 'flex-start' },
  moreCatsText: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#C8960C' },
  // Collapsed "or create a new category" — subtle brand-gold link.
  newCatLink: { alignSelf: 'flex-start', paddingVertical: 6, marginTop: 8 },
  newCatLinkText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#C8960C' },
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
  cuisineSuggestions: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: '#D97706',
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cuisineOption: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f5f5f5',
  },
  cuisineOptionText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#1a1a1a' },
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
    marginTop: 4,
  },
  goldButtonDisabled: { opacity: 0.5 },
  goldButtonText: { fontFamily: 'DMSans_700Bold', color: '#fff', fontSize: 13 },
  successText: { fontFamily: 'DMSans_700Bold', color: '#27500A', fontSize: 14 },
});
