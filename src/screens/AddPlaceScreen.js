import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ScreenHeader from '../components/ScreenHeader';
import GroupDecisionModal from '../components/GroupDecisionModal';
import RenameLocationsModal from '../components/RenameLocationsModal';
import { api } from '../api/client';
import { COLORS, TIER_COLORS } from '../constants/colors';
import { fetchBlendedPlaces } from '../utils/placeSearch';

const TIERS = ['S', 'A', 'B', 'C', 'NEXT_UP', 'TBE'];
const PRIMARY_NAMES = new Set(['Breakfast', 'Lunch', 'Dinner']);

// ── Geo type-ahead helpers (mirror of web tbGeoField) ───────────────────────
function geoNorm(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '').replace(/city$/, '');
}
function geoLev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[n];
}
function geoClose(a, b) {
  const na = geoNorm(a), nb = geoNorm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;                     // "New York City" ≈ "New York"
  const d = geoLev(na, nb);
  return d <= 2 && d / Math.max(na.length, nb.length) <= 0.34;
}
function geoCitySource(q) {
  return api.json('/api/places/geo-existing?type=city&q=' + encodeURIComponent(q || ''))
    .then(rows => (rows || []).map(r => ({ name: r.name, sub: r.state_name || r.country || '', data: r })))
    .catch(() => []);
}
function geoNbhdSource(q) {
  return api.json('/api/places/geo-existing?type=neighborhood&q=' + encodeURIComponent(q || ''))
    .then(rows => (rows || []).map(r => ({ name: r.name })))
    .catch(() => []);
}
// Google Places ADDRESS predictions for the manual address field. Each option's
// `data` carries the full description + a best-effort city for prefilling.
function addressSource(q) {
  const s = (q || '').trim();
  if (s.length < 3) return Promise.resolve([]);
  return api.json('/api/places/address-autocomplete?q=' + encodeURIComponent(s))
    .then(rows => (rows || []).map(r => ({ name: r.description, sub: r.secondary || '', data: r })))
    .catch(() => []);
}

// Type-ahead-with-select. Selecting an existing value is the PRIMARY action (reuses
// the exact record — "New York" → city 39, no dup); "+ Add" is the EXPLICIT
// secondary action; a close match shows a "Did you mean…?" warning. Reuses the
// cuisine-dropdown styling for consistency.
function GeoField({ value, onChange, placeholder, allowNew = true, dupWarn = false, noun = 'value',
                    fetchOptions, staticOptions, onPickItem, danger = false }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const tokenRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    if (staticOptions) {
      const ql = (value || '').toLowerCase();
      setItems(staticOptions.filter(o => (o.name || '').toLowerCase().includes(ql)).slice(0, 8));
      return;
    }
    if (!fetchOptions) return;
    const my = ++tokenRef.current;
    const t = setTimeout(() => {
      fetchOptions(value || '').then(rows => { if (my === tokenRef.current) setItems(rows || []); });
    }, 180);
    return () => clearTimeout(t);
  }, [value, open, staticOptions]);

  const ql = (value || '').toLowerCase();
  const exact = items.some(i => (i.name || '').toLowerCase() === ql);
  const near = (dupWarn && value && !exact)
    ? items.find(i => (i.name || '').toLowerCase() !== ql && geoClose(i.name, value)) : null;

  const pick = (item) => { onChange(item.name); if (onPickItem) onPickItem(item); setOpen(false); };
  const addNew = () => { if (onPickItem) onPickItem({ name: value, isNew: true }); setOpen(false); };

  return (
    <View>
      <View style={styles.cuisineInputRow}>
        <TextInput
          style={[styles.input, { marginBottom: 0, flex: 1 }, danger && { borderColor: COLORS.danger }]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          value={value}
          onChangeText={(t) => { onChange(t); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
        />
        {value ? (
          <TouchableOpacity onPress={() => onChange('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>
      {open && (items.length > 0 || (allowNew && !!value && !exact)) && (
        <View style={styles.dropdown}>
          {items.map((i, idx) => (
            <TouchableOpacity key={(i.name || '') + idx} style={styles.dropItem} onPress={() => pick(i)}>
              <Text style={styles.dropItemText}>
                {i.name}{i.sub ? <Text style={{ color: COLORS.textLight, fontSize: 11 }}>{'  '}{i.sub}</Text> : null}
              </Text>
            </TouchableOpacity>
          ))}
          {allowNew && !!value && !exact && (
            <TouchableOpacity style={styles.dropItem} onPress={addNew}>
              <Text style={[styles.dropItemText, { color: COLORS.gold, fontWeight: '600' }]}>+ Add “{value}”</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {near ? (
        <Text style={{ fontSize: 12, color: COLORS.danger, marginTop: 4 }}>
          Did you mean {near.name}? Adding “{value}” creates a new {noun}.{' '}
          <Text style={{ color: COLORS.gold, fontWeight: '600' }} onPress={() => pick(near)}>Use {near.name}</Text>
        </Text>
      ) : null}
    </View>
  );
}

export default function AddPlaceScreen({ navigation, route }) {
  const prefillName = route?.params?.placeName || '';
  const prefillGoogleId = route?.params?.googlePlaceId || '';
  const onDone = route?.params?.onDone;
  const fromActionCard = route?.params?.fromActionCard || null;
  // LV→AddPlace→LV bridge (web parity): open straight into manual entry and/or
  // return to Log a Visit with the new place_id after the add.
  const startManual = !!route?.params?.startManual;
  const continueToLogVisit = !!route?.params?.continueToLogVisit;
  const bridgeCheckinId = route?.params?.checkinId || null;

  const [step, setStep] = useState(1);
  const [query, setQuery] = useState(prefillName);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showAllCats, setShowAllCats] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false); // collapsed "create new" link
  const [cuisine, setCuisine] = useState('');
  const [cuisineSuggestions, setCuisineSuggestions] = useState([]);
  // Location-confirm fallback (shown only when the server flags it uncertain)
  const [needConfirm, setNeedConfirm] = useState(false);
  const [confirmCity, setConfirmCity] = useState('');
  const [confirmCountry, setConfirmCountry] = useState('');
  const [confirmState, setConfirmState] = useState('');
  const [confirmNeighborhood, setConfirmNeighborhood] = useState('');
  const [confirmCountries, setConfirmCountries] = useState([]);
  const [confirmStates, setConfirmStates] = useState([]);
  const [allCuisines, setAllCuisines] = useState([]);
  const [showCuisineDrop, setShowCuisineDrop] = useState(false);
  const [tier, setTier] = useState('TBE');
  const [saving, setSaving] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualNeighborhood, setManualNeighborhood] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const searchInputRef = useRef(null);
  const searchTimer = useRef(null);

  // ── Same-name "Group vs New Entry" (Phase 3) ──────────────────────────────
  const [groupConflict, setGroupConflict] = useState(null);     // conflict payload → decision modal
  // groupFlow: { mode:'group'|'new', canonicalId, conflict, phase:'create'|'optcat'|'cats',
  //   baseBody, incomingPlaceId } — null on the normal (no-conflict) path.
  const [groupFlow, setGroupFlow] = useState(null);
  const [renameRows, setRenameRows] = useState(null);           // rename modal rows (New Entry)
  const [optCatPills, setOptCatPills] = useState([]);           // existing group categories (display)

  useEffect(() => {
    loadCategories();
    loadCuisines();
    fetchLocation();
    if (prefillGoogleId && prefillName) {
      // Persona-add / LV bridge come in prefilled — still run the same-name
      // pre-check before the category step (mirrors web).
      runGroupPrecheck({ google_place_id: prefillGoogleId, name: prefillName });
    } else if (startManual) {
      setManualName(prefillName);
      setManualMode(true);
    }
  }, []);

  useEffect(() => {
    if (step === 1 && !prefillGoogleId) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [step]);

  async function fetchLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {}
  }

  async function loadCategories() {
    try {
      const data = await api.json('/api/places/users/categories');
      setCategories(data);
    } catch {}
  }

  async function loadCuisines() {
    try {
      const data = await api.json('/api/places/cuisines');
      setAllCuisines(data);
    } catch {}
  }

  useEffect(() => {
    if (query.length >= 2 && step === 1) {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => searchGooglePlaces(query), 400);
      return () => clearTimeout(searchTimer.current);
    } else {
      setResults([]);
    }
  }, [query]);

  function onCuisineChange(text) {
    setCuisine(text);
    if (text.trim().length === 0) {
      setCuisineSuggestions(allCuisines);
      setShowCuisineDrop(allCuisines.length > 0);
    } else {
      const filtered = allCuisines.filter(c =>
        c.toLowerCase().startsWith(text.toLowerCase())
      );
      setCuisineSuggestions(filtered);
      setShowCuisineDrop(filtered.length > 0);
    }
  }

  function selectCuisine(c) {
    setCuisine(c);
    setShowCuisineDrop(false);
    setCuisineSuggestions([]);
  }

  async function searchGooglePlaces(q) {
    setSearching(true);
    try {
      // Blended: your saved matches on top (highlighted), Google results below,
      // de-duped by google_place_id. DB-only saved lookup — no extra Google call.
      const data = await fetchBlendedPlaces(
        q,
        userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : {}
      );
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickPlace(place) {
    // Phase 3: same-name pre-check BEFORE the category step (replaces the old
    // app-only check-duplicate). Fail-open → normal flow; server still backstops.
    runGroupPrecheck(place);
  }

  async function runGroupPrecheck(place) {
    setGroupConflict(null);
    setGroupFlow(null);
    setNeedConfirm(false);
    try {
      let url = `/api/places/check-group-conflict?name=${encodeURIComponent(place.name || '')}`;
      if (place.google_place_id) url += `&google_place_id=${encodeURIComponent(place.google_place_id)}`;
      if (place.address) url += `&address=${encodeURIComponent(place.address)}`;
      const res = await api.json(url);
      if (res && res.conflict) {
        setSelectedPlace(place);
        setStep(2);
        setGroupConflict(res.conflict);   // opens the decision modal over step 2
        return;
      }
    } catch {}
    setSelectedPlace(place);
    setStep(2);
  }

  // Build the place-only body for a decision branch.
  function groupBaseBody(mode, conflict) {
    const p = selectedPlace || {};
    const base = {
      google_place_id: p.google_place_id || null,
      name: p.name,
      address: p.address || null,
      neighborhood: p.neighborhood || null,
      lat: p.lat, lng: p.lng,
      city: (p.manual && p.manualCity) || null,
      group_aware: true,
      place_only: true,
    };
    if (mode === 'group') base.group_with_place_id = conflict.existing.place_id;
    else base.force_new = true;
    return base;
  }

  function onDecisionGroup() {
    const base = groupBaseBody('group', groupConflict);
    setGroupFlow({ mode: 'group', canonicalId: groupConflict.existing.place_id, conflict: groupConflict, phase: 'create', baseBody: base });
    setGroupConflict(null);
    placeOnlyCreate(base, 'group', groupConflict.existing.place_id, groupConflict);
  }

  function onDecisionSeparate() {
    const base = groupBaseBody('new', groupConflict);
    setGroupFlow({ mode: 'new', canonicalId: null, conflict: groupConflict, phase: 'create', baseBody: base });
    setGroupConflict(null);
    placeOnlyCreate(base, 'new', null, groupConflict);
  }

  function onDecisionCancel() {
    setGroupConflict(null);
    setGroupFlow(null);
    navigation.goBack();
  }

  // POST a place_only create (decision branch). On need_location_confirm, reveal the
  // confirm panel (phase 'create') and the user re-submits; on success → afterPlaceOnly.
  async function placeOnlyCreate(body, mode, canonicalId, conflict) {
    setSaving(true);
    try {
      const data = await api.json('/api/places/add-mobile', { method: 'POST', body: JSON.stringify(body) });
      if (data && data.success) { afterPlaceOnly(data, mode, canonicalId, conflict, body); return; }
    } catch (e) {
      if (e.need_location_confirm) {
        const loc = e.location || {};
        setConfirmCountries(loc.countries || []);
        setConfirmStates((loc.states || []).map(s => (s && s.name) ? s.name : s));
        setConfirmCountry(loc.country || '');
        setConfirmState(loc.state || '');
        setConfirmCity(prev => prev || loc.city || '');
        setConfirmNeighborhood(prev => prev || loc.neighborhood || '');
        setNeedConfirm(true);
        if (!(loc.city || '').trim()) {
          Alert.alert('Confirm location', e.message || 'Please confirm the location for this place.');
        }
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  // Step-2 primary while in the place_only 'create' phase: merge the confirm panel
  // fields into the base body and re-submit.
  function placeOnlyResubmit() {
    if (!groupFlow) return;
    if (needConfirm && !confirmCity.trim()) {
      Alert.alert('City required', 'Please enter the city to continue.');
      return;
    }
    const confirmHasStates = ['united states', 'united states of america', 'usa', 'us']
      .includes(confirmCountry.trim().toLowerCase());
    const body = { ...groupFlow.baseBody };
    if (needConfirm) {
      body.location_confirmed = true;
      body.city = confirmCity.trim();
      body.country = confirmCountry.trim() || null;
      body.state = confirmHasStates ? (confirmState.trim() || null) : null;
      body.neighborhood = confirmNeighborhood.trim() || null;
    }
    setGroupFlow(prev => ({ ...prev, baseBody: body }));
    placeOnlyCreate(body, groupFlow.mode, groupFlow.canonicalId, groupFlow.conflict);
  }

  async function afterPlaceOnly(data, mode, canonicalId, conflict, body) {
    setNeedConfirm(false);
    if (mode === 'group') {
      // Optional add-category screen → writes on the CANONICAL.
      let pills = [];
      try {
        const cats = await api.json(`/api/places/${canonicalId}/categories-mobile`);
        pills = (cats || []).map(c => ({ category: c.category, cuisine: c.cuisine }));
      } catch {}
      setOptCatPills(pills);
      setSelectedCategory(null); setCuisine(''); setTier('TBE');
      setGroupFlow({ mode, canonicalId, conflict, phase: 'optcat', baseBody: body, incomingPlaceId: data.place_id });
    } else {
      // New Entry: rename BOTH first, then the category step for the new place.
      setRenameRows([
        { place_id: data.place_id, display_name: body.name, address: body.address || '' },
        { place_id: conflict.existing.place_id, display_name: conflict.existing.display_name, address: conflict.existing.address || '' },
      ]);
      setGroupFlow({ mode, canonicalId, conflict, phase: 'rename', baseBody: body, incomingPlaceId: data.place_id });
    }
  }

  function onRenameDone() {
    setRenameRows(null);
    setSelectedCategory(null); setCuisine(''); setTier('TBE');
    setGroupFlow(prev => prev ? { ...prev, phase: 'cats' } : prev);
  }

  // Group optional category → add ONE category on the canonical.
  async function submitOptCat() {
    if (!selectedCategory?.id) { Alert.alert('Category required', 'Pick a category or tap Skip.'); return; }
    if (!cuisine.trim()) { Alert.alert('Cuisine required', 'Please enter a cuisine.'); return; }
    setSaving(true);
    try {
      await api.json(`/api/places/${groupFlow.canonicalId}/add-category-mobile`, {
        method: 'POST',
        body: JSON.stringify({ category_id: selectedCategory.id, cuisine: cuisine.trim(), tier }),
      });
      finishGroup();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  function finishGroup() {
    const incomingPlaceId = groupFlow?.incomingPlaceId;
    const nm = selectedPlace?.name;
    setGroupFlow(null);
    setOptCatPills([]);
    if (continueToLogVisit && incomingPlaceId) {
      navigation.replace('LogVisit', { placeId: incomingPlaceId, placeName: nm, checkinId: bridgeCheckinId, fromActionCard });
      return;
    }
    Alert.alert('Grouped!', `${nm} is now linked as another location.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  // Step-2 primary dispatcher (normal save vs the group-flow phases).
  function onStep2Primary() {
    if (groupFlow) {
      if (groupFlow.phase === 'create') return placeOnlyResubmit();
      if (groupFlow.phase === 'optcat') return submitOptCat();
      // phase 'cats' → fall through to the normal save (adds the new place's categories).
    }
    return save();
  }

  function openManual() {
    setManualName(prev => (prev && prev.trim()) ? prev : query.trim());
    setManualMode(true);
  }

  function continueManual() {
    const name = manualName.trim();
    if (!name) { Alert.alert('Name required', 'Please enter a place name.'); return; }
    // City required for manual entry — resolves the location in ONE pass so the
    // confirm panel never re-asks in step 2.
    const city = manualCity.trim();
    if (!city) { Alert.alert('City required', 'Please enter the city.'); return; }
    // Manual place: no Google place_id — saved with NULL gpid server-side.
    setSelectedPlace({
      google_place_id: null,
      name,
      address: manualAddress.trim(),
      neighborhood: manualNeighborhood.trim(),
      lat: null,
      lng: null,
      manual: true,
      manualCity: city,
    });
    setStep(2);
  }

  async function createNewCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const data = await api.json('/api/places/users/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const newCat = { id: data.id, name, is_primary: false };
      setCategories(prev => [...prev, newCat]);
      setSelectedCategory(newCat);
      setNewCategoryName('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function save() {
    if (!selectedPlace) return;
    // Category is mandatory (B2) — same canonical copy as web + server.
    if (!selectedCategory?.id) {
      Alert.alert('Category required', 'Please select a category.');
      return;
    }
    if (!cuisine.trim()) {
      Alert.alert('Cuisine required', 'Please enter a cuisine before saving.');
      return;
    }
    // Once the confirm step is showing, City is the one hard-required field.
    if (needConfirm && !confirmCity.trim()) {
      Alert.alert('City required', 'Please enter the city to continue.');
      return;
    }
    const confirmHasStates = ['united states', 'united states of america', 'usa', 'us']
      .includes(confirmCountry.trim().toLowerCase());
    setSaving(true);
    try {
      const body = {
        google_place_id: selectedPlace.google_place_id,
        name: selectedPlace.name,
        address: selectedPlace.address,
        neighborhood: selectedPlace.neighborhood || null,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        categories: [{ category_id: selectedCategory?.id || null, tier, cuisine: cuisine.trim() || null }],
        cuisine: cuisine.trim(),   // kept top-level for backward-compat
        // Phase 3: opt into the same-name guard (server only returns
        // need_group_decision when group_aware is set).
        group_aware: true,
      };
      // New-Entry category step: the place already exists (place_only create) —
      // force_new suppresses the guard so this just adds the user_places rows.
      if (groupFlow && groupFlow.mode === 'new' && groupFlow.phase === 'cats') {
        body.force_new = true;
      }
      if (needConfirm) {
        body.location_confirmed = true;
        body.city = confirmCity.trim();
        body.country = confirmCountry.trim() || null;
        // State is the full name ("New York"); the server stores the 2-letter code.
        body.state = confirmHasStates ? (confirmState.trim() || null) : null;
        body.neighborhood = confirmNeighborhood.trim() || null;
      } else if (selectedPlace.manual && selectedPlace.manualCity) {
        // Manual entry: send the typed city/neighborhood WITHOUT location_confirmed —
        // the confirm panel now ALWAYS shows once (server rule), prefilled with these
        // plus the server-derived neighborhood (NYC NTA polygon only; blank elsewhere).
        body.city = selectedPlace.manualCity;
        body.neighborhood = selectedPlace.neighborhood || null;
      }
      const data = await api.json('/api/places/add-mobile', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // Fail-open backstop: if the pre-check missed a conflict, the server returns
      // this (HTTP 200) → open the decision dialog instead of finishing the add.
      if (data.need_group_decision) {
        setGroupConflict(data.conflict);
        return;
      }

      const isRankedTier = ['S', 'A', 'B', 'C'].includes(tier);

      if (continueToLogVisit) {
        // Bridge back to Log a Visit with the freshly-created place (web's
        // LV→AddPlace→LV flow). fromActionCard rides through so LogVisit
        // completes the action card after the visit saves; pairwise (if any)
        // runs after the visit via afterSaveNav, same as the alert path below.
        navigation.replace('LogVisit', {
          placeId: data.place_id,
          placeName: selectedPlace.name,
          checkinId: bridgeCheckinId,
          fromActionCard,
          afterSaveNav: data.pairwise_data
            ? { screen: 'Pairwise', params: { newId: data.pairwise_data.new_id, category: data.pairwise_data.category } }
            : null,
        });
        return;
      }

      if (fromActionCard) {
        navigation.navigate('Home', { actionCompleted: fromActionCard });
        return;
      }
      if (onDone) {
        onDone();
        return;
      }

      if (isRankedTier) {
        const pairwiseParams = data.pairwise_data
          ? { screen: 'Pairwise', params: { newId: data.pairwise_data.new_id, category: data.pairwise_data.category } }
          : null;
        Alert.alert(
          'Place added!',
          `Did you visit ${selectedPlace.name} recently?`,
          [
            {
              text: 'Log a Visit',
              onPress: () => navigation.replace('LogVisit', {
                placeId: data.place_id,
                placeName: selectedPlace.name,
                afterSaveNav: pairwiseParams,
              }),
            },
            {
              text: 'Not now',
              onPress: () => {
                if (pairwiseParams) {
                  navigation.replace(pairwiseParams.screen, pairwiseParams.params);
                } else {
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else if (data.pairwise_data) {
        navigation.replace('Pairwise', {
          newId: data.pairwise_data.new_id,
          category: data.pairwise_data.category,
        });
      } else {
        Alert.alert('Added!', `${selectedPlace.name} has been added to your list.`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      // Uncertain location: reveal the confirm panel pre-filled with whatever
      // the server could extract; user completes it and saves again.
      if (e.need_location_confirm) {
        const loc = e.location || {};
        setConfirmCountries(loc.countries || []);
        // states arrive as [{code, name}] — show the full names.
        setConfirmStates((loc.states || []).map(s => (s && s.name) ? s.name : s));
        setConfirmCountry(loc.country || '');
        setConfirmState(loc.state || '');   // already the full name from the server
        setConfirmCity(prev => prev || loc.city || '');
        setConfirmNeighborhood(prev => prev || loc.neighborhood || '');
        setNeedConfirm(true);
        // The panel now shows on EVERY add (server rule), prefilled — only alert
        // when the user actually has to type something (no city resolved).
        if (!(loc.city || '').trim()) {
          Alert.alert('Confirm location', e.message || 'Please confirm the location for this place.');
        }
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const primaryCats = categories.filter(c => c.is_primary || PRIMARY_NAMES.has(c.name));
  const extraCats = categories.filter(c => !c.is_primary && !PRIMARY_NAMES.has(c.name));
  const visibleCats = showAllCats ? categories : primaryCats;
  // Category/cuisine/tier hide during the place_only 'create' phase (location-confirm
  // only); show on the normal add, the group optional-category, and New-Entry category.
  const showCatSection = !groupFlow || groupFlow.phase === 'optcat' || groupFlow.phase === 'cats';
  const primaryLabel = groupFlow && groupFlow.phase === 'optcat' ? 'Add category'
    : (groupFlow && groupFlow.phase === 'create' ? 'Confirm & continue' : 'Add to My Places');

  // ── Step 1: Search ──────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <ScreenHeader title="Add a Place" navigation={navigation} />
          <View style={styles.body}>
            <Text style={styles.sectionLabel}>Search for a restaurant</Text>
            <View style={styles.searchRow}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="e.g. Lilia, NYC"
                placeholderTextColor={COLORS.textLight}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator size="small" color={COLORS.gold} style={{ marginLeft: 8 }} />}
            </View>
            {manualMode ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.sectionLabel}>Place name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Restaurant name"
                  placeholderTextColor={COLORS.textLight}
                  value={manualName}
                  onChangeText={setManualName}
                  autoCorrect={false}
                />
                <Text style={styles.sectionLabel}>Address</Text>
                <GeoField
                  value={manualAddress}
                  onChange={setManualAddress}
                  placeholder="Start typing the address"
                  fetchOptions={addressSource}
                  allowNew={false}
                  onPickItem={(item) => {
                    const d = item?.data || {};
                    if (d.description) setManualAddress(d.description);
                    // Prefill city from the picked address (resolved/deduped at
                    // save via resolve_city); don't clobber a city already typed.
                    if (d.city) setManualCity((prev) => (prev && prev.trim() ? prev : d.city));
                  }}
                />
                <Text style={styles.sectionLabel}>City <Text style={styles.required}>*</Text></Text>
                <GeoField
                  value={manualCity}
                  onChange={setManualCity}
                  placeholder="Start typing — pick an existing city"
                  fetchOptions={geoCitySource}
                  allowNew dupWarn noun="city" danger
                />
                <Text style={styles.sectionLabel}>Neighborhood <Text style={styles.optional}>(optional)</Text></Text>
                <GeoField
                  value={manualNeighborhood}
                  onChange={setManualNeighborhood}
                  placeholder="e.g. Williamsburg"
                  fetchOptions={geoNbhdSource}
                  allowNew dupWarn noun="neighborhood"
                />
                <Text style={styles.manualHint}>
                  We'll save this place without Google data — you can rank and log it like any other.
                </Text>
                <TouchableOpacity style={styles.saveBtn} onPress={continueManual}>
                  <Text style={styles.saveBtnText}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.manualBack} onPress={() => setManualMode(false)}>
                  <Text style={styles.showMoreText}>Back to search</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item, i) => item.google_place_id || String(i)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.resultRow, item.already_saved && styles.resultRowSaved]}
                    onPress={() => pickPlace(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{item.name}</Text>
                      <Text style={styles.resultAddr}>{item.address || item.vicinity || ''}</Text>
                    </View>
                    {item.already_saved && (
                      <View style={styles.savedBadge}>
                        <Text style={styles.savedBadgeText}>In your list</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={
                  <TouchableOpacity style={styles.manualToggle} onPress={openManual}>
                    <Text style={styles.manualToggleText}>Can't find it? Add it manually</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: Details ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <ScreenHeader title="Add a Place" navigation={navigation} onBack={() => setStep(1)} />
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          {/* Selected place */}
          <View style={styles.selectedCard}>
            <Text style={styles.selectedName}>{selectedPlace?.name}</Text>
            {selectedPlace?.address ? <Text style={styles.selectedAddr}>{selectedPlace.address}</Text> : null}
          </View>

          {/* Group optional-category note — what's already tracked (read-only pills). */}
          {groupFlow && groupFlow.phase === 'optcat' ? (
            <View style={styles.optCatNote}>
              <Text style={styles.optCatNoteLead}>You already track these for this Place:</Text>
              <View style={styles.optCatPills}>
                {optCatPills.length ? optCatPills.map((p, i) => (
                  <View key={i} style={styles.optCatPair}>
                    {p.category ? <View style={styles.catPill}><Text style={styles.catPillText}>{p.category}</Text></View> : null}
                    {p.cuisine ? <View style={styles.cuiPill}><Text style={styles.cuiPillText}>{p.cuisine}</Text></View> : null}
                  </View>
                )) : <Text style={styles.optCatNoteLead}>None yet</Text>}
              </View>
              <Text style={styles.optCatNoteTail}>Would you like to add more Categories?</Text>
            </View>
          ) : null}

          {showCatSection ? (
          <>
          {/* Category */}
          <Text style={styles.sectionLabel}>1. Select a Category</Text>
          <View style={styles.chipRow}>
            {visibleCats.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, selectedCategory?.id === cat.id && styles.chipActive]}
                onPress={() => setSelectedCategory(selectedCategory?.id === cat.id ? null : cat)}
              >
                <Text style={[styles.chipText, selectedCategory?.id === cat.id && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {extraCats.length > 0 && !showAllCats && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllCats(true)}>
              <Text style={styles.showMoreText}>Show more ({extraCats.length})</Text>
            </TouchableOpacity>
          )}
          {showNewCatInput ? (
            <View style={styles.newCatRow}>
              <TextInput
                style={styles.newCatInput}
                placeholder="New category name…"
                placeholderTextColor={COLORS.textLight}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                onSubmitEditing={createNewCategory}
                returnKeyType="done"
                blurOnSubmit={false}
                autoFocus
              />
              {newCategoryName.trim().length > 0 && (
                <TouchableOpacity style={styles.newCatBtn} onPress={createNewCategory}>
                  <Text style={styles.newCatBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setShowNewCatInput(true); setSelectedCategory(null); }} style={styles.newCatLink}>
              <Text style={styles.newCatLinkText}>or create a new category</Text>
            </TouchableOpacity>
          )}

          {/* Cuisine */}
          <Text style={styles.sectionLabel}>2. Select a Cuisine <Text style={styles.required}>*</Text></Text>
          <View>
            <View style={styles.cuisineInputRow}>
              <TextInput
                style={[styles.input, { marginBottom: 0, flex: 1 }]}
                placeholder="e.g. Italian, Japanese"
                placeholderTextColor={COLORS.textLight}
                value={cuisine}
                onChangeText={onCuisineChange}
                onFocus={() => {
                  setCuisineSuggestions(cuisine.trim() ? cuisineSuggestions : allCuisines);
                  setShowCuisineDrop(allCuisines.length > 0);
                }}
                onBlur={() => setTimeout(() => setShowCuisineDrop(false), 150)}
                autoCorrect={false}
                returnKeyType="done"
              />
              {cuisine.trim().length > 0 && (
                <TouchableOpacity onPress={() => { setCuisine(''); setShowCuisineDrop(false); }} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              )}
            </View>
            {showCuisineDrop && cuisineSuggestions.length > 0 && (
              <View style={styles.dropdown}>
                {cuisineSuggestions.map(c => (
                  <TouchableOpacity key={c} style={styles.dropItem} onPress={() => selectCuisine(c)}>
                    <Text style={styles.dropItemText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          </>
          ) : null}

          {/* Location confirm — ALWAYS shown on a new add (server returns
              need_location_confirm on the first request and commits only on the
              resubmit). Calm confirmation, not an error. City is the one hard-
              required field; country defaults from the address; state is
              US-only/optional; neighborhood is NYC-only prefill, blank elsewhere. */}
          {needConfirm && (
            <View>
              <View style={styles.confirmBanner}>
                <Text style={styles.confirmBannerTitle}>Confirm the city & neighborhood</Text>
                <Text style={styles.confirmBannerText}>Looks right?</Text>
              </View>
              <Text style={styles.sectionLabel}>Country</Text>
              <GeoField
                value={confirmCountry}
                onChange={setConfirmCountry}
                placeholder="Start typing a country"
                staticOptions={confirmCountries.map(c => ({ name: c }))}
                allowNew noun="country"
              />
              {['united states', 'united states of america', 'usa', 'us'].includes(confirmCountry.trim().toLowerCase()) && (
                <>
                  <Text style={styles.sectionLabel}>State</Text>
                  <GeoField
                    value={confirmState}
                    onChange={setConfirmState}
                    placeholder="Start typing a state"
                    staticOptions={confirmStates.map(s => ({ name: s }))}
                    allowNew={false} noun="state"
                  />
                </>
              )}
              <Text style={styles.sectionLabel}>City <Text style={styles.required}>*</Text></Text>
              <GeoField
                value={confirmCity}
                onChange={setConfirmCity}
                placeholder="Start typing — pick an existing city"
                fetchOptions={geoCitySource}
                allowNew dupWarn noun="city" danger
                onPickItem={(item) => {
                  // Selecting an existing city auto-fills its country/state (dedup).
                  if (item && !item.isNew && item.data) {
                    if (item.data.country) setConfirmCountry(item.data.country);
                    if (item.data.state_name) setConfirmState(item.data.state_name);
                  }
                }}
              />
              <Text style={styles.sectionLabel}>Neighborhood <Text style={styles.optional}>(optional)</Text></Text>
              <GeoField
                value={confirmNeighborhood}
                onChange={setConfirmNeighborhood}
                placeholder="e.g. Williamsburg"
                fetchOptions={geoNbhdSource}
                allowNew dupWarn noun="neighborhood"
              />
            </View>
          )}

          {/* Tier */}
          {showCatSection ? (
          <>
          <Text style={styles.sectionLabel}>Initial Tier</Text>
          <View style={styles.chipRow}>
            {TIERS.map(t => {
              const tc = TIER_COLORS[t];
              const active = tier === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tierChip, { backgroundColor: active ? tc.bg : COLORS.borderLight, borderColor: active ? tc.text : 'transparent' }]}
                  onPress={() => setTier(t)}
                >
                  <Text style={[styles.tierChipText, { color: active ? tc.text : COLORS.textMuted }]}>{tc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </>
          ) : null}

          <TouchableOpacity style={styles.saveBtn} onPress={onStep2Primary} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{primaryLabel}</Text>
            }
          </TouchableOpacity>
          {groupFlow && groupFlow.phase === 'optcat' ? (
            <TouchableOpacity style={styles.skipBtn} onPress={finishGroup} disabled={saving}>
              <Text style={styles.skipBtnText}>Skip — don’t add a category</Text>
            </TouchableOpacity>
          ) : null}

          {/* Same-name decision + rename (Phase 3) */}
          <GroupDecisionModal
            visible={!!groupConflict}
            conflict={groupConflict}
            incomingAddress={selectedPlace?.address}
            onGroup={onDecisionGroup}
            onSeparate={onDecisionSeparate}
            onCancel={onDecisionCancel}
          />
          <RenameLocationsModal
            visible={!!renameRows}
            rows={renameRows}
            onDone={onRenameDone}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  body: { padding: 16, paddingBottom: 60 },
  sectionLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 20,
  },
  required: { color: '#E24B4A', textTransform: 'none' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 14, marginBottom: 8,
  },
  // Already-saved places: S-tier cream tint + gold outline (locked tokens).
  resultRowSaved: { backgroundColor: COLORS.goldLight, borderWidth: 1, borderColor: COLORS.gold },
  savedBadge: {
    backgroundColor: COLORS.gold, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0,
  },
  savedBadgeText: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: '#fff' },
  resultName: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  resultAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  selectedCard: {
    backgroundColor: COLORS.goldLight, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.gold, padding: 14, marginBottom: 4, marginTop: 8,
  },
  selectedName: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: COLORS.gold },
  selectedAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.textMuted },
  chipTextActive: { color: COLORS.gold, fontFamily: 'DMSans_700Bold' },
  showMoreBtn: { marginBottom: 10 },
  showMoreText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.gold },
  // Collapsed "or create a new category" — subtle brand-gold link.
  newCatLink: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8 },
  newCatLinkText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.gold },
  newCatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  newCatInput: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 11,
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text,
  },
  newCatBtn: {
    backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11,
  },
  newCatBtnText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 14 },
  cuisineInputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13,
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, marginBottom: 4,
  },
  clearBtn: { position: 'absolute', right: 12 },
  dropdown: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, marginTop: 4, overflow: 'hidden',
  },
  dropItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  dropItemText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text },
  tierChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    marginRight: 8, marginBottom: 8, borderWidth: 1.5,
  },
  tierChipText: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  saveBtn: {
    backgroundColor: COLORS.gold, borderRadius: 24, paddingVertical: 16,
    alignItems: 'center', marginTop: 32, marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 16 },
  skipBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 28 },
  skipBtnText: { color: COLORS.textMuted, fontFamily: 'DMSans_500Medium', fontSize: 14 },
  // Group optional-category note (Phase 3) — yellow box + Category/Cuisine pills.
  optCatNote: { backgroundColor: COLORS.confirmBg, borderRadius: 12, padding: 12, marginBottom: 16 },
  optCatNoteLead: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.confirmText, marginBottom: 8 },
  optCatNoteTail: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.confirmText, marginTop: 4 },
  optCatPills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 },
  optCatPair: { flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 6 },
  catPill: { backgroundColor: COLORS.pillCatBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginRight: 5 },
  catPillText: { color: COLORS.pillCatText, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  cuiPill: { backgroundColor: COLORS.pillCuiBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  cuiPillText: { color: COLORS.pillCuiText, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  optional: { color: COLORS.textMuted, textTransform: 'none', fontFamily: 'DMSans_400Regular' },
  manualToggle: { paddingVertical: 14, alignItems: 'center' },
  manualToggleText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.gold },
  manualHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 10 },
  manualBack: { alignItems: 'center', marginTop: 12 },
  confirmBanner: { backgroundColor: COLORS.confirmBg, borderRadius: 10, padding: 10, marginTop: 12, marginBottom: 2 },
  confirmBannerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.confirmText, marginBottom: 2 },
  confirmBannerText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.confirmText },
});
