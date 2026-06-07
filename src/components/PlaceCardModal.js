import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import TierBadge from './TierBadge';
import { CuisinePill, CategoryPill } from './Pill';

// READ-ONLY place card. Shows only facts already in the rankings payload — no second
// fetch, no visit/photo/edit UI, and NO link to the TasteBuddy website (JWT app would
// hit a session login wall). External links go to the RESTAURANT's own destinations
// only (website / reservation / maps) and leave to external apps.

function formatPrice(price_level) {
  if (price_level == null || price_level === '') return null;
  const s = String(price_level).trim();
  if (/^[1-4]$/.test(s)) return '$'.repeat(Number(s));
  return s;
}

function openMaps(place) {
  // Prefer the server-built maps_url (opens the real listing via google_place_id —
  // shared helper, web + app can't diverge). Fall back to a coordinate/name query.
  let url = place.maps_url;
  if (!url) {
    const q = (place.lat != null && place.lng != null)
      ? `${place.lat},${place.lng}`
      : [place.display_name, place.address].filter(Boolean).join(' ');
    if (!q) return;
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  Linking.openURL(url).catch(() => {});
}

function openUrl(url) {
  if (!url) return;
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  Linking.openURL(full).catch(() => {});
}

export default function PlaceCardModal({ place, visible, onClose, onCategoryPress }) {
  if (!place) return null;
  const price = formatPrice(place.price_level);
  const locationLine = [place.neighborhood, place.city].filter(Boolean).join(', ');

  // ALL of this place's category memberships (e.g. Bar + Chicken Sandwich), from
  // the endpoint's additive `memberships`. Falls back to the single scoped category
  // for older payloads. Each pill is tappable → opens that category's ranking.
  const memberships = (Array.isArray(place.memberships) && place.memberships.length)
    ? place.memberships
    : (place.category ? [{ category_id: place.category.id, category: place.category.name }] : []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{place.display_name}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.pillRow}>
              <TierBadge tier={place.tier} size="sm" />
              {memberships.map((m) => (
                onCategoryPress ? (
                  <TouchableOpacity
                    key={`${m.category_id}-${m.category}`}
                    activeOpacity={0.7}
                    onPress={() => onCategoryPress(m.category, m.category_id)}
                  >
                    <CategoryPill label={m.category} />
                  </TouchableOpacity>
                ) : (
                  <CategoryPill key={`${m.category_id}-${m.category}`} label={m.category} />
                )
              ))}
              {place.cuisine ? <CuisinePill label={place.cuisine} /> : null}
            </View>

            {(place.address || locationLine) ? (
              <View style={styles.factRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.textMuted} style={styles.factIcon} />
                <Text style={styles.factText}>{place.address || locationLine}</Text>
              </View>
            ) : null}
            {(place.address && locationLine) ? (
              <Text style={styles.subLocation}>{locationLine}</Text>
            ) : null}

            {(place.rating != null || price) ? (
              <View style={styles.factRow}>
                {place.rating != null ? (
                  <>
                    <Ionicons name="star" size={15} color={COLORS.gold} style={styles.factIcon} />
                    <Text style={styles.factText}>{Number(place.rating).toFixed(1)}</Text>
                  </>
                ) : null}
                {price ? <Text style={[styles.factText, place.rating != null && { marginLeft: 14 }]}>{price}</Text> : null}
              </View>
            ) : null}

            {/* External links — restaurant's own destinations only. Omit nulls. */}
            <View style={styles.actions}>
              {place.website ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openUrl(place.website)}>
                  <Ionicons name="globe-outline" size={18} color={COLORS.tierSText} />
                  <Text style={styles.actionText}>Website</Text>
                </TouchableOpacity>
              ) : null}
              {place.reservation_url ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openUrl(place.reservation_url)}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.tierSText} />
                  <Text style={styles.actionText}>Reserve</Text>
                </TouchableOpacity>
              ) : null}
              {(place.maps_url || place.lat != null || place.address) ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => openMaps(place)}>
                  <Ionicons name="map-outline" size={18} color={COLORS.tierSText} />
                  <Text style={styles.actionText}>Open in Maps</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.comingSoon}>Full details coming soon</Text>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34,
    maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 22, color: COLORS.text, marginRight: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' },
  factRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  factIcon: { marginRight: 8 },
  factText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text, flexShrink: 1 },
  subLocation: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 3, marginLeft: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.goldLight, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  actionText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.tierSText },
  comingSoon: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight,
    textAlign: 'center', marginTop: 22,
  },
});
