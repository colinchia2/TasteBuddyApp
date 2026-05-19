import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  SafeAreaView, Alert, FlatList,
} from 'react-native';
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

  function moveUp(idx) {
    if (idx === 0) return;
    setItems(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((p, i) => ({ ...p, position: i + 1 }));
    });
  }

  function moveDown(idx) {
    setItems(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((p, i) => ({ ...p, position: i + 1 }));
    });
  }

  async function save() {
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
        <Text style={styles.title}>Reorder S-Tier</Text>
        <TouchableOpacity onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color={COLORS.gold} size="small" />
            : <Text style={styles.saveText}>Save</Text>
          }
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>{category}</Text>

      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <View style={styles.rowContent}>
              <Text style={styles.name}>{item.name}</Text>
              {item.cuisine ? <Text style={styles.cuisine}>{item.cuisine}</Text> : null}
            </View>
            <View style={styles.arrows}>
              <TouchableOpacity onPress={() => moveUp(index)} style={styles.arrowBtn}>
                <Ionicons name="chevron-up" size={20} color={index === 0 ? COLORS.border : COLORS.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveDown(index)} style={styles.arrowBtn}>
                <Ionicons name="chevron-down" size={20} color={index === items.length - 1 ? COLORS.border : COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text },
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
  rank: {
    fontSize: 13, fontWeight: '700', color: COLORS.gold,
    fontFamily: 'DMSans_700Bold', width: 36,
  },
  rowContent: { flex: 1 },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  cuisine: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  arrows: { flexDirection: 'row', gap: 4 },
  arrowBtn: { padding: 4 },
});
