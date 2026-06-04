import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Platform,
  ActivityIndicator, Keyboard, Animated, Alert, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';
import MarkdownMessage from '../components/MarkdownMessage';
import TBLogo from '../components/TBLogo';
import AddPlaceActionCard from '../components/actions/AddPlaceActionCard';
import LogVisitActionCard from '../components/actions/LogVisitActionCard';
import SetReminderActionCard from '../components/actions/SetReminderActionCard';
import AddCategoryActionCard from '../components/actions/AddCategoryActionCard';
import ChecklistHeartIcon from '../components/ChecklistHeartIcon';
import ClarifyingQuestions from '../components/ClarifyingQuestions';

const TOP_TILES = [
  {
    id: 'log',
    title: 'Log a Visit',
    subtitle: 'Check in where you\'re eating',
    icon: 'location',
    bg: COLORS.gold,
    iconColor: '#fff',
    textColor: '#fff',
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

function fmtRecentDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = Math.floor((new Date() - d) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HomeScreen({ navigation, route }) {
  const { user } = useAuth();
  const [chatActive, setChatActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(LOADING_PHASES[0]);
  const [conversationId, setConversationId] = useState(null);
  const [completedActions, setCompletedActions] = useState({});
  const [recentSessions, setRecentSessions] = useState([]);
  const scrollRef = useRef(null);
  const chatInputRef = useRef(null);
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

  // Mark action cards complete when LogVisit/AddPlace navigate back with actionCompleted
  useEffect(() => {
    const cardId = route?.params?.actionCompleted;
    if (!cardId) return;
    setCompletedActions(prev => ({ ...prev, [cardId]: true }));
    navigation.setParams({ actionCompleted: undefined });
  }, [route?.params?.actionCompleted]);

  function loadRecentSessions() {
    api.json('/api/chat/sessions')
      .then(data => setRecentSessions((data || []).slice(0, 8)))
      .catch(() => {});
  }
  useEffect(() => { loadRecentSessions(); }, []);

  // Long-press a recent chat → rename or delete. Delete removes it from the
  // shared DB, so it's gone from history on web AND app.
  function recentChatActions(session) {
    Alert.alert(session.title || 'Chat', undefined, [
      { text: 'Rename', onPress: () => renameRecentChat(session) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteRecentChat(session) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  function renameRecentChat(session) {
    Alert.prompt(
      'Rename chat',
      'Enter a new name for this conversation.',
      async (newTitle) => {
        const t = (newTitle || '').trim();
        if (!t) return;
        try {
          await api.json(`/api/chat/sessions/${session.id}/rename`, {
            method: 'POST', body: JSON.stringify({ title: t }),
          });
          setRecentSessions(prev => prev.map(s => (s.id === session.id ? { ...s, title: t } : s)));
        } catch (_) {}
      },
      'plain-text',
      session.title || '',
    );
  }
  function confirmDeleteRecentChat(session) {
    Alert.alert('Delete chat?', 'This removes it from your history everywhere.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.json(`/api/chat/sessions/${session.id}`, { method: 'DELETE' });
            setRecentSessions(prev => prev.filter(s => s.id !== session.id));
            if (conversationId === session.id) resetChat();
          } catch (_) {}
        },
      },
    ]);
  }

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
      const msgIndex = messages.length + 1; // +1 for the user msg just added
      // Broad discovery query → render the server's structured clarifying
      // questions (NOT generic follow-up chips, which fired literal text and
      // looped). Otherwise show normal follow-ups.
      const clarifyQuestions = (data.is_clarifying && Array.isArray(data.questions) && data.questions.length)
        ? data.questions : null;
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.response || 'No response received.',
        clarifyQuestions,
        followUps: clarifyQuestions ? [] : getFollowUps(data.mode),
        actions: data.actions || [],
        msgIndex,
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

  function activateAI() {
    setChatActive(true);
    setTimeout(() => chatInputRef.current?.focus(), 200);
  }

  function resetChat() {
    stopPhaseTimer();
    setChatActive(false);
    setMessages([]);
    setConversationId(null);
    setInputText('');
    setLoadingPhase(LOADING_PHASES[0]);
    loadRecentSessions();   // refresh recent-chats list after a conversation
  }

  // ── Keyboard-aware composer offset ──────────────────────────────────────
  // Drive the input's bottom padding from the keyboard's endCoordinates.height
  // (which INCLUDES the QuickType suggestion bar). While the keyboard is up we
  // measure from the keyboard top with only a small GAP and DROP the bottom
  // safe-area inset (the keyboard already covers the home-indicator area); on
  // hide we restore the inset so the input rests correctly at the bottom.
  const insets = useSafeAreaInsets();
  const GAP = 8;
  const kbVisible = useRef(false);
  const kbPad = useRef(new Animated.Value(insets.bottom + GAP)).current;

  useEffect(() => {
    if (!kbVisible.current) kbPad.setValue(insets.bottom + GAP);
  }, [insets.bottom]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => {
      kbVisible.current = true;
      const h = (e && e.endCoordinates && e.endCoordinates.height) || 0;
      Animated.timing(kbPad, {
        toValue: h + GAP,                       // flush above keyboard, no safe inset
        duration: (e && e.duration) || 250,     // match the keyboard's animation
        useNativeDriver: false,                  // animating layout (paddingBottom)
      }).start();
    };
    const onHide = (e) => {
      kbVisible.current = false;
      Animated.timing(kbPad, {
        toValue: insets.bottom + GAP,            // restore safe-area inset at rest
        duration: (e && e.duration) || 250,
        useNativeDriver: false,
      }).start();
    };
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, [insets.bottom]);

  // Swipe right from within the chat → go BACK to the home/ask state (the chat
  // is a state, not a pushed screen, so we emulate the native back gesture).
  // Only claims clearly-horizontal rightward swipes, so vertical scroll/taps work.
  const swipeBack = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderRelease: (_e, g) => { if (g.dx > 70) resetChat(); },
    })
  ).current;

  const firstName = user?.display_name?.split(' ')[0] || 'there';

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
        {/* Header — always visible, even during chat */}
        <View style={styles.header}>
          <TouchableOpacity onPress={resetChat} activeOpacity={0.75} style={styles.logoBtn}>
            <TBLogo size={40} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.greeting, chatActive && styles.greetingChat]}>
              {chatActive ? 'Ask TasteBuddy AI' : `Hi ${firstName}`}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Activity')}
            >
              <ChecklistHeartIcon size={24} color={COLORS.text} />
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
          <View style={styles.tilesContainer}>
            <View style={styles.tileRow}>
              {TOP_TILES.map(tile => (
                <TouchableOpacity
                  key={tile.id}
                  style={[styles.tile, { backgroundColor: tile.bg }]}
                  onPress={() => navigation.navigate(tile.screen)}
                  activeOpacity={0.82}
                >
                  <Ionicons name={tile.icon} size={32} color={tile.iconColor} style={styles.tileIcon} />
                  <Text style={[styles.tileTitle, { color: tile.textColor }]}>{tile.title}</Text>
                  <Text style={[styles.tileSub, { color: tile.textColor }]}>{tile.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.aiTile} onPress={activateAI} activeOpacity={0.82}>
              <Ionicons name="chatbubble-ellipses" size={26} color={COLORS.gold} style={{ marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiTileTitle}>Ask TasteBuddy AI Anything</Text>
                <Text style={styles.aiTileSub}>Get personalized recommendations</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gold} />
            </TouchableOpacity>
          </View>
        )}

        {/* Chat messages */}
        {chatActive && (
          <View style={styles.chatScroll} {...swipeBack.panHandlers}>
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
                  <View>
                    <View style={[styles.bubble, styles.bubbleAI]}>
                      <MarkdownMessage text={msg.text} />
                      {msg.clarifyQuestions ? (
                        <ClarifyingQuestions
                          questions={msg.clarifyQuestions}
                          onSubmit={(t) => sendMessage(t)}
                          onSurprise={() => sendMessage('Surprise me — just give me your best picks, no more questions.')}
                        />
                      ) : msg.followUps?.length > 0 ? (
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
                      ) : null}
                    </View>
                    {msg.actions?.length > 0 && (
                      <View style={styles.actionCards}>
                        {msg.actions.map((action, j) => {
                          const cardId = `${i}-${j}`;
                          const completed = !!completedActions[cardId];
                          if (action.action === 'add_place') {
                            return <AddPlaceActionCard key={j} data={action} cardId={cardId} completed={completed} />;
                          }
                          if (action.action === 'log_visit') {
                            return <LogVisitActionCard key={j} data={action} cardId={cardId} completed={completed} />;
                          }
                          if (action.action === 'set_reminder') {
                            return <SetReminderActionCard key={j} data={action} />;
                          }
                          if (action.action === 'add_category') {
                            return <AddCategoryActionCard key={j} data={action} />;
                          }
                          return null;
                        })}
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
          </View>
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

        {/* Recent chats fill the space above the composer (and pin it to the
            bottom). During an active conversation the chat ScrollView plays that
            role instead. Falls back to an empty spacer when there are no chats. */}
        {!chatActive && (
          recentSessions.length > 0 ? (
            <View style={styles.recentWrap}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentLabel}>Recent chats</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ChatHistory')}>
                  <Text style={styles.recentSeeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.recentList} keyboardShouldPersistTaps="handled">
                {recentSessions.map(s => (
                  <TouchableOpacity key={s.id} style={styles.recentRow} onPress={() => loadSession(s)} onLongPress={() => recentChatActions(s)} delayLongPress={300} activeOpacity={0.75}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.gold} style={{ marginRight: 10 }} />
                    <Text style={styles.recentTitle} numberOfLines={1}>{s.title || 'Untitled chat'}</Text>
                    <Text style={styles.recentDate}>{fmtRecentDate(s.updated_at)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )
        )}

        {/* Input bar — paddingBottom is keyboard-driven (endCoordinates), and
            drops the safe-area inset while the keyboard is visible. */}
        <Animated.View style={[styles.inputSection, { paddingBottom: kbPad }]}>
          {chatActive && (
            <TouchableOpacity onPress={resetChat} style={styles.newChatBtn}>
              <Ionicons name="refresh" size={14} color={COLORS.textMuted} />
              <Text style={styles.newChatText}>New chat</Text>
            </TouchableOpacity>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={chatInputRef}
              style={styles.input}
              placeholder="Ask TasteBuddy AI anything…"
              placeholderTextColor={COLORS.textLight}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              multiline={false}
              autoCorrect={true}
              spellCheck={true}
              autoCapitalize="sentences"
              keyboardType="default"
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
        </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    paddingTop: 12,
    paddingBottom: 12,
  },
  logoBtn: { padding: 2 },
  greeting: { fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: COLORS.text },
  greetingChat: { fontSize: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { padding: 3 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Outfit_700Bold', color: '#fff', fontSize: 15 },

  tilesContainer: { paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  tileRow: { flexDirection: 'row', gap: 10, height: 160 },
  tile: { flex: 1, borderRadius: 20, padding: 18, justifyContent: 'flex-end' },
  tileIcon: { marginBottom: 'auto' },
  tileTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15, marginTop: 20, marginBottom: 3 },
  tileSub: { fontFamily: 'DMSans_400Regular', fontSize: 11, opacity: 0.75, lineHeight: 15 },
  aiTile: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.gold,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  aiTileTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: COLORS.text },
  aiTileSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

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
  actionCards: { marginBottom: 10 },
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

  recentWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 6 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  recentLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  recentSeeAll: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.gold },
  recentList: { paddingBottom: 8 },
  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8,
  },
  recentTitle: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.text, marginRight: 8 },
  recentDate: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textLight },

  inputSection: { paddingHorizontal: 16, paddingTop: 8 },  // paddingBottom is keyboard-driven (kbPad)
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
