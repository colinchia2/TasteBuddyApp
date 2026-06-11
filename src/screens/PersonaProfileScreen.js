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
  ActivityIndicator, Image,
} from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import TasteDnaRadar from '../components/TasteDnaRadar';
import { COLORS, TIER_COLORS } from '../constants/colors';
import { api, BASE_URL } from '../api/client';

// storage_url is used AS-IS (never concatenate paths) — relative URLs just get
// the API host prefixed, same idiom as EditVisitScreen.
const absUrl = (u) => (u && u.startsWith('http') ? u : `${BASE_URL}${u}`);

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
          top_places, recent_checkins, highlights, ai_chips, taste_dna } = profile;
  const first = (identity.display_name || '').split(' ')[0];

  const askWithPrompt = (prompt) =>
    navigation.navigate('Home', {
      personaAsk: { id: identity.user_id, name: identity.display_name, prompt },
    });

  return (
    <View style={styles.container}>
      <ScreenHeader title={`${identity.display_name}'s Persona`} navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero (stacked): avatar + name · Tastie seal · micro-stats */}
        <View style={styles.card}>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{identity.avatar_initial}</Text>
            </View>
            <Text style={styles.heroName}>{identity.display_name}</Text>
            {identity.vibe_tag ? <Text style={styles.vibe}>{identity.vibe_tag}</Text> : null}
            {/* TAGLINE SLOT — intentionally empty. The Hero prompt fills this
                with the archetype headline + AI subtitle. Do not add content. */}
            <View style={styles.scoreSeal}>
              <Text style={styles.scoreNumber}>{tastie.score}</Text>
              <Text style={styles.scoreLabel}>{tastie.label}</Text>
            </View>
            <View style={styles.statsRow}>
              {[['Visits', micro_stats.visits], ['Places', micro_stats.places],
                ['Cuisines', micro_stats.cuisines], ['Categories', micro_stats.categories]]
                .map(([label, val]) => (
                  <View key={label} style={{ alignItems: 'center' }}>
                    <Text style={styles.statVal}>{val}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
            </View>
          </View>
        </View>

        {/* Taste DNA — the shared radar component (Prompt 2), its real home */}
        {taste_dna ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Taste DNA</Text>
            <TasteDnaRadar dna={taste_dna} />
          </View>
        ) : null}

        {/* Top Cuisines + Top Categories — pill rows, locked colors, no borders */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Cuisines</Text>
          <View style={styles.pillWrap}>
            {top_cuisines.length ? top_cuisines.map((c) => (
              <View key={c.name} style={[styles.pill, { backgroundColor: COLORS.pillCuiBg }]}>
                <Text style={[styles.pillText, { color: COLORS.pillCuiText }]}>
                  {c.name} <Text style={{ opacity: 0.65, fontSize: 11 }}>{c.count}</Text>
                </Text>
              </View>
            )) : <Text style={styles.emptyText}>No cuisines yet.</Text>}
          </View>
          <Text style={[styles.cardTitle, { marginTop: 16 }]}>Top Categories</Text>
          <View style={styles.pillWrap}>
            {top_categories.length ? top_categories.map((c) => (
              <View key={c.name} style={[styles.pill, { backgroundColor: COLORS.pillCatBg }]}>
                <Text style={[styles.pillText, { color: COLORS.pillCatText }]}>
                  {c.name} <Text style={{ opacity: 0.65, fontSize: 11 }}>{c.count}</Text>
                </Text>
              </View>
            )) : <Text style={styles.emptyText}>No categories yet.</Text>}
          </View>
        </View>

        {/* Top Places — horizontal scroller, tier-token cards */}
        {top_places.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Places</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {top_places.map((tp) => (
                <View key={tp.slug} style={styles.placeCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <TierBadge tier={tp.tier} label={tp.tier_label} />
                    <Text style={styles.placeContext} numberOfLines={1}>{tp.context}</Text>
                  </View>
                  <Text style={styles.placeName} numberOfLines={2}>{tp.name}</Text>
                  <Text style={styles.placeMeta} numberOfLines={1}>
                    {tp.category || '—'}{tp.cuisine ? ` · ${tp.cuisine}` : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Recent Check-ins — visits-sourced; dates are pre-formatted strings (Rule 9) */}
        {recent_checkins.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Check-ins</Text>
            {recent_checkins.map((ci, i) => (
              <View key={`${ci.slug}-${i}`}
                    style={[styles.checkinRow, i < recent_checkins.length - 1 && styles.rowBorder]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TierBadge tier={ci.tier} label={ci.tier_label} small />
                  <Text style={styles.checkinPlace} numberOfLines={1}>{ci.place_name}</Text>
                  <Text style={styles.checkinDate}>
                    {ci.date_str}{ci.meal_period ? ` · ${ci.meal_period}` : ''}
                  </Text>
                </View>
                {ci.photos.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {ci.photos.map((url) => (
                      <Image key={url} source={{ uri: absUrl(url) }} style={styles.checkinPhoto} />
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ))}
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

        {/* Ask AI — chips + primary button (always logged in on app) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ask {first}'s AI</Text>
          <View style={styles.pillWrap}>
            {ai_chips.map((chip) => (
              <TouchableOpacity key={chip} style={styles.chip} onPress={() => askWithPrompt(chip)}>
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.askBtn} onPress={() => askWithPrompt('')}>
            <Text style={styles.askBtnText}>Ask {first}'s AI anything</Text>
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
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.goldLight,
            alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Outfit_700Bold', fontSize: 30, color: COLORS.tierSText },
  heroName: { fontFamily: 'Outfit_700Bold', fontSize: 22, color: COLORS.text, marginTop: 8 },
  vibe: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted,
          fontStyle: 'italic', marginTop: 2 },
  scoreSeal: { backgroundColor: COLORS.goldLight, borderRadius: 14, paddingHorizontal: 24,
               paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  scoreNumber: { fontFamily: 'Outfit_700Bold', fontSize: 28, color: COLORS.gold, lineHeight: 32 },
  scoreLabel: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: '#9b7b22',
                textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 26, marginTop: 14 },
  statVal: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text },
  statLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, color: COLORS.textLight,
               textTransform: 'uppercase', letterSpacing: 0.6 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 5 },
  pillText: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textLight },
  placeCard: { width: 190, borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.borderLight,
               backgroundColor: COLORS.offWhite, padding: 12, marginRight: 10 },
  placeContext: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: COLORS.textLight,
                  flexShrink: 1, marginLeft: 6 },
  placeName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  placeMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  checkinRow: { paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 0.5, borderColor: COLORS.borderLight },
  checkinPlace: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text, flexShrink: 1 },
  checkinDate: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textLight,
                 marginLeft: 'auto' },
  checkinPhoto: { width: 96, height: 72, borderRadius: 8, marginRight: 8 },
  highlightPhoto: { width: 150, height: 110, borderRadius: 10 },
  highlightCaption: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textMuted,
                      flexShrink: 1 },
  chip: { borderWidth: 1.5, borderColor: COLORS.gold, borderRadius: 20,
          paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.white },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.tierSText },
  askBtn: { backgroundColor: COLORS.gold, borderRadius: 20, paddingVertical: 11,
            alignItems: 'center', marginTop: 14 },
  askBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.white },
});
