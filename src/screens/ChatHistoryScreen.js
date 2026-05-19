import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';
import ScreenHeader from '../components/ScreenHeader';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ChatHistoryScreen({ navigation, route }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const onSelectSession = route.params?.onSelectSession;

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.json('/api/chat/sessions');
      setSessions(data);
    } catch (e) {
      setError('Could not load chat history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  function renameSession(session) {
    Alert.prompt(
      'Rename Chat',
      'Enter a new name for this conversation.',
      async (newTitle) => {
        if (!newTitle || !newTitle.trim()) return;
        try {
          await api.json(`/api/chat/sessions/${session.id}/rename`, {
            method: 'POST',
            body: JSON.stringify({ title: newTitle.trim() }),
          });
          setSessions(prev => prev.map(s => s.id === session.id ? { ...s, title: newTitle.trim() } : s));
        } catch {}
      },
      'plain-text',
      session.title || '',
    );
  }

  async function deleteSession(id) {
    Alert.alert('Delete chat?', 'This will remove it from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.json(`/api/chat/sessions/${id}`, { method: 'DELETE' });
            setSessions(prev => prev.filter(s => s.id !== id));
          } catch (_) {}
        },
      },
    ]);
  }

  function continueSession(session) {
    if (onSelectSession) {
      onSelectSession(session);
      navigation.goBack();
    } else {
      navigation.navigate('Home', { continueSession: session });
    }
  }

  function renderItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => continueSession(item)}
        onLongPress={() => renameSession(item)}
        activeOpacity={0.75}
      >
        <View style={styles.rowIcon}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.gold} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={2}>{item.title || 'Untitled'}</Text>
          <Text style={styles.rowDate}>{formatDate(item.updated_at)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteSession(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.textLight} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Chat History" navigation={navigation} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={COLORS.gold} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadSessions} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={COLORS.border} />
          <Text style={styles.emptyText}>No past chats yet.</Text>
          <Text style={styles.emptySubText}>Ask TasteBuddy AI something on the home screen.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 20, backgroundColor: COLORS.gold, borderRadius: 20 },
  retryText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#fff' },
  emptyText: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text, marginTop: 16, textAlign: 'center' },
  emptySubText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.goldLight, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0,
  },
  rowContent: { flex: 1, marginRight: 8 },
  rowTitle: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.text, lineHeight: 20 },
  rowDate: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  deleteBtn: { padding: 4 },
  separator: { height: 0.5, backgroundColor: COLORS.border, marginLeft: 64 },
});
