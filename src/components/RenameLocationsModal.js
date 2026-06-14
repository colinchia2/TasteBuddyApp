import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/colors';
import { api } from '../api/client';

// Shared rename screen (Phase 3 — New Entry + future ungroup; mirrors web verbatim).
// rows: [{place_id, display_name, address}]. Writes per-changed-row label overrides
// (POST /api/places/<id>/label) — never the shared catalog name. onDone() fires after
// Save or Skip so the caller can resume its flow.
export default function RenameLocationsModal({ visible, rows, onDone }) {
  const [vals, setVals] = useState({});
  const [orig, setOrig] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v = {};
    (rows || []).forEach(r => { v[r.place_id] = r.display_name || ''; });
    setVals(v);
    setOrig(v);
  }, [rows]);

  async function save() {
    setSaving(true);
    try {
      for (const r of (rows || [])) {
        const val = (vals[r.place_id] || '').trim();
        if (val !== (orig[r.place_id] || '')) {
          await api.json(`/api/places/${r.place_id}/label`, {
            method: 'POST',
            body: JSON.stringify({ display_name_override: val || null }),
          }).catch(() => {});
        }
      }
    } finally {
      setSaving(false);
      onDone && onDone();
    }
  }

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onDone && onDone()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Name each location</Text>
          <Text style={styles.sub}>Give each a label so they’re easy to tell apart in your list.</Text>
          {(rows || []).map(r => (
            <View key={r.place_id} style={styles.row}>
              {r.address ? <Text style={styles.addr}>{r.address}</Text> : null}
              <TextInput
                style={styles.input}
                value={vals[r.place_id] || ''}
                onChangeText={(t) => setVals(prev => ({ ...prev, [r.place_id]: t }))}
                placeholder="Name for this location"
                placeholderTextColor={COLORS.textLight}
                autoCorrect={false}
              />
            </View>
          ))}
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={() => onDone && onDone()} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={styles.saveBtn} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save names</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 22 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text, marginBottom: 6 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#555', marginBottom: 16 },
  row: { marginBottom: 14 },
  addr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginBottom: 5 },
  input: { backgroundColor: COLORS.borderLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 6 },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  skipText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.textMuted },
  saveBtn: { backgroundColor: COLORS.gold, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 22, alignItems: 'center', minWidth: 120 },
  saveText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.white },
});
