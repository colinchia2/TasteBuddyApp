import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

// Searchable type-and-select picker (Colin has many cuisines → type to find).
// Mirrors the site's select2 filter behaviour. One option list; typing filters it;
// tapping selects and closes. "All <thing>" clears the filter.
export default function FilterSelectModal({ visible, title, options, value, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => String(o).toLowerCase().includes(needle));
  }, [options, query]);

  function pick(v) {
    setQuery('');
    onSelect(v);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={COLORS.textLight} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${title.toLowerCase()}…`}
              placeholderTextColor={COLORS.textLight}
              value={query}
              onChangeText={setQuery}
              autoCorrect
              spellCheck
              autoCapitalize="none"
              keyboardType="default"
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item)}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 320 }}
            ListHeaderComponent={() => (
              <TouchableOpacity style={styles.row} onPress={() => pick(null)}>
                <Text style={[styles.rowText, !value && styles.rowTextActive]}>All {title.toLowerCase()}</Text>
                {!value ? <Ionicons name="checkmark" size={18} color={COLORS.gold} /> : null}
              </TouchableOpacity>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => pick(item)}>
                <Text style={[styles.rowText, value === item && styles.rowTextActive]} numberOfLines={1}>{item}</Text>
                {value === item ? <Ionicons name="checkmark" size={18} color={COLORS.gold} /> : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={styles.empty}>No matches</Text>
            )}
          />
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
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 18, color: COLORS.text },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.offWhite, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 14, marginBottom: 8,
  },
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, paddingVertical: 11 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight,
  },
  rowText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, flex: 1, marginRight: 8 },
  rowTextActive: { fontFamily: 'DMSans_700Bold', color: COLORS.tierSText },
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 24 },
});
