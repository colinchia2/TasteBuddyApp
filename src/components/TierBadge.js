import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TIER_COLORS } from '../constants/colors';

export default function TierBadge({ tier, size = 'md' }) {
  const colors = TIER_COLORS[tier] || TIER_COLORS.TBE;
  const label = colors.label;
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, isSmall && styles.sm]}>
      <Text style={[styles.text, { color: colors.text }, isSmall && styles.smText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  smText: {
    fontSize: 11,
  },
});
