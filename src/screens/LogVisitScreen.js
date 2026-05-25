import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';

// ─── Constants ───────────────────────────────────────────────────────────────

const OCCASIONS = ['Date night', 'Solo', 'Business', 'Family', 'Friends', 'Special occasion'];
const PARTY_SIZES = [1, 2, 3, 4, 5]; // 5 displays as '4+'
const TOD_CHIPS = [
  { label: 'Breakfast', minutes: 9 * 60 },
  { label: 'Brunch',    minutes: 11 * 60 },
  { label: 'Lunch',     minutes: 12 * 60 + 30 },
  { label: 'Dinner',    minutes: 19 * 60 },
  { label: 'Late Night',minutes: 22 * 60 },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtMinutes(totalMins) {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function displayTime(totalMins) {
  const h24 = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

function buildDateChips() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun…6=Sat
  const addDays = (n) => { const d = new Date(today); d.setDate(today.getDate() + n); return d; };
  const daysToLastFri = ((dow - 5 + 7) % 7) || 7;
  const daysToLastSat = ((dow - 6 + 7) % 7) || 7;

  const chips = [
    { label: 'Today',     date: fmtDate(today) },
    { label: 'Yesterday', date: fmtDate(addDays(-1)) },
    { label: 'Last Fri',  date: fmtDate(addDays(-daysToLastFri)) },
    { label: 'Last Sat',  date: fmtDate(addDays(-daysToLastSat)) },
  ];
  // Remove duplicates (e.g. if yesterday IS last sat/fri)
  const seen = new Set();
  return chips.filter(c => { if (seen.has(c.date)) return false; seen.add(c.date); return true; });
}

// ─── Phase 1: Choice screen ───────────────────────────────────────────────────

function ChoiceScreen({ navigation, onLogManually }) {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Log a Visit" navigation={navigation} />
      <View style={styles.choiceBody}>
        <Text style={styles.choiceTitle}>How would you like to log?</Text>

        <TouchableOpacity style={styles.choiceCard} onPress={() => navigation.navigate('CheckIn')}>
          <Text style={styles.choiceCardTitle}>Check in now</Text>
          <Text style={styles.choiceCardSub}>Use your location to find nearby places</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.choiceCard, styles.choiceCardSecondary]} onPress={onLogManually}>
          <Text style={styles.choiceCardTitle}>Log manually</Text>
          <Text style={styles.choiceCardSub}>Search for a place and log a past visit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function nearestHour() {
  const now = new Date();
  const mins = now.getHours() * 60 + (now.getMinutes() >= 30 ? 60 : 0);
  return mins % (24 * 60);
}

export default function LogVisitScreen({ navigation, route }) {
  const paramPlaceId = route.params?.placeId;
  const paramPlaceName = route.params?.placeName;
  const paramCheckinId = route.params?.checkinId || null;
  const paramPrefillSearch = route.params?.prefillSearch || '';
  const paramFromActionCard = route.params?.fromActionCard || null;
  const paramAfterSaveNav = route.params?.afterSaveNav || null;

  // Phase: 'choice' | 'search' | 'form'
  const [phase, setPhase] = useState(paramPlaceId ? 'form' : paramPrefillSearch ? 'search' : 'choice');
  const searchInputRef = useRef(null);

  // Place state
  const [placeId, setPlaceId] = useState(paramPlaceId || null);
  const [placeName, setPlaceName] = useState(paramPlaceName || '');
  const [searchQuery, setSearchQuery] = useState(paramPrefillSearch);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Categories (from /api/places/:id/categories-mobile)
  const [categories, setCategories] = useState([]); // [{user_place_id, tier, category, cuisine}]
  const [checkedCats, setCheckedCats] = useState({}); // { user_place_id: true }
  const [catTiers, setCatTiers] = useState({}); // { user_place_id: tierStr }
  const origCatTiersRef = useRef({}); // original tiers at load time — used to guard pairwise
  const [loadingCats, setLoadingCats] = useState(false);

  // Add-category inline form
  const [showAddCat, setShowAddCat] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [addCatSelected, setAddCatSelected] = useState(null); // { id, name }
  const [addCatCustom, setAddCatCustom] = useState('');
  const [addCatCuisine, setAddCatCuisine] = useState('');
  const [addCatTier, setAddCatTier] = useState('TBE');
  const [addCatSaving, setAddCatSaving] = useState(false);
  const [addCatSuccessMsg, setAddCatSuccessMsg] = useState('');

  // Form state
  const [dateChips] = useState(buildDateChips);
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()));
  const [customDate, setCustomDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTOD, setSelectedTOD] = useState(null);
  const [timeMinutes, setTimeMinutes] = useState(nearestHour);
  const [occasions, setOccasions] = useState([]);
  const [partySize, setPartySize] = useState(null);
  const [notes, setNotes] = useState('');
  const [totalSpent, setTotalSpent] = useState('');

  const [photos, setPhotos] = useState([]); // array of { uri }
  const [saving, setSaving] = useState(false);

  // ── Load categories when place known ────────────────────────────────────────
  useEffect(() => {
    if (placeId) loadCategories(placeId);
  }, [placeId]);

  async function loadCategories(id) {
    setLoadingCats(true);
    setShowAddCat(false);
    try {
      const data = await api.json(`/api/places/${id}/categories-mobile`);
      setCategories(data);
      // Pre-check all active categories and prefill tier from current tier
      const checked = {};
      const tiers = {};
      data.forEach(c => { checked[c.user_place_id] = true; tiers[c.user_place_id] = c.tier; });
      setCheckedCats(checked);
      setCatTiers(tiers);
      origCatTiersRef.current = tiers;
    } catch {
      setCategories([]);
    } finally {
      setLoadingCats(false);
    }
  }

  async function loadAllCategories() {
    try {
      const data = await api.json('/api/places/users/categories');
      const existingNames = categories.map(c => c.category);
      const available = (data || []).filter(c => !existingNames.includes(c.name));
      const PRIMARY_ORDER = ['Breakfast', 'Lunch', 'Dinner'];
      const primaryCats = available.filter(c => PRIMARY_ORDER.includes(c.name))
        .sort((a, b) => PRIMARY_ORDER.indexOf(a.name) - PRIMARY_ORDER.indexOf(b.name));
      const otherCats = available.filter(c => !PRIMARY_ORDER.includes(c.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllCategories([...primaryCats, ...otherCats]);
    } catch {
      setAllCategories([]);
    }
  }

  async function submitAddCategory() {
    if (!addCatSelected && !addCatCustom.trim()) {
      Alert.alert('Select or type a category name'); return;
    }
    if (!addCatCuisine.trim()) {
      Alert.alert('Enter a cuisine'); return;
    }
    // FIX 3: Frontend duplicate check for custom name
    if (addCatCustom.trim()) {
      const existingNames = categories.map(c => c.category.toLowerCase());
      if (existingNames.includes(addCatCustom.trim().toLowerCase())) {
        Alert.alert('Already added', `This place already has "${addCatCustom.trim()}".`); return;
      }
    }
    const finalName = addCatSelected?.name || addCatCustom.trim();
    setAddCatSaving(true);
    try {
      let catId = addCatSelected?.id;
      if (!catId && addCatCustom.trim()) {
        const catResp = await api.json('/api/places/users/categories', {
          method: 'POST',
          body: JSON.stringify({ name: addCatCustom.trim() }),
        });
        catId = catResp.id;
      }
      await api.json(`/api/places/${placeId}/add-category-mobile`, {
        method: 'POST',
        body: JSON.stringify({ category_id: catId, cuisine: addCatCuisine.trim(), tier: addCatTier }),
      });
      await loadCategories(placeId); // closes form, auto-checks the new category
      setAddCatSelected(null);
      setAddCatCustom('');
      setAddCatCuisine('');
      setAddCatTier('TBE');
      // FIX 4: Show success toast
      setAddCatSuccessMsg(`✓ ${finalName} added and selected!`);
      setTimeout(() => setAddCatSuccessMsg(''), 3000);
    } catch (e) {
      Alert.alert('Error', e.message);
      setShowAddCat(false);
    } finally {
      setAddCatSaving(false);
    }
  }

  // ── Focus search input when entering search phase ─────────────────────────
  useEffect(() => {
    if (phase === 'search') {
      const t = setTimeout(() => searchInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // ── Place search ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'search' || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => doSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery, phase]);

  async function doSearch(q) {
    setSearching(true);
    try {
      const data = await api.json(`/api/places/search-mine?q=${encodeURIComponent(q)}`);
      setSearchResults(data);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  function pickPlace(item) {
    setPlaceId(item.place_id);
    setPlaceName(item.name);
    setSearchResults([]);
    setPhase('form');
  }

  // ── Date picker ───────────────────────────────────────────────────────────────
  function onDateChange(event, date) {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      const isoDate = fmtDate(date);
      setCustomDate(isoDate);
      setSelectedDate(isoDate);
    }
  }

  // ── Time helpers ──────────────────────────────────────────────────────────────
  function shiftTime(delta) {
    setTimeMinutes(prev => {
      const next = prev + delta;
      if (next < 0) return next + 24 * 60;
      if (next >= 24 * 60) return next - 24 * 60;
      return next;
    });
    setSelectedTOD(null);
  }

  function pickTOD(chip) {
    setSelectedTOD(chip.label);
    setTimeMinutes(chip.minutes);
  }

  // ── Occasion toggle ───────────────────────────────────────────────────────────
  function toggleOccasion(occ) {
    setOccasions(prev =>
      prev.includes(occ) ? prev.filter(o => o !== occ) : [...prev, occ]
    );
  }

  // ── Category check/tier ───────────────────────────────────────────────────────
  function toggleCat(upId) {
    setCheckedCats(prev => ({ ...prev, [upId]: !prev[upId] }));
  }
  function setCatTier(upId, tier) {
    setCatTiers(prev => ({ ...prev, [upId]: tier }));
  }

  // ── Photos ────────────────────────────────────────────────────────────────────
  async function pickPhoto() {
    if (photos.length >= 5) { Alert.alert('Max 5 photos'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access in Settings.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos(prev => [...prev, { uri: result.assets[0].uri }]);
    }
  }

  async function uploadPhotos(visitId, pid) {
    for (const photo of photos) {
      try {
        const formData = new FormData();
        const filename = photo.uri.split('/').pop();
        formData.append('file', { uri: photo.uri, name: filename, type: 'image/jpeg' });
        formData.append('place_id', String(pid));
        formData.append('visit_id', String(visitId));
        await api.upload('/api/photos/upload', formData);
      } catch {}
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function submit() {
    const activeCats = categories.filter(c => checkedCats[c.user_place_id]);
    if (!placeId) { Alert.alert('Select a place first'); return; }
    if (activeCats.length === 0) { Alert.alert('Select at least one category'); return; }
    if (occasions.length === 0) { Alert.alert('Select an occasion'); return; }
    if (!partySize) { Alert.alert('Select a party size'); return; }

    const dateStr = customDate || selectedDate;
    const timeStr = fmtMinutes(timeMinutes);
    const visitedAt = `${dateStr}T${timeStr}:00`;

    const payload = {
      place_id: placeId,
      visited_at: visitedAt,
      occasions,
      meal_period: selectedTOD || null,
      party_size: partySize,
      notes: notes.trim() || null,
      spending: totalSpent ? parseFloat(totalSpent) : null,
      user_place_tiers: activeCats.map(c => ({
        user_place_id: c.user_place_id,
        tier: catTiers[c.user_place_id] || c.tier,
      })),
      ...(paramCheckinId ? { pending_checkin_id: paramCheckinId } : {}),
    };

    setSaving(true);
    try {
      const data = await api.json('/api/visits/mobile', { method: 'POST', body: JSON.stringify(payload) });
      if (photos.length > 0 && data.visit_id) {
        await uploadPhotos(data.visit_id, placeId);
      }
      const tierChangedToS = activeCats.some(c => {
        const newTier = catTiers[c.user_place_id] || c.tier;
        const origTier = origCatTiersRef.current[c.user_place_id];
        return newTier === 'S' && origTier !== 'S';
      });
      if (data.pairwise_data && tierChangedToS) {
        navigation.replace('Pairwise', {
          newId: data.pairwise_data.new_id,
          category: data.pairwise_data.category,
        });
      } else if (paramAfterSaveNav) {
        navigation.replace(paramAfterSaveNav.screen, paramAfterSaveNav.params);
      } else if (paramFromActionCard) {
        navigation.navigate('Home', { actionCompleted: paramFromActionCard });
      } else {
        Alert.alert('Visit logged!', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render: choice ────────────────────────────────────────────────────────────
  if (phase === 'choice') {
    return <ChoiceScreen navigation={navigation} onLogManually={() => setPhase('search')} />;
  }

  // ── Render: search ────────────────────────────────────────────────────────────
  if (phase === 'search') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <ScreenHeader title="Log a Visit" navigation={navigation} onBack={() => setPhase('choice')} />
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Where did you go?</Text>
            <View style={styles.searchRow}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search your places…"
                placeholderTextColor={COLORS.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                blurOnSubmit={false}
              />
              {searching && <ActivityIndicator size="small" color={COLORS.gold} style={{ marginLeft: 8 }} />}
            </View>
            {searchResults.map(item => (
              <TouchableOpacity key={item.user_place_id || item.place_id} style={styles.resultRow} onPress={() => pickPlace(item)}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultMeta}>{item.category || item.cuisine || ''}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: form ──────────────────────────────────────────────────────────────
  const activeCatCount = categories.filter(c => checkedCats[c.user_place_id]).length;
  const canSave = activeCatCount > 0 && !saving;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <ScreenHeader title="Log a Visit" navigation={navigation} />
        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">

          {/* ── Place header ── */}
          <View style={styles.placeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeCardName}>{placeName}</Text>
            </View>
            <TouchableOpacity onPress={() => { setPlaceId(null); setPlaceName(''); setCategories([]); setPhase('search'); }}>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* ── 1. Categories ── */}
          <Text style={styles.sectionLabel}>Categories</Text>
          {loadingCats
            ? <ActivityIndicator color={COLORS.gold} style={{ marginBottom: 20 }} />
            : categories.length === 0
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

          {/* ── Add category inline form ── */}
          {!loadingCats && (
            showAddCat ? (
              <View style={styles.addCatForm}>
                <Text style={styles.addCatFormTitle}>Add a category</Text>

                <View style={styles.addCatPillRow}>
                  {allCategories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.addCatPill, addCatSelected?.id === cat.id && styles.addCatPillSelected]}
                      onPress={() => { setAddCatSelected(cat); setAddCatCustom(''); }}
                    >
                      <Text style={[styles.addCatPillText, addCatSelected?.id === cat.id && styles.addCatPillTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {allCategories.length === 0 && (
                    <Text style={styles.addCatEmptyNote}>All your categories are already added.</Text>
                  )}
                </View>

                <TextInput
                  style={styles.addCatInput}
                  value={addCatCustom}
                  onChangeText={t => { setAddCatCustom(t); setAddCatSelected(null); }}
                  placeholder="Or type a new category…"
                  placeholderTextColor={COLORS.textLight}
                />

                <TextInput
                  style={styles.addCatInput}
                  value={addCatCuisine}
                  onChangeText={setAddCatCuisine}
                  placeholder="Cuisine (e.g. Italian)"
                  placeholderTextColor={COLORS.textLight}
                />

                <View style={styles.addCatTierRow}>
                  {Object.entries(TIER_COLORS).map(([t, tc]) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.addCatTierChip,
                        { backgroundColor: addCatTier === t ? tc.bg : COLORS.borderLight },
                        addCatTier === t && { borderColor: COLORS.gold },
                      ]}
                      onPress={() => setAddCatTier(t)}
                    >
                      <Text style={[styles.addCatTierText, { color: addCatTier === t ? tc.text : COLORS.textMuted }]}>
                        {tc.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.addCatActions}>
                  <TouchableOpacity style={styles.addCatSaveBtn} onPress={submitAddCategory} disabled={addCatSaving}>
                    {addCatSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.addCatSaveBtnText}>Add</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addCatCancelBtn} onPress={() => setShowAddCat(false)}>
                    <Text style={styles.addCatCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addCatBtn}
                onPress={() => { setShowAddCat(true); loadAllCategories(); }}
              >
                <Text style={styles.addCatBtnText}>+ Add category</Text>
              </TouchableOpacity>
            )
          )}
          {addCatSuccessMsg ? (
            <Text style={styles.addCatSuccessMsg}>{addCatSuccessMsg}</Text>
          ) : null}

          {/* ── 2. Date ── */}
          <Text style={styles.sectionLabel}>Date</Text>
          <View style={styles.chipRow}>
            {dateChips.map(chip => (
              <TouchableOpacity
                key={chip.date}
                style={[styles.chip, selectedDate === chip.date && !customDate && styles.chipActive]}
                onPress={() => { setSelectedDate(chip.date); setCustomDate(''); }}
              >
                <Text style={[styles.chipText, selectedDate === chip.date && !customDate && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, styles.calChip, customDate && styles.chipActive]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={customDate ? COLORS.gold : COLORS.textMuted} />
              {customDate ? (
                <Text style={[styles.chipText, styles.chipTextActive]}> {formatDateDisplay(customDate)}</Text>
              ) : null}
            </TouchableOpacity>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={customDate ? new Date(customDate) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={onDateChange}
            />
          )}

          {/* ── 3. Time of day ── */}
          <Text style={styles.sectionLabel}>Time of Day</Text>
          <View style={styles.chipRow}>
            {TOD_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip.label}
                style={[styles.chip, selectedTOD === chip.label && styles.chipActive]}
                onPress={() => pickTOD(chip)}
              >
                <Text style={[styles.chipText, selectedTOD === chip.label && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.timeRow}>
            <TouchableOpacity style={styles.timeArrow} onPress={() => shiftTime(-30)}>
              <Text style={styles.timeArrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.timeDisplay}>{displayTime(timeMinutes)}</Text>
            <TouchableOpacity style={styles.timeArrow} onPress={() => shiftTime(30)}>
              <Text style={styles.timeArrowText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* ── 4. Tier per checked category ── */}
          {categories.filter(c => checkedCats[c.user_place_id]).map(cat => (
            <View key={cat.user_place_id} style={styles.tierBlock}>
              <Text style={styles.tierBlockLabel}>{cat.category} Tier</Text>
              <View style={styles.chipRow}>
                {Object.entries(TIER_COLORS).map(([t, tc]) => {
                  const active = (catTiers[cat.user_place_id] || cat.tier) === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.tierChip, { backgroundColor: active ? tc.bg : COLORS.borderLight }]}
                      onPress={() => setCatTier(cat.user_place_id, t)}
                    >
                      <Text style={[styles.tierChipText, { color: active ? tc.text : COLORS.textMuted }]}>
                        {tc.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* ── 5. Occasion ── */}
          <Text style={styles.sectionLabel}>Occasion</Text>
          <View style={styles.chipRow}>
            {OCCASIONS.map(occ => (
              <TouchableOpacity
                key={occ}
                style={[styles.chip, occasions.includes(occ) && styles.chipActive]}
                onPress={() => toggleOccasion(occ)}
              >
                <Text style={[styles.chipText, occasions.includes(occ) && styles.chipTextActive]}>{occ}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── 6. Party size ── */}
          <Text style={styles.sectionLabel}>Party Size</Text>
          <View style={styles.chipRow}>
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

          {/* ── 7. Notes ── */}
          <Text style={styles.sectionLabel}>Notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="What did you order? Any highlights?"
            placeholderTextColor={COLORS.textLight}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {/* ── 8. Total Spent ── */}
          <Text style={styles.sectionLabel}>Total Spent <Text style={styles.optional}>(optional)</Text></Text>
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

          {/* ── 9. Photos ── */}
          <Text style={styles.sectionLabel}>Photos <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.photoRow}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                >
                  <Ionicons name="close-circle" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto}>
                <Ionicons name="camera-outline" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={submit}
            disabled={!canSave}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Visit</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  body: { flex: 1, paddingHorizontal: 16 },

  // Choice screen
  choiceBody: { flex: 1, padding: 24, paddingTop: 32 },
  choiceTitle: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: COLORS.text, marginBottom: 24 },
  choiceCard: {
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 20, marginBottom: 14,
  },
  choiceCardSecondary: { borderColor: COLORS.border },
  choiceCardTitle: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text, marginBottom: 4 },
  choiceCardSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted },

  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  searchInput: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text,
  },
  resultRow: {
    backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 14, marginBottom: 8,
  },
  resultName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  resultMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Place header
  placeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.goldLight,
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.gold, padding: 14,
    marginTop: 12, marginBottom: 20,
  },
  placeCardName: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: COLORS.gold },
  changeText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.gold },

  // Section label
  sectionLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
  },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11 },
  emptyNote: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  catName: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.text },
  catCuisine: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
  },
  calChip: { flexDirection: 'row', alignItems: 'center' },
  chipActive: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold },
  chipDanger: { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.textMuted },
  chipTextActive: { color: COLORS.gold, fontFamily: 'DMSans_700Bold' },
  chipTextDanger: { color: COLORS.danger, fontFamily: 'DMSans_700Bold' },

  // Date input
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, marginBottom: 18,
  },
  inputActive: { borderColor: COLORS.gold },
  textarea: { minHeight: 80, textAlignVertical: 'top', marginBottom: 18 },

  // Time
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 16 },
  timeArrow: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white,
    borderWidth: 0.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  timeArrowText: { fontSize: 22, color: COLORS.textMuted, lineHeight: 26 },
  timeDisplay: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: COLORS.text, minWidth: 70, textAlign: 'center' },

  // Tier blocks
  tierBlock: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 14, marginBottom: 14,
  },
  tierBlockLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  tierChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  tierChipText: { fontFamily: 'DMSans_700Bold', fontSize: 13 },

  // Party size
  sizeCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sizeCircleActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  sizeText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.textMuted },
  sizeTextActive: { color: '#fff' },

  // Total spent
  spentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, marginBottom: 18,
  },
  spentPrefix: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: COLORS.text, marginRight: 4 },
  spentInput: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text,
    paddingVertical: 13, padding: 0,
  },

  // Photos
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
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

  // Add category inline form
  addCatBtn: { marginTop: 2, marginBottom: 14 },
  addCatBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.gold },
  addCatForm: {
    backgroundColor: '#FEFCE8', borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: '#D97706', marginTop: 2, marginBottom: 14,
  },
  addCatFormTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 10, color: '#713F12',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  addCatPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  addCatPill: {
    backgroundColor: '#85B7EB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  addCatPillSelected: { backgroundColor: '#042C53' },
  addCatPillText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#042C53' },
  addCatPillTextSelected: { color: '#fff' },
  addCatEmptyNote: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted },
  addCatInput: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text, marginBottom: 8,
  },
  addCatTierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  addCatTierChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  addCatTierText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  addCatSuccessMsg: {
    fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#27500A',
    backgroundColor: '#EAF3DE', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 8, marginBottom: 10,
  },
  addCatActions: { flexDirection: 'row', gap: 8 },
  addCatSaveBtn: {
    backgroundColor: COLORS.gold, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center', minWidth: 60,
  },
  addCatSaveBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#fff' },
  addCatCancelBtn: {
    borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  addCatCancelBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted },

  // Save
  saveBtn: {
    backgroundColor: COLORS.gold, borderRadius: 24, paddingVertical: 16,
    alignItems: 'center', marginTop: 12, marginBottom: 40,
  },
  saveBtnDisabled: { backgroundColor: '#e8c46a', opacity: 0.6 },
  saveBtnText: { color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 16 },
});
