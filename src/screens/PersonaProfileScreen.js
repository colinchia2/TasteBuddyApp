// Tastie Persona profile — STACKED app layout (Prompt 4).
// One call to GET /api/persona/<userId> (the shared assembler + taste_dna) feeds
// every section; data/labels match the web /u/<username> page exactly (same
// backend builder — no second source of truth). Rule 9: all dates arrive as
// pre-formatted naive-local strings — never run them through new Date().
// The hero's tagline slot is INTENTIONALLY EMPTY (the Hero prompt fills it
// with the archetype headline + AI subtitle — build nothing there).
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Dimensions,
} from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import TasteDnaRadar from '../components/TasteDnaRadar';
import { COLORS, TIER_COLORS } from '../constants/colors';
import { api, BASE_URL } from '../api/client';

// storage_url is used AS-IS (never concatenate paths) — relative URLs just get
// the API host prefixed, same idiom as EditVisitScreen.
const absUrl = (u) => (u && u.startsWith('http') ? u : `${BASE_URL}${u}`);

// Recent-photos row: non-scrolling, show only as many thumbs as fit the card
// width (card = 14 margin + 16 padding each side = 60; thumb 108 + 8 gap).
const RECENT_THUMB = 108, RECENT_GAP = 8;
const RECENT_FIT = Math.max(1, Math.floor(
  (Dimensions.get('window').width - 60 + RECENT_GAP) / (RECENT_THUMB + RECENT_GAP)));

function TierBadge({ tier, label, small }) {
  const c = TIER_COLORS[tier] || { bg: COLORS.tierTBE, text: COLORS.tierTBEText };
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 20,
                   paddingHorizontal: small ? 7 : 9, paddingVertical: small ? 1 : 2 }}>
      <Text style={{ color: c.text, fontSize: small ? 9 : 11, fontFamily: 'DMSans_500Medium' }}>
        {label || tier}
      </Text>
    </View>
  );
}

export default function PersonaProfileScreen({ navigation, route }) {
  const userId = route?.params?.userId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.json(`/api/persona/${userId}`)
      .then((d) => { if (alive) setProfile(d); })
      .catch((e) => { if (alive) setError(e.status === 404 ? 'This profile is private or doesn’t exist.' : 'Couldn’t load this profile.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Tastie Persona" navigation={navigation} />
        <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 60 }} />
      </View>
    );
  }
  if (error || !profile) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Tastie Persona" navigation={navigation} />
        <Text style={styles.errorText}>{error || 'Couldn’t load this profile.'}</Text>
      </View>
    );
  }

  const { identity, tastie, micro_stats, top_cuisines, top_categories,
          top_places, recent_checkins, recent_photos = [], highlights,
          ai_chips, taste_dna } = profile;
  const first = (identity.display_name || '').split(' ')[0];

  const askWithPrompt = (prompt) =>
    navigation.navigate('Home', {
      personaAsk: { id: identity.user_id, name: identity.display_name, prompt },
    });

  return (
    <View style={styles.container}>
      <ScreenHeader title={`${identity.display_name}'s Persona`} navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero Taste Card (collectible): seal · rank · name · radar · lean ·
            stats. Replaces the old hero band AND the standalone Taste DNA card —
            every value appears ONCE, here. Solid warm fill ≈ the web gold
            gradient (real gradient bg deferred — REMINDER_app_gradient_upgrade.md). */}
        <View style={styles.tasteCard}>
          {/* Score seal (corner badge) */}
          <View style={styles.seal}>
            <Text style={styles.sealNum}>{tastie.score}</Text>
            <Text style={styles.sealLabel}>SCORE</Text>
          </View>
          {/* Rank headline (Hero-swappable archetype slot) + name */}
          <Text style={styles.cardRank}>{tastie.rank_title || tastie.label}</Text>
          <Text style={styles.cardName}>{identity.display_name}</Text>
          {identity.vibe_tag ? <Text style={styles.cardVibe}>{identity.vibe_tag}</Text> : null}
          {/* TAGLINE SLOT — Hero prompt fills the archetype subtitle here. */}
          {taste_dna ? <TasteDnaRadar dna={taste_dna} size={300} /> : null}
          {/* Footer stats */}
          <View style={styles.cardStats}>
            {[['Visits', micro_stats.visits], ['Places', micro_stats.places],
              ['Cuisines', micro_stats.cuisines], ['Categories', micro_stats.categories]]
              .map(([label, val], i) => (
                <View key={label} style={[styles.cardStat, i < 3 && styles.cardStatDivider]}>
                  <Text style={styles.cardStatVal}>{val}</Text>
                  <Text style={styles.cardStatLabel}>{label}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* Top Cuisines + Top Categories — pill rows, locked colors, no borders */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Cuisines</Text>
          <View style={styles.pillWrap}>
            {top_cuisines.length ? top_cuisines.map((c) => (
              // Tap → Rankings scoped to this cuisine (mirrors web ?view=rankings&cuisine=X).
              <TouchableOpacity key={c.name} activeOpacity={0.7}
                onPress={() => navigation.navigate('Rankings', { cuisine: c.name })}>
                <View style={[styles.pill, { backgroundColor: COLORS.pillCuiBg }]}>
                  <Text style={[styles.pillText, { color: COLORS.pillCuiText }]}>
                    {c.name} <Text style={{ opacity: 0.65, fontSize: 11 }}>{c.count}</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            )) : <Text style={styles.emptyText}>No cuisines yet.</Text>}
          </View>
          <Text style={[styles.cardTitle, { marginTop: 16 }]}>Top Categories</Text>
          <View style={styles.pillWrap}>
            {top_categories.length ? top_categories.map((c) => (
              // Tap → Rankings scoped to this category (mirrors web ?view=rankings&category=X).
              <TouchableOpacity key={c.name} activeOpacity={0.7}
                onPress={() => navigation.navigate('Rankings', { categoryName: c.name })}>
                <View style={[styles.pill, { backgroundColor: COLORS.pillCatBg }]}>
                  <Text style={[styles.pillText, { color: COLORS.pillCatText }]}>
                    {c.name} <Text style={{ opacity: 0.65, fontSize: 11 }}>{c.count}</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            )) : <Text style={styles.emptyText}>No categories yet.</Text>}
          </View>
        </View>

        {/* Top Places — horizontal scroller, tier-token cards */}
        {top_places.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Places</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {top_places.map((tp) => {
                const tc = TIER_COLORS[tp.tier] || { bg: COLORS.tierTBE, text: COLORS.tierTBEText };
                return (
                <View key={tp.slug} style={[styles.placeCard, { backgroundColor: tc.bg }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={styles.placeTierSquare}>
                      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: tc.text }}>{tp.tier_label}</Text>
                    </View>
                    <Text style={[styles.placeContext, { color: tc.text }]} numberOfLines={1}>{tp.context}</Text>
                  </View>
                  <Text style={[styles.placeName, { color: tc.text }]} numberOfLines={2}>{tp.name}</Text>
                  <Text style={[styles.placeMeta, { color: tc.text }]} numberOfLines={1}>
                    {tp.category || '—'}{tp.cuisine ? ` · ${tp.cuisine}` : ''}
                  </Text>
                </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Recent Check-ins — photo carousel up top, then a clean bulleted log
            (no photos interleaved). Dates are pre-formatted strings (Rule 9). */}
        {recent_checkins.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Check-ins</Text>
            {recent_photos.length ? (
              // Non-scrolling row — only the thumbs that fit; rest clipped (no
              // second horizontal scroller; Highlights below keeps its scroll).
              <View style={{ flexDirection: 'row', overflow: 'hidden', marginBottom: 6 }}>
                {recent_photos.slice(0, RECENT_FIT).map((ph, i) => (
                  <Image key={`${ph.url}-${i}`} source={{ uri: absUrl(ph.url) }} style={styles.recentPhoto} />
                ))}
              </View>
            ) : null}
            {recent_checkins.map((ci, i) => {
              const tc = TIER_COLORS[ci.tier] || { bg: COLORS.tierTBE, text: COLORS.tierTBEText };
              return (
                <View key={`${ci.slug}-${i}`} style={[styles.visitRow, i > 0 && styles.visitRowBorder]}>
                  <View style={[styles.visitTierSquare, { backgroundColor: tc.bg }]}>
                    <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: tc.text }}>{ci.tier_label}</Text>
                  </View>
                  <Text style={styles.visitName} numberOfLines={1}>{ci.place_name}</Text>
                  <Text style={styles.visitMeta}>
                    {ci.date_str}{ci.meal_period ? ` · ${ci.meal_period}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Highlights — captioned place + tier */}
        {highlights.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Highlights</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {highlights.map((h) => (
                <View key={h.url} style={{ marginRight: 10, width: 150 }}>
                  <Image source={{ uri: absUrl(h.url) }} style={styles.highlightPhoto} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <TierBadge tier={h.tier} label={h.tier_label} small />
                    <Text style={styles.highlightCaption} numberOfLines={1}>{h.place_name}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Ask AI — dark/gold destination at the bottom (the payoff). Flat dark
            fill ≈ the web gradient. Chips + button behavior unchanged. */}
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Ask {first}'s AI</Text>
          <Text style={styles.aiSub}>
            It knows all {micro_stats.visits} of {first}'s visits and rankings. Ask it like you'd ask {first}.
          </Text>
          <View style={{ gap: 9, marginBottom: 16 }}>
            {ai_chips.map((chip) => (
              <TouchableOpacity key={chip} style={styles.aiChip} onPress={() => askWithPrompt(chip)}>
                <Text style={styles.aiChipSparkle}>✦</Text>
                <Text style={styles.aiChipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.aiBtn} onPress={() => askWithPrompt('')}>
            <Text style={styles.aiBtnText}>Ask {first}'s AI anything</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  card: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 0.5,
          borderColor: COLORS.border, padding: 16, marginHorizontal: 14, marginTop: 12 },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: COLORS.textLight,
               textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  errorText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted,
               textAlign: 'center', marginTop: 60, paddingHorizontal: 30 },
  // ── Hero Taste Card (collectible) ──────────────────────────────────────────
  tasteCard: { backgroundColor: COLORS.personaCardFill, borderWidth: 2.5,
               borderColor: COLORS.personaCardBorder, borderRadius: 24,
               marginHorizontal: 14, marginTop: 12, paddingHorizontal: 18,
               paddingTop: 22, paddingBottom: 16, alignItems: 'center', overflow: 'hidden',
               shadowColor: '#C8960C', shadowOpacity: 0.16, shadowRadius: 14,
               shadowOffset: { width: 0, height: 8 } },
  seal: { position: 'absolute', top: 14, right: 14, width: 60, height: 60, borderRadius: 30,
          backgroundColor: '#FBE7BE', alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: 'rgba(200,150,12,0.30)' },
  sealNum: { fontFamily: 'Outfit_700Bold', fontSize: 20, lineHeight: 22, color: COLORS.gold },
  sealLabel: { fontFamily: 'Outfit_700Bold', fontSize: 7.5, letterSpacing: 1, color: '#9A7212', marginTop: 1 },
  cardRank: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.6,
              textTransform: 'uppercase', color: COLORS.gold, marginTop: 2 },
  cardName: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: COLORS.text, marginTop: 2 },
  cardVibe: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#9A7212',
              fontStyle: 'italic', marginTop: 1 },
  cardStats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 12, paddingTop: 12,
               borderTopWidth: 1, borderTopColor: 'rgba(200,150,12,0.18)' },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatDivider: { borderRightWidth: 1, borderRightColor: 'rgba(200,150,12,0.18)' },
  cardStatVal: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: COLORS.text },
  cardStatLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, color: '#9A7212',
                   textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 5 },
  pillText: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textLight },
  placeCard: { width: 168, borderRadius: 14, padding: 13, marginRight: 10 },
  placeTierSquare: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#fff',
                     alignItems: 'center', justifyContent: 'center' },
  placeContext: { fontFamily: 'DMSans_400Regular', fontSize: 10, opacity: 0.7,
                  flexShrink: 1, marginLeft: 6, textAlign: 'right' },
  placeName: { fontFamily: 'Outfit_700Bold', fontSize: 15, marginTop: 2 },
  placeMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, opacity: 0.75, marginTop: 3 },
  recentPhoto: { width: 108, height: 108, borderRadius: 13, marginRight: 8 },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  visitRowBorder: { borderTopWidth: 0.5, borderColor: COLORS.borderLight },
  visitTierSquare: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  visitName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text, flexShrink: 1 },
  visitMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight, marginLeft: 'auto' },
  highlightPhoto: { width: 150, height: 110, borderRadius: 10 },
  highlightCaption: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textMuted,
                      flexShrink: 1 },
  aiCard: { backgroundColor: COLORS.personaAiDark, borderRadius: 16, padding: 22,
            marginHorizontal: 14, marginTop: 12 },
  aiTitle: { fontFamily: 'Outfit_700Bold', fontSize: 19, color: '#fff', marginBottom: 4 },
  aiSub: { fontFamily: 'DMSans_400Regular', fontSize: 12.5, color: COLORS.personaAiSub,
           lineHeight: 18, marginBottom: 14 },
  aiChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15,
            paddingVertical: 13, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.07)' },
  aiChipSparkle: { color: COLORS.gold, fontSize: 14 },
  aiChipText: { fontFamily: 'DMSans_500Medium', fontSize: 13.5, color: '#fff', flex: 1 },
  aiBtn: { backgroundColor: COLORS.gold, borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  aiBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#fff' },
});
