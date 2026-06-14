import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

// Onboarding redesign (Part 2) — CONDITIONAL cuisine confirm. Only surfaces places
// still missing a cuisine after import + the tile-ranker's inline edits. When the
// AI guessed everything (the common case for been-to imports), this self-skips
// straight to the Recap — the fast path. Cuisine is also editable on the ranker
// tile; this is the safety net for blanks.
export default function OnboardingCuisineScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const needCuisine = route.params?.needCuisine || [];
  const category = route.params?.category || null;   // set on an additional-category pass

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);     // {user_place_id, place_id, name, cuisine}
  const [saving, setSaving] = useState(false);
  const skipped = useRef(false);

  useEffect(() => {
    if (needCuisine.length === 0) {
      if (!skipped.current) { skipped.current = true; goToNext(); }
      return;
    }
    guess();
  }, []);

  async function guess() {
    try {
      const data = await api.json('/api/onboarding/guess-cuisines', {
        method: 'POST',
        body: JSON.stringify({
          places: needCuisine.map(p => ({ name: p.name, place_id: p.place_id })),
          city,
        }),
      });
      const map = data.cuisines || {};
      setItems(needCuisine.map(p => ({ ...p, cuisine: map[p.name] || '' })));
    } catch {
      setItems(needCuisine.map(p => ({ ...p, cuisine: '' })));
    } finally {
      setLoading(false);
    }
  }

  function setCuisine(idx, val) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, cuisine: val } : it)));
  }

  // Onboarding redesign: ranking/cuisine always returns to the MoreCategories hub
  // ("add another type of spot?"); marking the just-finished category as done on an
  // additional pass.
  async function goToNext() {
    try { await api.patch('/api/onboarding/profile', { onboarding_step: 7 }); } catch { /* best-effort */ }
    navigation.navigate('MoreCategories', { city, ...(category ? { categoryCompleted: category } : {}) });
  }

  async function handleContinue() {
    setSaving(true);
    const payload = items
      .filter(it => (it.cuisine || '').trim())
      .map(it => ({ user_place_id: it.user_place_id, cuisine: it.cuisine.trim() }));
    try {
      if (payload.length) {
        await api.json('/api/onboarding/set-cuisine', { method: 'POST', body: JSON.stringify(payload) });
      }
    } catch { /* non-fatal */ }
    goToNext();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Quick cuisine check</Text>
          <Text style={styles.subtitle}>
            We weren’t sure on a few — tweak any that look off.
          </Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {items.map((it, i) => (
            <View key={it.user_place_id} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>{it.name}</Text>
              <TextInput
                style={styles.input}
                value={it.cuisine}
                onChangeText={v => setCuisine(i, v)}
                placeholder="cuisine"
                placeholderTextColor={COLORS.textLight}
                returnKeyType="done"
              />
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Looks good →</Text>}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: COLORS.text, marginBottom: 4 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
  scroll: { flex: 1, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text, flex: 1, marginRight: 10 },
  input: {
    backgroundColor: COLORS.offWhite, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 8, fontFamily: 'DMSans_500Medium', fontSize: 13,
    color: COLORS.text, minWidth: 130, textAlign: 'right',
  },
  footer: { paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite },
  btn: { backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center' },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
