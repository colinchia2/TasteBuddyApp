import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { api, BASE_URL } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';
import { presentPhotoSource, pickLastPhoto } from '../utils/photoSource';

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

const OCCASIONS = ['Date night', 'Solo', 'Business', 'Family', 'Friends', 'Special occasion'];
const PARTY_SIZES = [1, 2, 3, 4, 5];
const TOD_CHIPS = [
  { label: 'Breakfast', value: 'Breakfast' },
  { label: 'Brunch',    value: 'Brunch' },
  { label: 'Lunch',     value: 'Lunch' },
  { label: 'Dinner',    value: 'Dinner' },
  { label: 'Late Night',value: 'Late Night' },
];

export default function EditVisitScreen({ navigation, route }) {
  const { visitId, placeId, placeName } = route.params || {};

  // Form state (prefilled from the server, not nav params — so unedited shared
  // fields aren't wiped when they sync across the linked group on save).
  const [visitDate, setVisitDate] = useState(fmtDate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [occasion, setOccasion] = useState('');
  const [notes, setNotes] = useState('');
  const [mealPeriod, setMealPeriod] = useState('');
  const [partySize, setPartySize] = useState(null);
  const [totalSpent, setTotalSpent] = useState('');
  const origTimeRef = useRef('12:00'); // preserve the visit's time-of-day across a date edit

  // Per-category tiers (matches Log a Visit + the web edit modal)
  const [categories, setCategories] = useState([]); // [{user_place_id, tier, category, cuisine}]
  const [checkedCats, setCheckedCats] = useState({}); // { user_place_id: true }
  const [catTiers, setCatTiers] = useState({}); // { user_place_id: tierStr }
  const origCatTiersRef = useRef({}); // tiers at load — guards the pairwise redirect

  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState([]); // [{id, url}]
  const [newPhotos, setNewPhotos] = useState([]); // [{uri}]
  const [linkedNote, setLinkedNote] = useState('');

  // ── Load full visit detail + this place's categories ──────────────────────
  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      try {
        const [detail, cats] = await Promise.all([
          api.json(`/api/visits/${visitId}/mobile`),
          placeId ? api.json(`/api/places/${placeId}/categories-mobile`) : Promise.resolve([]),
        ]);
        if (cancelled) return;

        // Shared fields
        if (detail.visited_at) {
          const [d, t] = detail.visited_at.split('T');
          if (d) setVisitDate(d);
          origTimeRef.current = (t || '').slice(0, 5) || '12:00';
        }
        setMealPeriod(detail.meal_period || '');
        setOccasion(detail.occasion || '');
        setPartySize(detail.party_size || null);
        setTotalSpent(detail.spending != null ? String(detail.spending) : '');
        setNotes(detail.notes || '');
        if (detail.group_size > 1 && (detail.group_categories || []).length > 1) {
          setLinkedNote(`Logged in ${detail.group_categories.join(' + ')} — edits apply to all.`);
        }

        // Categories + pre-check EVERY category in this visit's group. Checking
        // only the clicked one would make the save reconcile the group down to it
        // and silently delete the siblings. Each tier is seeded from its current
        // ranking so an untouched save preserves it.
        setCategories(cats);
        const memberIds = (detail.group_member_user_place_ids && detail.group_member_user_place_ids.length)
          ? detail.group_member_user_place_ids
          : (detail.user_place_id != null ? [detail.user_place_id] : []);
        const memberSet = new Set(memberIds.map(String));
        const checked = {};
        const tiers = {};
        cats.forEach(c => {
          tiers[c.user_place_id] = c.tier;
          if (memberSet.has(String(c.user_place_id))) checked[c.user_place_id] = true;
        });
        setCheckedCats(checked);
        setCatTiers(tiers);
        origCatTiersRef.current = tiers;

        // Existing photos
        try {
          const ph = await api.json(`/api/photos?visit_id=${visitId}`);
          if (!cancelled) setExistingPhotos(ph);
        } catch {}
      } catch (e) {
        if (!cancelled) Alert.alert('Error', 'Could not load this visit.');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visitId, placeId]);

  function toggleCat(upId) {
    setCheckedCats(prev => ({ ...prev, [upId]: !prev[upId] }));
  }
  function setCatTier(upId, tier) {
    setCatTiers(prev => ({ ...prev, [upId]: tier }));
  }

  function addPhoto() {
    if (existingPhotos.length + newPhotos.length >= 5) { Alert.alert('Max 5 photos'); return; }
    presentPhotoSource({
      onLast: () => pickLastPhoto({ onUri: uploadOnePhoto, onLibrary: pickPhoto }),
      onLibrary: pickPhoto,
    });
  }

  // Edit mode uploads immediately (the visit exists). Shared by "Choose from
  // library" and "Last photo taken" — single upload path, reused.
  async function uploadOnePhoto(uri) {
    if (!uri || !placeId) return;
    const photo = { uri };
    setNewPhotos(prev => [...prev, photo]);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      formData.append('file', { uri, name: filename, type: 'image/jpeg' });
      formData.append('place_id', String(placeId));
      formData.append('visit_id', String(visitId));
      const data = await api.upload('/api/photos/upload', formData);
      setNewPhotos(prev => prev.filter(p => p.uri !== uri));
      setExistingPhotos(prev => [...prev, { id: data.photo_id, url: data.url }]);
    } catch (e) {
      setNewPhotos(prev => prev.filter(p => p.uri !== uri));
      Alert.alert('Upload failed', e.message);
    }
  }

  async function pickPhoto() {
    if (existingPhotos.length + newPhotos.length >= 5) { Alert.alert('Max 5 photos'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access in Settings.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      uploadOnePhoto(result.assets[0].uri);
    }
  }

  async function deleteExistingPhoto(photoId) {
    try {
      await api.json(`/api/photos/delete/${photoId}`, { method: 'DELETE' });
      setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  function onDateChange(event, date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      setVisitDate(fmtDate(date));
    }
  }

  async function save() {
    const activeCats = categories.filter(c => checkedCats[c.user_place_id]);
    if (activeCats.length === 0) { Alert.alert('Select at least one category'); return; }
    setLoading(true);
    try {
      // Combine the (possibly edited) date with the visit's original time so a
      // date-only edit doesn't reset the time to midnight across the group.
      const visitedAt = `${visitDate}T${origTimeRef.current || '12:00'}:00`;
      const body = {
        visited_at: visitedAt,
        occasion: occasion || null,
        notes: notes.trim() || null,
        meal_period: mealPeriod || null,
        party_size: partySize || null,
        spending: totalSpent ? parseFloat(totalSpent) : null,
        user_place_tiers: activeCats.map(c => ({
          user_place_id: c.user_place_id,
          tier: catTiers[c.user_place_id] || c.tier,
        })),
      };
      const data = await api.json(`/api/visits/${visitId}/mobile`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const tierChangedToS = activeCats.some(c => {
        const newTier = catTiers[c.user_place_id] || c.tier;
        return newTier === 'S' && origCatTiersRef.current[c.user_place_id] !== 'S';
      });
      if (data.pairwise_data && tierChangedToS) {
        navigation.replace('Pairwise', {
          newId: data.pairwise_data.new_id,
          category: data.pairwise_data.category,
        });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  const checkedCount = categories.filter(c => checkedCats[c.user_place_id]).length;

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
            <TouchableOpacity onPress={save} disabled={loading || loadingData}>
              {loading
                ? <ActivityIndicator color={COLORS.gold} size="small" />
                : <Text style={[styles.save, (loadingData) && { opacity: 0.4 }]}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Place name */}
          <View style={styles.placeRow}>
            <Text style={styles.placeName}>{placeName}</Text>
          </View>

          {loadingData ? (
            <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
          ) : (
          <>
          {/* Linked-visit note (place logged in 2+ categories as one visit) */}
          {linkedNote ? (
            <View style={styles.linkedNote}>
              <Text style={styles.linkedNoteText}>{linkedNote}</Text>
            </View>
          ) : null}

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.label}>Categories</Text>
            {categories.length === 0
              ? <Text style={styles.emptyNote}>No categories found for this place.</Text>
              : categories.map(cat => (
                  <TouchableOpacity
                    key={cat.user_place_id}
                    style={styles.catRow}
                    onPress={() => toggleCat(cat.user_place_id)}
                  >
                    <View style={[styles.checkbox, checkedCats[cat.user_place_id] && styles.checkboxChecked]}>
                      {checkedCats[cat.user_place_id] && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catName}>{cat.category}</Text>
                      {cat.cuisine ? <Text style={styles.catCuisine}>{cat.cuisine}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))
            }
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

          {/* Tier — one block per checked category */}
          <View style={styles.section}>
            <Text style={styles.label}>How was it? <Text style={styles.optional}>(per category)</Text></Text>
            {checkedCount === 0
              ? <Text style={styles.emptyNote}>Check a category above to set its tier.</Text>
              : categories.filter(c => checkedCats[c.user_place_id]).map(cat => (
                  <View key={cat.user_place_id} style={styles.tierBlock}>
                    <Text style={styles.tierBlockLabel}>{cat.category} Tier</Text>
                    <View style={styles.tierRow}>
                      {Object.entries(TIER_COLORS).map(([t, tc]) => {
                        const active = (catTiers[cat.user_place_id] || cat.tier) === t;
                        return (
                          <TouchableOpacity
                            key={t}
                            style={[styles.catTierChip, { backgroundColor: active ? tc.bg : COLORS.borderLight }]}
                            onPress={() => setCatTier(cat.user_place_id, t)}
                          >
                            <Text style={[styles.catTierChipText, { color: active ? tc.text : COLORS.textMuted }]}>
                              {tc.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))
            }
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

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.label}>Photos <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.photoRow}>
              {existingPhotos.map(p => (
                <View key={p.id} style={styles.photoThumb}>
                  <Image source={{ uri: p.url.startsWith('http') ? p.url : `${BASE_URL}${p.url}` }} style={styles.photoImg} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => deleteExistingPhoto(p.id)}
                  >
                    <Ionicons name="close-circle" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {newPhotos.map((p, i) => (
                <View key={`new-${i}`} style={[styles.photoThumb, { opacity: 0.5 }]}>
                  <Image source={{ uri: p.uri }} style={styles.photoImg} />
                  <ActivityIndicator size="small" color="#fff" style={{ position: 'absolute', top: 26, left: 26 }} />
                </View>
              ))}
              {existingPhotos.length + newPhotos.length < 5 && (
                <TouchableOpacity style={styles.photoAdd} onPress={addPhoto}>
                  <Ionicons name="camera-outline" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
          </>
          )}
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
  linkedNote: {
    marginHorizontal: 20, marginTop: 12, padding: 10,
    backgroundColor: COLORS.goldLight, borderRadius: 8,
  },
  linkedNoteText: { fontSize: 12, color: '#633806' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11 },
  emptyNote: { fontSize: 13, color: COLORS.textMuted },
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

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  catName: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  catCuisine: { fontSize: 12, color: COLORS.textMuted },

  // Per-category tier blocks
  tierBlock: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 14, marginBottom: 12,
  },
  tierBlockLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catTierChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  catTierChipText: { fontSize: 13, fontWeight: '700' },

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
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 9,
  },
  photoAdd: {
    width: 72, height: 72, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white,
  },
});
