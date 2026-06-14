import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

// Onboarding redesign (Part 2) — screen (e). Paste free text + pick a category →
// POST /api/import/text-list (Haiku extracts restaurant names, phase
// onboarding_textlist) → hand the session to the shared names-only review (Import).
const CATEGORIES = ['Dinner', 'Lunch', 'Breakfast', 'Coffee', 'Bars', 'Dessert'];

export default function OnboardingTextListScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const [category, setCategory] = useState('Dinner');
  const [text, setText] = useState('');
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  async function extract() {
    const cat = (showCustom ? custom.trim() : category) || 'Dinner';
    const body = text.trim();
    if (!body) { Alert.alert('Paste a list', 'Add a few restaurant names first.'); return; }
    setBusy(true);
    try {
      const data = await api.json('/api/import/text-list', {
        method: 'POST',
        body: JSON.stringify({ text: body, category: cat }),
      });
      if (!data.total_found) {
        navigation.navigate('Import', { city, sessionId: data.session_id, fromText: true });
        return;
      }
      navigation.navigate('Import', { city, sessionId: data.session_id, fromText: true });
    } catch (e) {
      Alert.alert('Hmm', e.message || 'Could not read that list.');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Paste your list</Text>
          <Text style={styles.subtitle}>
            One per line or comma-separated — typos are fine, we’ll clean them up.
          </Text>

          <Text style={styles.label}>Which category?</Text>
          <View style={styles.catRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, !showCustom && category === c && styles.catChipActive]}
                onPress={() => { setShowCustom(false); setCategory(c); }}
              >
                <Text style={[styles.catChipText, !showCustom && category === c && styles.catChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.catChip, showCustom && styles.catChipActive]}
              onPress={() => setShowCustom(true)}
            >
              <Text style={[styles.catChipText, showCustom && styles.catChipTextActive]}>+ Custom</Text>
            </TouchableOpacity>
          </View>
          {showCustom && (
            <TextInput
              style={styles.customInput}
              placeholder="Category name"
              placeholderTextColor={COLORS.textLight}
              value={custom}
              onChangeText={setCustom}
            />
          )}

          <Text style={styles.label}>Your places</Text>
          <TextInput
            style={styles.paste}
            placeholder={'Lilia\nThai Diner\nVia Carota, Carbone…'}
            placeholderTextColor={COLORS.textLight}
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={extract} disabled={busy}>
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Find my places →</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { padding: 24, paddingTop: 32 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: COLORS.text, marginBottom: 8 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted, marginBottom: 24, lineHeight: 21 },
  label: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.text, marginBottom: 10, letterSpacing: 0.3 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  catChipActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldLight },
  catChipText: { fontFamily: 'DMSans_500Medium', fontSize: 13.5, color: COLORS.textMuted },
  catChipTextActive: { color: COLORS.tierSText, fontFamily: 'DMSans_700Bold' },
  customInput: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 15,
    color: COLORS.text, marginBottom: 20,
  },
  paste: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 14, fontFamily: 'DMSans_400Regular', fontSize: 15,
    color: COLORS.text, minHeight: 180,
  },
  footer: { paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite },
  primaryBtn: { backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
