import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  SafeAreaView, Alert,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';

export default function ResortScreen({ navigation, route }) {
  const { category } = route.params || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await api.json(`/api/places/pairwise/s-tier?new_id=0&category=${encodeURIComponent(category)}`);
      const all = [...(data.existing || [])];
      if (data.new_place?.id) all.unshift(data.new_place);
      setItems(all.map((p, i) => ({ ...p, position: i + 1 })));
    } catch (e) {
      Alert.alert('Error', 'Could not load S-Tier places.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    // Save contract is unchanged — same endpoint/payload the arrow version used;
    // only the input mechanism (drag vs arrows) changed.
    setSaving(true);
    try {
      await api.json('/api/places/resort/save-order', {
        method: 'POST',
        body: JSON.stringify({
          order: items.map((p, i) => ({ user_place_id: p.id, position: i + 1 })),
        }),
      });
      navigation.replace('Home');
    } catch (e) {
      Alert.alert('Error', 'Could not save order.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={COLORS.gold} size="large" /></View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item, drag, isActive, getIndex }) => {
    const index = getIndex() ?? 0;
    return (
      <ScaleDecorator>
        <TouchableOpacity
          style={[styles.row, isActive && styles.rowActive]}
          onLongPress={drag}
          delayLongPress={150}
          disabled={isActive}
          activeOpacity={0.9}
        >
          <Text style={styles.rank}>#{index + 1}</Text>
          <View style={styles.rowContent}>
            <Text style={styles.name}>{item.name}</Text>
            {item.cuisine ? <Text style={styles.cuisine}>{item.cuisine}</Text> : null}
          </View>
          {/* Grab handle — press and drag to reorder. */}
          <TouchableOpacity
            onPressIn={drag}
            style={styles.dragHandle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="reorder-three" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.gold} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reorder S-Tier</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={styles.saveBtn}>
          {saving
            ? <ActivityIndicator color={COLORS.gold} size="small" />
            : <Text style={styles.saveText}>Save</Text>
          }
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>{category} · long-press a row or use the handle to drag</Text>

      <DraggableFlatList
        data={items}
        keyExtractor={item => String(item.id)}
        onDragEnd={({ data }) => setItems(data.map((p, i) => ({ ...p, position: i + 1 })))}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { fontSize: 15, color: COLORS.gold, fontFamily: 'DMSans_500Medium', marginLeft: 2 },
  title: { flex: 1, textAlign: 'center', fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text },
  saveBtn: { minWidth: 72, alignItems: 'flex-end' },
  saveText: { fontSize: 15, color: COLORS.gold, fontWeight: '700', fontFamily: 'DMSans_700Bold' },
  subtitle: {
    fontSize: 12, color: COLORS.textMuted, fontFamily: 'DMSans_400Regular',
    paddingHorizontal: 20, marginBottom: 16,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    padding: 14, marginBottom: 8,
  },
  rowActive: {
    backgroundColor: COLORS.goldLight, borderColor: COLORS.gold,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  rank: {
    fontSize: 13, fontWeight: '700', color: COLORS.gold,
    fontFamily: 'DMSans_700Bold', width: 36,
  },
  rowContent: { flex: 1 },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  cuisine: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  dragHandle: { padding: 4, marginLeft: 8 },
});
