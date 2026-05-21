import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

const PRESET_CATEGORIES = [
  'Breakfast', 'Brunch', 'Lunch', 'Coffee / Tea',
  'Bars', 'Dessert', 'Late Night', 'Cocktail Bars',
];

export default function OnboardingMoreCategoriesScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const [completed, setCompleted] = useState(
    route.params?.categoryCompleted ? [route.params.categoryCompleted] : []
  );
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  // Handle returning from a category sub-flow
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = navigation.getState()?.routes?.find(r => r.name === 'MoreCategories')?.params;
      if (params?.categoryCompleted && !completed.includes(params.categoryCompleted)) {
        setCompleted(prev => [...prev, params.categoryCompleted]);
      }
    });
    return unsubscribe;
  }, [navigation, completed]);

  function startCategoryFlow(category) {
    navigation.navigate('Dinner', {
      city,
      category,
      isAdditional: true,
      returnTo: 'MoreCategories',
    });
  }

  function handleCustomSubmit() {
    const name = customText.trim();
    if (!name) return;
    setCustomText('');
    setShowCustom(false);
    startCategoryFlow(name);
  }

  async function handleDone() {
    setSaving(true);
    try {
      await api.json('/api/onboarding/profile', {
        method: 'PATCH',
        body: JSON.stringify({ onboarding_step: 8 }),
      });
      navigation.navigate('AskAI', { city });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Want to add more categories?</Text>
          <Text style={styles.subtitle}>
            Each one adds more depth to your food profile. You can always skip this.
          </Text>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.pillGrid}>
            {PRESET_CATEGORIES.map(cat => {
              const done = completed.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.pill, done && styles.pillDone]}
                  onPress={() => !done && startCategoryFlow(cat)}
                >
                  {done && <Text style={styles.pillCheck}>✓ </Text>}
                  <Text style={[styles.pillText, done && styles.pillTextDone]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}

            {showCustom ? (
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder="Category name…"
                  placeholderTextColor={COLORS.textLight}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={handleCustomSubmit}
                />
                <TouchableOpacity style={styles.customGoBtn} onPress={handleCustomSubmit}>
                  <Text style={styles.customGoBtnText}>Go</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.pillCustom} onPress={() => setShowCustom(true)}>
                <Text style={styles.pillText}>+ Custom</Text>
              </TouchableOpacity>
            )}
          </View>

          {completed.length > 0 && (
            <View style={styles.completedSection}>
              <Text style={styles.completedLabel}>COMPLETED</Text>
              {completed.map(cat => (
                <View key={cat} style={styles.completedRow}>
                  <Text style={styles.completedCheck}>✓</Text>
                  <Text style={styles.completedText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleDone} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Done — take me to Ask AI →</Text>}
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
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: COLORS.text, marginBottom: 8 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
  scroll: { flex: 1, paddingHorizontal: 16 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  },
  pillDone: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold },
  pillText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.text },
  pillTextDone: { color: '#633806' },
  pillCheck: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#633806' },
  pillCustom: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.gold,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    borderStyle: 'dashed',
  },
  customRow: {
    flexDirection: 'row', gap: 8, width: '100%', alignItems: 'center',
  },
  customInput: {
    flex: 1, backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: COLORS.text, fontFamily: 'DMSans_400Regular',
  },
  customGoBtn: {
    backgroundColor: COLORS.gold, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
  },
  customGoBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#fff' },
  completedSection: { marginTop: 8 },
  completedLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  completedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  completedCheck: { fontFamily: 'DMSans_700Bold', color: '#27500A', marginRight: 8 },
  completedText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.text },
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
