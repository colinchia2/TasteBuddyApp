import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

export default function ScreenHeader({ title, navigation, onBack, rightElement }) {
  const handleBack = onBack || (() => navigation.goBack());
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.gold} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <View style={styles.spacer}>{rightElement || null}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 70 },
  backText: { fontSize: 15, color: COLORS.gold, fontFamily: 'DMSans_500Medium', marginLeft: 2 },
  title: {
    flex: 1, textAlign: 'center',
    fontFamily: 'Outfit_700Bold', fontSize: 17, color: COLORS.text,
  },
  spacer: { minWidth: 70 },
});
