import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import { api } from '../../api/client';
import { COLORS, TIER_COLORS } from '../../constants/colors';

// Onboarding redesign (Part 2) — screen (f), THE centerpiece. All paths converge
// here: kept calendar imports, kept text-list imports, and manual adds all arrive
// UNRANKED (ranked_at IS NULL) and get tiered.
//
// 6 zones: Up→S, Up-left→B, Up-right→A, Down-left→TBE, Down→C, Down-right→Next Up.
// Laid out as a top row [B · S · A] and bottom row [TBE · C · Next Up] around a
// draggable tile. Tappable zones are the reliable interaction; pan/flick toward a
// zone is the delight. EVERY placement (incl. a TBE drop) calls /set-tiers so
// ranked_at is stamped — never skip, or /complete 409s. Mandatory: can't finish
// while any tile is un-placed. Resume re-fetches /pending-rank.

const TOP = ['B', 'S', 'A'];        // left, center, right
const BOTTOM = ['TBE', 'C', 'NEXT_UP'];
const SUBS = { S: 'The best', A: 'Love it', B: 'Like it', C: 'It’s okay', NEXT_UP: 'Soon', TBE: 'Want to go' };
const FLICK_DIST = 90;

// y-down vector → tier (matches the zone layout). Two "gap" directions (pure left/
// right) resolve by vertical sign.
function tierForVector(tx, ty) {
  const deg = (Math.atan2(ty, tx) * 180) / Math.PI; // -180..180
  if (deg >= -112.5 && deg < -67.5) return 'S';
  if (deg >= -157.5 && deg < -112.5) return 'B';
  if (deg >= -67.5 && deg < -22.5) return 'A';
  if (deg >= 67.5 && deg < 112.5) return 'C';
  if (deg >= 112.5 && deg < 157.5) return 'TBE';
  if (deg >= 22.5 && deg < 67.5) return 'NEXT_UP';
  if (deg >= -22.5 && deg < 22.5) return ty < 0 ? 'A' : 'NEXT_UP';
  return ty < 0 ? 'B' : 'TBE';
}

export default function OnboardingTileRankerScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const category = route.params?.category || null;   // header label + thread on additional passes
  const [queue, setQueue] = useState([]);     // unranked places
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingCuisine, setEditingCuisine] = useState(false);
  const [cuisineDraft, setCuisineDraft] = useState('');
  const [editingCategory, setEditingCategory] = useState(false);
  const [catOptions, setCatOptions] = useState([]);   // [{id, name}] the user's categories
  const placedRef = useRef([]);               // [{user_place_id, tier}]

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => { loadPending(); }, []);

  async function loadPending() {
    try {
      const data = await api.json('/api/onboarding/pending-rank');
      setQueue(data.places || []);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
    // Category options for inline editing (id required by the mobile patch endpoint).
    try {
      const cs = await api.json('/api/places/categories-summary');
      const opts = [...(cs.primary || []), ...(cs.user_added || [])]
        .filter(c => c && c.id)
        .map(c => ({ id: c.id, name: c.name }));
      setCatOptions(opts);
    } catch { /* editing falls back to display-only */ }
  }

  async function saveCategory(catId, catName) {
    const place = queue[index];
    setEditingCategory(false);
    if (!place || !catId) return;
    setQueue(prev => prev.map((p, i) => (i === index ? { ...p, category: catName, category_id: catId } : p)));
    try {
      await api.patch(`/api/places/user-place/${place.user_place_id}/mobile`, { category_id: catId });
    } catch { /* non-fatal */ }
  }

  const current = queue[index];

  // Assign the current tile to a tier — stamps ranked_at via /set-tiers (every
  // tile, incl. TBE). Optimistic advance keeps it fast.
  function assign(tier) {
    const place = queue[index];
    if (!place) return;
    Vibration.vibrate(25);
    placedRef.current.push({ user_place_id: place.user_place_id, tier });
    tx.value = 0; ty.value = 0;
    setEditingCuisine(false);
    setEditingCategory(false);

    api.json('/api/onboarding/set-tiers', {
      method: 'POST',
      body: JSON.stringify([{ user_place_id: place.user_place_id, tier }]),
    }).catch(() => { /* /complete 409 backstop catches any lost stamp */ });

    const next = index + 1;
    if (next >= queue.length) finishRanking();
    else setIndex(next);
  }

  async function finishRanking() {
    const sList = placedRef.current
      .filter(p => p.tier === 'S')
      .map(p => {
        const q = queue.find(x => x.user_place_id === p.user_place_id);
        return { user_place_id: p.user_place_id, name: q ? q.name : '' };
      });
    // Conditional cuisine-confirm only surfaces places still missing a cuisine
    // (most imports already carry an AI guess; the tile let the user fix others).
    const needCuisine = queue
      .filter(p => !p.cuisine)
      .map(p => ({ user_place_id: p.user_place_id, place_id: p.place_id, name: p.name }));
    const step = sList.length ? 5 : 6;
    try { await api.patch('/api/onboarding/profile', { onboarding_step: step }); } catch { /* best-effort */ }
    if (sList.length) {
      // S-tier ordering runs next; STier returns into the conditional Cuisine step.
      navigation.navigate('STier', {
        city, fromRanker: true, next: 'Cuisine', sTierPlaces: sList,
        nextParams: { needCuisine, category },
      });
    } else {
      navigation.navigate('Cuisine', { city, fromRanker: true, needCuisine, category });
    }
  }

  async function saveCuisine() {
    const place = queue[index];
    const val = cuisineDraft.trim();
    setEditingCuisine(false);
    if (!place || val === (place.cuisine || '')) return;
    setQueue(prev => prev.map((p, i) => (i === index ? { ...p, cuisine: val } : p)));
    try {
      await api.json('/api/onboarding/set-cuisine', {
        method: 'POST',
        body: JSON.stringify([{ user_place_id: place.user_place_id, cuisine: val }]),
      });
    } catch { /* non-fatal */ }
  }

  // tierForVector is a plain JS fn, so resolve the tier on the JS thread (a worklet
  // can't call it directly). The spring-back stays on the UI thread.
  function commitVector(dx, dy) {
    assign(tierForVector(dx, dy));
  }

  const pan = Gesture.Pan()
    .onUpdate(e => { tx.value = e.translationX; ty.value = e.translationY; })
    .onEnd(e => {
      const dist = Math.sqrt(e.translationX * e.translationX + e.translationY * e.translationY);
      if (dist > FLICK_DIST) {
        runOnJS(commitVector)(e.translationX, e.translationY);
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!current) {
    // Nothing pending (e.g. resumed after finishing) — move on.
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.doneText}>All ranked! 🎉</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={finishRanking}>
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const remaining = queue.length - index;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{category ? `Rank your ${category}` : 'Where does it rank?'}</Text>
        <Text style={styles.counter}>{remaining} to go</Text>
      </View>

      {/* TOP ROW: B · S · A */}
      <View style={styles.zoneRow}>
        {TOP.map(t => <Zone key={t} tier={t} onPress={() => assign(t)} />)}
      </View>

      {/* THE TILE */}
      <View style={styles.tileArea}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.tile, tileStyle]}>
            <Text style={styles.tileName} numberOfLines={2}>{current.name}</Text>
            {current.address ? (
              <Text style={styles.tileAddr} numberOfLines={1}>{current.address}</Text>
            ) : null}
            {editingCategory ? (
              <View style={styles.catPicker}>
                {catOptions.map(o => (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.catOpt, current.category === o.name && styles.catOptActive]}
                    onPress={() => saveCategory(o.id, o.name)}
                  >
                    <Text style={[styles.catOptText, current.category === o.name && styles.catOptTextActive]}>{o.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.tilePills}>
                <TouchableOpacity onPress={() => catOptions.length && setEditingCategory(true)}>
                  <View style={styles.catPill}>
                    <Text style={styles.catPillText}>{current.category || '+ category'}</Text>
                  </View>
                </TouchableOpacity>
                {editingCuisine ? (
                  <TextInput
                    style={styles.cuisineInput}
                    value={cuisineDraft}
                    onChangeText={setCuisineDraft}
                    autoFocus
                    onBlur={saveCuisine}
                    onSubmitEditing={saveCuisine}
                    placeholder="cuisine"
                    placeholderTextColor={COLORS.textLight}
                    returnKeyType="done"
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => { setCuisineDraft(current.cuisine || ''); setEditingCuisine(true); }}
                  >
                    <View style={styles.cuiPill}>
                      <Text style={styles.cuiPillText}>{current.cuisine || '+ cuisine'}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text style={styles.tileHint}>Tap to edit · tap a tier or flick toward it</Text>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* BOTTOM ROW: TBE · C · Next Up */}
      <View style={styles.zoneRow}>
        {BOTTOM.map(t => <Zone key={t} tier={t} onPress={() => assign(t)} />)}
      </View>
    </SafeAreaView>
  );
}

function Zone({ tier, onPress }) {
  const tc = TIER_COLORS[tier];
  return (
    <TouchableOpacity
      style={[styles.zone, { backgroundColor: tc.bg, borderColor: tc.text }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.zoneLabel, { color: tc.text }]}>{tc.label}</Text>
      <Text style={[styles.zoneSub, { color: tc.text }]}>{SUBS[tier]}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: COLORS.text },
  counter: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.gold },
  zoneRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  zone: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  zoneLabel: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  zoneSub: { fontFamily: 'DMSans_400Regular', fontSize: 10, marginTop: 2, opacity: 0.85 },
  tileArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  tile: {
    width: '88%', backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, paddingVertical: 28, paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  tileName: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: COLORS.text, textAlign: 'center' },
  tileAddr: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  tilePills: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
  catPill: { backgroundColor: COLORS.pillCatBg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  catPillText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.pillCatText },
  cuiPill: { backgroundColor: COLORS.pillCuiBg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  cuiPillText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.pillCuiText },
  catPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, justifyContent: 'center' },
  catOpt: { borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  catOptActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldLight },
  catOptText: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: COLORS.textMuted },
  catOptTextActive: { color: COLORS.tierSText, fontFamily: 'DMSans_700Bold' },
  cuisineInput: {
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.gold,
    paddingHorizontal: 12, paddingVertical: 5, fontFamily: 'DMSans_500Medium', fontSize: 13,
    minWidth: 110, color: COLORS.text,
  },
  tileHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight, marginTop: 18 },
  doneText: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: COLORS.text },
  primaryBtn: { backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
