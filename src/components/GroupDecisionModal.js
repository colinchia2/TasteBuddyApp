import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/colors';

// Same-name "Group vs New Entry" decision (Phase 3 — mirrors web verbatim). Shown
// after place pick when check-group-conflict returns a conflict, BEFORE the category
// step. incomingAddress comes from the client's own form (the payload has no address).
export default function GroupDecisionModal({ visible, conflict, incomingAddress, onGroup, onSeparate, onCancel }) {
  if (!visible || !conflict || !conflict.existing) return null;
  const ex = conflict.existing;
  const inGroup = ex.in_group_id != null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>You already have a place by this name</Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>{ex.display_name}</Text>
            {' is already in your list — at '}
            <Text style={styles.ital}>{ex.address || 'an address you saved'}</Text>
            {'. The one you’re adding is at '}
            <Text style={styles.ital}>{incomingAddress || 'a new address'}</Text>{'.'}
          </Text>

          {/* Option A — Group (gold) */}
          <View style={styles.optGold}>
            <Text style={styles.optHeadGold}>
              {inGroup ? `Add to your ${ex.display_name} group` : 'Same place, different location'}
            </Text>
            <Text style={styles.optSubGold}>
              {inGroup
                ? 'This joins the locations you’re already tracking together.'
                : 'Track both locations under one ranking — you’ll still log visits to each.'}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onGroup} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{inGroup ? 'Add to group' : 'Group locations'}</Text>
            </TouchableOpacity>
          </View>

          {/* Option B — New Entry */}
          <View style={styles.optGrey}>
            <Text style={styles.optHead}>A different place that shares the name</Text>
            <Text style={styles.optSub}>Add it separately and give each a name to tell them apart.</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onSeparate} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Add as separate</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onCancel} style={styles.cancelWrap} activeOpacity={0.7}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 22 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text, marginBottom: 10 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 18 },
  bold: { fontFamily: 'DMSans_700Bold' },
  ital: { fontStyle: 'italic' },
  optGold: { backgroundColor: COLORS.confirmBg, borderRadius: 14, padding: 14, marginBottom: 12 },
  optHeadGold: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: COLORS.confirmText, marginBottom: 4 },
  optSubGold: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#7a6a3a', lineHeight: 18, marginBottom: 12 },
  optGrey: { backgroundColor: '#F6F5F2', borderRadius: 14, padding: 14, marginBottom: 8 },
  optHead: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#333', marginBottom: 4 },
  optSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 12 },
  primaryBtn: { backgroundColor: COLORS.gold, borderRadius: 18, paddingVertical: 11, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.white },
  secondaryBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingVertical: 11, alignItems: 'center', backgroundColor: COLORS.white },
  secondaryBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.text },
  cancelWrap: { alignSelf: 'center', marginTop: 8, padding: 6 },
  cancel: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.textMuted },
});
