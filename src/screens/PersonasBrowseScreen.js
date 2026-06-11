// Tastie Personas — app browse screen (port of web /personas, Prompt 4).
// Curated personas with follow/unfollow via the EXISTING persona_follows
// system, plus a path into user profiles (your own + a name lookup).
// NO user_follows / Add / saved-user list / unified badge — that's Prompt 5.
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../constants/colors';
import { api } from '../api/client';

// Type filter chips — ports web /personas exactly (keys = PersonaTypeEnum values
// the /api/personas payload returns in `type`).
const TYPE_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'original', label: 'TasteBuddy Originals' },
  { key: 'chef', label: 'Chefs' },
  { key: 'food_media', label: 'Food Media' },
  { key: 'friend', label: 'Friends' },
  { key: 'custom', label: 'User Created' },
];

export default function PersonasBrowseScreen({ navigation }) {
  const { user } = useAuth();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lookupName, setLookupName] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [busy, setBusy] = useState({});   // persona_id → toggling
  const [filter, setFilter] = useState('all');   // type filter chip

  const load = useCallback(() => {
    api.json('/api/personas')
      .then((d) => setPersonas(d.personas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function toggleFollow(p) {
    if (busy[p.id]) return;
    setBusy((b) => ({ ...b, [p.id]: true }));
    try {
      const d = await api.json(`/api/personas/${p.id}/${p.is_following ? 'unfollow' : 'follow'}`,
                               { method: 'POST', body: JSON.stringify({}) });
      setPersonas((list) => list.map((x) => x.id === p.id
        ? { ...x, is_following: d.is_following, follower_count: d.follower_count } : x));
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy((b) => ({ ...b, [p.id]: false }));
    }
  }

  async function lookup() {
    const name = lookupName.trim();
    if (!name) return;
    setLookingUp(true);
    try {
      const d = await api.json(`/api/persona/lookup?name=${encodeURIComponent(name)}`);
      navigation.navigate('PersonaProfile', { userId: d.user_id });
    } catch {
      Alert.alert('Not found', 'No public Tastie Persona with that name.');
    } finally {
      setLookingUp(false);
    }
  }

  const shown = filter === 'all' ? personas : personas.filter((p) => p.type === filter);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Tastie Personas" navigation={navigation} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Zone A — Your Persona (tap → your own profile) */}
        <Text style={styles.sectionLabel}>Your Persona</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.selfRow}
            onPress={() => navigation.navigate('PersonaProfile', { userId: user?.id })}>
            <View style={styles.selfAvatar}>
              <Text style={styles.selfAvatarText}>{(user?.display_name || '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selfTitle}>My Tastie Persona</Text>
              <Text style={styles.selfSub}>See your taste profile the way others do</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Zone B — Saved. Population needs the Prompt 5 follow graph; the empty
            state is the correct render for now. */}
        <Text style={styles.sectionLabel}>Saved</Text>
        <View style={styles.card}>
          <Text style={styles.savedEmpty}>No saved Personas yet.</Text>
          <Text style={styles.savedEmptySub}>Personas you add will show up here.</Text>
        </View>

        {/* Zone C — find a friend's Persona by name */}
        <Text style={styles.sectionLabel}>Find a Persona</Text>
        <View style={styles.card}>
          <View style={[styles.lookupRow, { marginTop: 0 }]}>
            <TextInput
              style={styles.lookupInput}
              placeholder="View a friend's Persona by name…"
              placeholderTextColor={COLORS.textLight}
              value={lookupName}
              onChangeText={setLookupName}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={lookup}
            />
            <TouchableOpacity style={styles.lookupBtn} onPress={lookup} disabled={lookingUp}>
              {lookingUp
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.lookupBtnText}>View</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Curated personas (existing follow system) + type filter chips */}
        <Text style={styles.sectionLabel}>Curated Tastie Personas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipBar}>
          {TYPE_CHIPS.map((c) => {
            const on = filter === c.key;
            return (
              <TouchableOpacity key={c.key} onPress={() => setFilter(c.key)}
                style={[styles.typeChip, on && styles.typeChipOn]}>
                <Text style={[styles.typeChipText, on && styles.typeChipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 30 }} />
        ) : shown.length === 0 ? (
          <Text style={styles.emptyText}>
            {filter === 'all' ? 'No Tastie Personas yet.' : 'None in this category.'}
          </Text>
        ) : shown.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.personaName}>{p.name}</Text>
                {p.vibe_tag ? <Text style={styles.personaVibe}>{p.vibe_tag}</Text> : null}
                <Text style={styles.personaMeta}>
                  {p.follower_count} follower{p.follower_count === 1 ? '' : 's'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.followBtn, p.is_following && styles.followingBtn]}
                onPress={() => toggleFollow(p)}>
                {busy[p.id]
                  ? <ActivityIndicator size="small" color={p.is_following ? COLORS.gold : '#fff'} />
                  : <Text style={[styles.followText, p.is_following && styles.followingText]}>
                      {p.is_following ? 'Following' : 'Follow'}
                    </Text>}
              </TouchableOpacity>
            </View>
            {p.description ? (
              <Text style={styles.personaDesc} numberOfLines={3}>{p.description}</Text>
            ) : null}
          </View>
        ))}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  card: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 0.5,
          borderColor: COLORS.border, padding: 16, marginHorizontal: 14, marginTop: 12 },
  sectionLabel: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: COLORS.textLight,
                  textTransform: 'uppercase', letterSpacing: 0.8,
                  marginTop: 18, marginHorizontal: 18 },
  selfRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selfAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.goldLight,
                alignItems: 'center', justifyContent: 'center' },
  selfAvatarText: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.tierSText },
  selfTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  selfSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted },
  chevron: { fontSize: 22, color: COLORS.textMuted },
  lookupRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  lookupInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
                 paddingHorizontal: 12, paddingVertical: 9, fontFamily: 'DMSans_400Regular',
                 fontSize: 13, color: COLORS.text, backgroundColor: COLORS.offWhite },
  lookupBtn: { backgroundColor: COLORS.gold, borderRadius: 10, paddingHorizontal: 16,
               justifyContent: 'center' },
  lookupBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#fff' },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textLight,
               textAlign: 'center', marginTop: 30 },
  savedEmpty: { fontFamily: 'DMSans_700Bold', fontSize: 13.5, color: COLORS.textMuted },
  savedEmptySub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight, marginTop: 3 },
  chipBar: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2, gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              backgroundColor: COLORS.white, borderWidth: 0.5, borderColor: COLORS.border },
  typeChipOn: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  typeChipText: { fontFamily: 'DMSans_500Medium', fontSize: 12.5, color: COLORS.textMuted },
  typeChipTextOn: { color: '#fff' },
  personaName: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: COLORS.text },
  personaVibe: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted,
                 fontStyle: 'italic', marginTop: 1 },
  personaMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textLight, marginTop: 3 },
  personaDesc: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#444',
                 lineHeight: 19, marginTop: 8 },
  followBtn: { backgroundColor: COLORS.gold, borderRadius: 20, paddingHorizontal: 16,
               paddingVertical: 7, minWidth: 86, alignItems: 'center' },
  followingBtn: { backgroundColor: COLORS.goldLight },
  followText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#fff' },
  followingText: { color: COLORS.gold },
});
