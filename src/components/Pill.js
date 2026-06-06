import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

// Locked design-token pills — no borders. Category = blue, Cuisine = warm gray.
// Mirrors .pill-cat / .pill-cui in design_tokens.css.

export function CuisinePill({ label }) {
  if (!label) return null;
  return (
    <View style={[styles.pill, { backgroundColor: COLORS.pillCuiBg }]}>
      <Text style={[styles.text, { color: COLORS.pillCuiText }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function CategoryPill({ label }) {
  if (!label) return null;
  return (
    <View style={[styles.pill, { backgroundColor: COLORS.pillCatBg }]}>
      <Text style={[styles.text, { color: COLORS.pillCatText }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
});
