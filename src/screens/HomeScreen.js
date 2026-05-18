import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';
import MarkdownMessage from '../components/MarkdownMessage';

const TILES = [
  {
    id: 'log',
    title: 'Log a Visit',
    subtitle: 'Check in where you\'re eating',
    icon: 'location',
    bg: COLORS.gold,
    iconColor: '#fff',
    textColor: '#fff',
    border: false,
    screen: 'CheckIn',
  },
  {
    id: 'add',
    title: 'Add a Place',
    subtitle: 'Search & bookmark a restaurant',
    icon: 'add-circle',
    bg: '#1C1C1E',
    iconColor: '#fff',
    textColor: '#fff',
    border: false,
    screen: 'AddPlace',
  },
];

const SUGGESTED_PROMPTS = [
  "What's my best pick for a special night out?",
  "Find me a new neighborhood spot I haven't tried",
  "Plan me a 3-stop food crawl this weekend",
  "What should I try next from my list?",
];

const FOLLOW_UPS = {
  recommend:       ['Find me somewhere similar', 'What cuisines haven\'t I explored?', 'Make it more casual'],
  discover_new:    ['What\'s the best time to go?', 'Find somewhere similar', 'Any hidden gems nearby?'],
  plan_visit:      ['What should I order?', 'Find me a backup option', 'What\'s the vibe like?'],
  taste_analysis:  ['What should I try next?', 'Find a spot that fits my taste', 'What\'s my most visited cuisine?'],
  food_crawl:      ['Which stop should I hit first?', 'Make it a longer crawl', 'Any drink spots to add?'],
  organize_nextup: ['What\'s been on my list longest?', 'Find me something new to add', 'Which ones are S-tier worthy?'],
  log_visit:       ['How does that compare to my S-tier?', 'What should I try next?', 'Find somewhere similar'],
  default:         ['Find me somewhere new to try', 'What cuisines haven\'t I explored?', 'What\'s my S-tier list?'],
};

function getFollowUps(mode) {
  return (FOLLOW_UPS[mode] || FOLLOW_UPS.default).slice(0, 3);
}

const LOADING_PHASES = [
  'Analyzing your TasteBuds…',
  'Spoonfeeding the Model…',
  'Prepping the Kitchen…',
  'Setting the Table…',
  'Mincing the Garlic…',
  'Waiting in Line…',
  'Calling for a Reservation…',
  'Chewing on it…',
];
const LOADING_PHASE_FINAL = 'Putting the Cherry on Top…';

export default function HomeScreen({ navigation, route }) {
  const { user } = useAuth();
  const [chatActive, setChatActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(LOADING_PHASES[0]);
  const [conversationId, setConversationId] = useState(null);
  const scrollRef = useRef(null);
  const phaseTimerRef = useRef(null);

  useEffect(() => {
    if (chatActive && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, chatActive]);

  // Handle continuing a session from ChatHistoryScreen
  useEffect(() => {
    const session = route?.params?.continueSession;
    if (!session) return;
    loadSession(session);
    // Clear param so navigating back/forward doesn't re-trigger
    navigation.setParams({ continueSession: undefined });
  }, [route?.params?.continueSession]);

  async function loadSession(session) {
    try {
      const data = await api.json(`/api/chat/sessions/${session.id}/messages`);
      const restored = data.map(m => ({
        role: m.role === 'assistant' ? 'ai' : 'user',
        text: m.content,
        ...(m.role === 'assistant' ? { followUps: [] } : {}),
      }));
      setMessages(restored);
      setConversationId(session.id);
      setChatActive(true);
    } catch (_) {}
  }

  function startPhaseTimer() {
    let idx = 0;
    setLoadingPhase(LOADING_PHASES[0]);
    phaseTimerRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_PHASES.length;
      setLoadingPhase(LOADING_PHASES[idx]);
    }, 2200);
  }

  function stopPhaseTimer() {
    if (phaseTimerRef.current) {
      clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }

  async function sendMessage(text) {
    const msg = (text || inputText).trim();
    if (!msg || loading) return;
    setInputText('');
    Keyboard.dismiss();
    setChatActive(true);
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    startPhaseTimer();

    try {
      const convId = conversationId || `conv-${Date.now()}`;
      if (!conversationId) setConversationId(convId);
      const data = await api.json('/api/ask/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg, conversation_id: convId }),
      });
      stopPhaseTimer();
      setLoadingPhase(LOADING_PHASE_FINAL);
      await new Promise(r => setTimeout(r, 700));
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.response || 'No response received.',
        followUps: getFollowUps(data.mode),
      }]);
    } catch (e) {
      stopPhaseTimer();
      const errMsg = e.message === 'paywall'
        ? "You've used your free questions. Upgrade at TasteBuddy.ai!"
        : 'Something went wrong. Try again!';
      setMessages(prev => [...prev, { role: 'ai', text: errMsg }]);
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    stopPhaseTimer();
    setChatActive(false);
    setMessages([]);
    setConversationId(null);
    setInputText('');
    setLoadingPhase(LOADING_PHASES[0]);
  }

  const firstName = user?.display_name?.split(' ')[0] || 'there';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {chatActive ? 'Ask TasteBuddy AI' : `Hi ${firstName},`}
            </Text>
            {!chatActive && (
              <Text style={styles.sub}>
                let's check in a visit or Ask TasteBuddy AI Anything!
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Activity')}
            >
              <Ionicons name="receipt-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('ChatHistory')}
            >
              <Ionicons name="time-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.avatarText}>
                {(user?.display_name || 'U')[0].toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tiles — hidden when chat is active */}
        {!chatActive && (
          <View style={styles.tileRow}>
            {TILES.map(tile => (
              <TouchableOpacity
                key={tile.id}
                style={[
                  styles.tile,
                  { backgroundColor: tile.bg },
                  tile.border && { borderWidth: 0.5, borderColor: COLORS.border },
                ]}
                onPress={() => navigation.navigate(tile.screen)}
                activeOpacity={0.82}
              >
                <Ionicons name={tile.icon} size={32} color={tile.iconColor} style={styles.tileIcon} />
                <Text style={[styles.tileTitle, { color: tile.textColor }]}>{tile.title}</Text>
                <Text style={[styles.tileSub, { color: tile.textColor }]}>{tile.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Chat messages */}
        {chatActive && (
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg, i) => (
              <View key={i}>
                {msg.role === 'user' ? (
                  <View style={[styles.bubble, styles.bubbleUser]}>
                    <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{msg.text}</Text>
                  </View>
                ) : (
                  <View style={[styles.bubble, styles.bubbleAI]}>
                    <MarkdownMessage text={msg.text} />
                    {msg.followUps?.length > 0 && (
                      <View style={styles.followUpRow}>
                        {msg.followUps.map((fu, j) => (
                          <TouchableOpacity
                            key={j}
                            style={styles.followUpChip}
                            onPress={() => sendMessage(fu)}
                          >
                            <Text style={styles.followUpText}>{fu}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={COLORS.gold} style={{ marginRight: 14 }} />
                <View>
                  <Text style={styles.loadingPhase}>{loadingPhase}</Text>
                  <Text style={styles.loadingEta}>Usually takes 5–15 seconds</Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Suggestions — shown when chat is NOT active */}
        {!chatActive && (
          <ScrollView
            style={styles.suggestionsScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsContent}
          >
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestChip}
                onPress={() => sendMessage(prompt)}
              >
                <Text style={styles.suggestText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputSection}>
          {chatActive && (
            <TouchableOpacity onPress={resetChat} style={styles.newChatBtn}>
              <Ionicons name="refresh" size={14} color={COLORS.textMuted} />
              <Text style={styles.newChatText}>New chat</Text>
            </TouchableOpacity>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask TasteBuddy AI anything…"
              placeholderTextColor={COLORS.textLight}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || loading}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {!chatActive && (
            <Text style={styles.desktopHint}>
              <Text style={{ fontStyle: 'italic' }}>
                Go to TasteBuddy.ai on your desktop to see more features and analytics!
              </Text>
            </Text>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  greeting: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: COLORS.text },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginTop: 3, lineHeight: 18 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 2 },
  iconBtn: { padding: 4 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Outfit_700Bold', color: '#fff', fontSize: 15 },

  tileRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16, height: 180 },
  tile: { flex: 1, borderRadius: 20, padding: 18, justifyContent: 'flex-end' },
  tileIcon: { marginBottom: 'auto' },
  tileTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15, marginTop: 20, marginBottom: 3 },
  tileSub: { fontFamily: 'DMSans_400Regular', fontSize: 11, opacity: 0.75, lineHeight: 15 },

  chatScroll: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  bubble: {
    borderRadius: 18, padding: 14, marginBottom: 10, maxWidth: '85%',
  },
  bubbleUser: { backgroundColor: COLORS.gold, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: COLORS.white, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: COLORS.border },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { fontFamily: 'DMSans_400Regular', color: '#fff' },
  bubbleTextAI: { fontFamily: 'DMSans_400Regular', color: COLORS.text },
  followUpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  followUpChip: {
    backgroundColor: COLORS.goldLight, borderRadius: 14, borderWidth: 0.5,
    borderColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 7,
  },
  followUpText: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: COLORS.tierSText },
  loadingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 16, marginBottom: 10,
    alignSelf: 'flex-start', maxWidth: '85%',
  },
  loadingPhase: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.tierSText,
  },
  loadingEta: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textLight, marginTop: 2,
  },

  suggestionsScroll: { maxHeight: 120 },
  suggestionsContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'flex-start' },
  suggestChip: {
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: 200,
  },
  suggestText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.text, lineHeight: 16 },

  inputSection: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  newChatText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 24, borderWidth: 0.5,
    borderColor: COLORS.border, paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  input: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text,
    paddingVertical: 8, maxHeight: 80,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  desktopHint: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textMuted,
    textAlign: 'center', marginTop: 10,
  },
});
