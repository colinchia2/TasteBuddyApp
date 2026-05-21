import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';

const TYPE_ICONS = {
  checkin_reminder: 'location-outline',
  visit_reminder:   'calendar-outline',
  tier_change:      'star-outline',
  general:          'notifications-outline',
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function handleNotificationTap(item, navigation) {
  if (item.type === 'visit_reminder' && item.related_place_id) {
    navigation.navigate('LogVisit', {
      placeId: item.related_place_id,
      placeName: item.place_name || '',
      checkinId: item.pending_checkin_id || null,
    });
  }
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.json('/api/notifications?limit=30');
      setNotifications(data);
    } catch (e) {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function markAllRead() {
    try {
      await api.json('/api/notifications/mark-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  function renderItem({ item }) {
    const iconName = TYPE_ICONS[item.type] || 'notifications-outline';
    const tappable = item.type === 'visit_reminder' && !!item.related_place_id;
    const RowWrapper = tappable ? TouchableOpacity : View;
    const wrapperProps = tappable
      ? { activeOpacity: 0.75, onPress: () => handleNotificationTap(item, navigation) }
      : {};
    return (
      <RowWrapper style={[styles.row, !item.is_read && styles.rowUnread]} {...wrapperProps}>
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={18} color={COLORS.gold} />
        </View>
        <View style={styles.rowContent}>
          {item.title ? <Text style={styles.rowTitle}>{item.title}</Text> : null}
          {item.body ? <Text style={styles.rowBody}>{item.body}</Text> : null}
          <View style={styles.rowFooter}>
            <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
            {tappable && (
              <Text style={styles.rowAction}>Finish logging visit →</Text>
            )}
          </View>
        </View>
        {!item.is_read && <View style={styles.unreadDot} />}
      </RowWrapper>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notifications"
        navigation={navigation}
        rightElement={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllRead} style={styles.markReadBtn}>
              <Text style={styles.markReadText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={COLORS.gold} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={40} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>Check in at a restaurant to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 20, backgroundColor: COLORS.gold, borderRadius: 20 },
  retryText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#fff' },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text, marginTop: 16 },
  emptySub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  markReadBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markReadText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.gold },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  rowUnread: { backgroundColor: '#FFFDF5' },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.goldLight, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0, marginTop: 2,
  },
  rowContent: { flex: 1, marginRight: 8 },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text, lineHeight: 20 },
  rowBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginTop: 2, lineHeight: 18 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  rowTime: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textLight },
  rowAction: { fontFamily: 'DMSans_500Medium', fontSize: 11, color: COLORS.gold },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, marginTop: 6 },
  separator: { height: 0.5, backgroundColor: COLORS.border },
});
