import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

const OCCASIONS = ['Date night', 'Solo', 'Business', 'Family', 'Friends', 'Special occasion'];
const TIERS = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];
const PARTY_SIZES = [1, 2, 3, 4, 5];
const TOD_CHIPS = [
  { label: 'Breakfast', value: 'Breakfast' },
  { label: 'Brunch',    value: 'Brunch' },
  { label: 'Lunch',     value: 'Lunch' },
  { label: 'Dinner',    value: 'Dinner' },
  { label: 'Late Night',value: 'Late Night' },
];

export default function EditVisitScreen({ navigation, route }) {
  const {
    visitId, placeName,
    tier: initialTier,
    occasion: initialOccasion,
    notes: initialNotes,
    meal_period: initialMealPeriod,
    party_size: initialPartySize,
    spending: initialSpending,
    visited_at: initialVisitedAt,
  } = route.params || {};

  const initialDate = initialVisitedAt ? new Date(initialVisitedAt) : new Date();
  const [visitDate, setVisitDate] = useState(fmtDate(initialDate));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tier, setTier] = useState(initialTier || '');
  const [occasion, setOccasion] = useState(initialOccasion || '');
  const [notes, setNotes] = useState(initialNotes || '');
  const [mealPeriod, setMealPeriod] = useState(initialMealPeriod || '');
  const [partySize, setPartySize] = useState(initialPartySize || null);
  const [totalSpent, setTotalSpent] = useState(initialSpending ? String(initialSpending) : '');
  const [loading, setLoading] = useState(false);

  function onDateChange(event, date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      setVisitDate(fmtDate(date));
    }
  }

  async function save() {
    setLoading(true);
    try {
      const body = {
        visited_at: visitDate,
        tier_at_visit: tier || null,
        occasion: occasion || null,
        notes: notes.trim() || null,
        meal_period: mealPeriod || null,
        party_size: partySize || null,
        spending: totalSpent ? parseFloat(totalSpent) : null,
      };
      await api.json(`/api/visits/${visitId}/mobile`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Visit</Text>
            <TouchableOpacity onPress={save} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.gold} size="small" />
                : <Text style={styles.save}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Place name */}
          <View style={styles.placeRow}>
            <Text style={styles.placeName}>{placeName}</Text>
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.gold} />
              <Text style={styles.dateBtnText}>{formatDateDisplay(visitDate)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(visitDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={onDateChange}
              />
            )}
          </View>

          {/* Tier */}
          <View style={styles.section}>
            <Text style={styles.label}>How was it?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TIERS.map(t => {
                const tc = TIER_COLORS[t];
                const active = tier === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tierChip, { backgroundColor: active ? tc.bg : COLORS.borderLight, borderColor: active ? tc.text : 'transparent' }]}
                    onPress={() => setTier(active ? '' : t)}
                  >
                    <Text style={[styles.tierChipText, { color: active ? tc.text : COLORS.textMuted }]}>
                      {tc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Time of Day */}
          <View style={styles.section}>
            <Text style={styles.label}>Time of Day</Text>
            <View style={styles.chips}>
              {TOD_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip.value}
                  style={[styles.chip, mealPeriod === chip.value && styles.chipActive]}
                  onPress={() => setMealPeriod(mealPeriod === chip.value ? '' : chip.value)}
                >
                  <Text style={[styles.chipText, mealPeriod === chip.value && styles.chipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Occasion */}
          <View style={styles.section}>
            <Text style={styles.label}>Occasion</Text>
            <View style={styles.chips}>
              {OCCASIONS.map(occ => (
                <TouchableOpacity
                  key={occ}
                  style={[styles.chip, occasion === occ && styles.chipActive]}
                  onPress={() => setOccasion(occasion === occ ? '' : occ)}
                >
                  <Text style={[styles.chipText, occasion === occ && styles.chipTextActive]}>{occ}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Party Size */}
          <View style={styles.section}>
            <Text style={styles.label}>Party Size</Text>
            <View style={styles.sizeRow}>
              {PARTY_SIZES.map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.sizeCircle, partySize === n && styles.sizeCircleActive]}
                  onPress={() => setPartySize(partySize === n ? null : n)}
                >
                  <Text style={[styles.sizeText, partySize === n && styles.sizeTextActive]}>
                    {n === 5 ? '4+' : String(n)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Any thoughts?"
              placeholderTextColor={COLORS.textLight}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Total Spent */}
          <View style={styles.section}>
            <Text style={styles.label}>Total Spent <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.spentRow}>
              <Text style={styles.spentPrefix}>$</Text>
              <TextInput
                style={styles.spentInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.textLight}
                value={totalSpent}
                onChangeText={setTotalSpent}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  cancel: { fontSize: 15, color: COLORS.textMuted, fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  save: { fontSize: 15, color: COLORS.gold, fontWeight: '700' },
  placeRow: {
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.goldLight, borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  placeName: { fontSize: 15, fontWeight: '700', color: COLORS.gold },
  section: { paddingHorizontal: 20, marginTop: 24 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: COLORS.text,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.gold, paddingHorizontal: 16, paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  dateBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.gold },
  tierChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1.5 },
  tierChipText: { fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold },
  chipText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  chipTextActive: { color: COLORS.gold, fontWeight: '700' },
  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sizeCircleActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  sizeText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  sizeTextActive: { color: '#fff' },
  spentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16,
  },
  spentPrefix: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginRight: 4 },
  spentInput: { flex: 1, fontSize: 15, color: COLORS.text, paddingVertical: 13, padding: 0 },
});
