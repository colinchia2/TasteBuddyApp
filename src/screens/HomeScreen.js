import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Platform,
  ActivityIndicator, Keyboard, Animated, PanResponder, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
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

// Offline/error fallback only — the live chips come from GET /api/ask/suggestions
// (same personalized builder as the web /ask page, so both platforms show
// identical text).
const SUGGESTED_PROMPTS = [
  "What's my best pick for a special night out?",
  "Find me a new neighborhood spot I haven't tried",
  "Plan me a 3-stop food crawl this weekend",
  "What should I try next from my list?",
];

// Pure-JS UUID v4 for conversation ids. No native module (OTA-safe — does NOT depend on
// expo-crypto/crypto being in the binary). 122 bits of entropy → cross-user collisions
// are negligible, unlike the old `conv-${Date.now()}` which collided on same-ms starts.
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const FOLLOW_UPS = {
  recommend:       ['Find me somewhere similar', 'What cuisines haven\'t I explored?', 'Make it more casual'],
  discover_new:    ['What\'s the best time to go?', 'Find somewhere similar', 'Any hidden gems nearby?'],
  plan_visit:      ['What should I order?', 'Find me a backup option', 'What\'s the vibe like?'],
  taste_analysis:  ['What should I try next?', 'Find a spot that fits my taste', 'What\'s my most visited cuisine?'],
  food_crawl:      ['Which stop should I hit first?', 'Make it a longer crawl', 'Any drink spots to add?'],
  organize_nextup: ['What\'s been on my list longest?', 'Find me something new to add', 'Which ones are S-tier worthy?'],
  log_visit:       ['How does that compare to my S-tier?', 'What should I try next?', 'Find somewhere similar'],
  // No chips after a reminder confirmation — the action card is the next step;
  // generic discovery chips there are noise (server skips ---FOLLOWUPS--- too).
  set_reminder:    [],
  default:         ['Find me somewhere new to try', 'What cuisines haven\'t I explored?', 'What\'s my S-tier list?'],
};

function getFollowUps(mode) {
  return (FOLLOW_UPS[mode] || FOLLOW_UPS.default).slice(0, 3);
}

// Port of the web client's _stripPartialBlocks (ask/index.html): while streaming,
// hide any structural block that has opened (`---TAG---`) but not yet closed, so
// the user never sees raw ---ACTIONS---/---PLACES---/etc. JSON mid-stream. On
// stream_end we discard this and use the server's already-clean `response`.
function stripPartialBlocks(text) {
  let clean = text;
  for (const tag of ['PLACES', 'ACTIONS', 'FOLLOWUPS', 'QUESTIONS', 'META']) {
    const opener = '---' + tag + '---';
    const idx = clean.lastIndexOf(opener);
    if (idx !== -1 && !clean.substring(idx + opener.length).includes(opener)) {
      clean = clean.substring(0, idx).trimEnd();
    }
  }
  return clean;
}

// Device location for "near me / walkable" questions — mirrors the server's
// _NEAR_ME_RE (the server only USES coords when the message carries near-me
// intent, so sending them otherwise is harmless). The permission prompt fires
// only for a near-me question (contextual), or the grant from Check-in /
// Add-Place is reused silently.
const NEAR_ME_RE = /\b(near ?me|nearby|around here|around me|close by|close to me|walking distance|walkable|near my location|where i am)\b/i;

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
  // Drives "typing focus" — collapse the bulky home tiles while the keyboard is up so a
  // multiline input always has room above the keyboard (else it overflows behind it).
  const [keyboardShown, setKeyboardShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(LOADING_PHASES[0]);
  const [conversationId, setConversationId] = useState(null);
  // Cross-user AI target ({id, name}) — set via the Persona profile's chips;
  // null = normal self chat. Sent as persona_user_id on every chat call.
  const [personaAsk, setPersonaAsk] = useState(null);
  const [completedActions, setCompletedActions] = useState({});
  const [unreadNotifs, setUnreadNotifs] = useState(0);   // bell badge — same count as web
  const [suggestedPrompts, setSuggestedPrompts] = useState(SUGGESTED_PROMPTS);
  const scrollRef = useRef(null);
  const chatInputRef = useRef(null);
  const phaseTimerRef = useRef(null);
  // Streaming state: raw accumulated SSE text, the UI flush timer, the in-flight
  // AbortController, and whether auto-scroll should follow growing content.
  const streamRawRef = useRef('');
  const flushTimerRef = useRef(null);
  const streamAbortRef = useRef(null);
  const autoScrollRef = useRef(false);
  const coordsRef = useRef(null);   // last device fix for near-me asks

  useEffect(() => {
    if (chatActive && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, chatActive]);

  // Bell badge: refetch the unread count whenever Home regains focus — so it
  // reflects deletes / clear-all / mark-all-read done on the Notifications screen
  // (web recomputes per page load; this is the app equivalent). Same DB count
  // (is_read=False) the web nav badge uses.
  useFocusEffect(useCallback(() => {
    api.json('/api/notifications/unread-count')
      .then(d => setUnreadNotifs(d?.count || 0))
      .catch(() => {});
    // Personalized pre-ask chips — refetched on focus (the app equivalent of the
    // web /ask page rebuilding them per page load). Falls back to the hardcoded
    // list on any error.
    api.json('/api/ask/suggestions')
      .then(d => {
        if (Array.isArray(d?.prompts) && d.prompts.length) setSuggestedPrompts(d.prompts);
      })
      .catch(() => {});
    // Warm the coords cache silently — NO permission prompt here (Home is the
    // root screen); only reuse a grant Check-in / Add-Place already obtained.
    Location.getForegroundPermissionsAsync()
      .then(async ({ status }) => {
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        if (last) coordsRef.current = { lat: last.coords.latitude, lng: last.coords.longitude };
      })
      .catch(() => {});
  }, []));

  // Near-me question → make sure we have a real fix: prompt for permission if
  // needed (contextual — the user just asked about "nearby"), then take a fresh
  // Balanced-accuracy reading, capped at 4s so the ask never hangs on GPS.
  async function ensureCoords(msg) {
    if (!NEAR_ME_RE.test(msg)) return coordsRef.current;
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') return coordsRef.current;
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (pos) coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {}
    return coordsRef.current;
  }

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

  // Cross-user AI from a Persona profile: {id, name, prompt} arms the chat so
  // every send carries persona_user_id (mirrors web /ask?persona_user_id=&prompt=).
  // The chip's prompt PREFILLS the input (web parity) — the user hits send.
  useEffect(() => {
    const pa = route?.params?.personaAsk;
    if (!pa) return;
    setPersonaAsk({ id: pa.id, name: pa.name });
    if (pa.prompt) setInputText(pa.prompt);
    setChatActive(true);
    navigation.setParams({ personaAsk: undefined });
  }, [route?.params?.personaAsk]);

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

  // Throttle UI updates: deltas accumulate into streamRawRef; this interval flushes
  // the stripped text into the streaming AI bubble every ~45ms (never per-token, to
  // avoid re-render jank). `flushNow` forces a final paint at stream end.
  function startFlushTimer() {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setInterval(flushStreamingText, 45);
  }
  function stopFlushTimer() {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }
  function flushStreamingText() {
    const display = stripPartialBlocks(streamRawRef.current);
    setMessages(prev => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'ai' && next[i].streaming) {
          next[i] = { ...next[i], text: display };
          break;
        }
      }
      return next;
    });
  }

  // Cancel any in-flight stream and stop timers when the screen unmounts.
  useEffect(() => () => {
    if (streamAbortRef.current) streamAbortRef.current.abort();
    stopFlushTimer();
    stopPhaseTimer();
  }, []);

  // Builds the finished AI message from the stream_end payload. Identical shape to
  // the old non-streaming path so the rendered result (text + clarifying questions
  // OR follow-up chips + action cards) is byte-for-byte what it was before — only
  // the reveal is now incremental.
  function finalizedAiMessage(evt) {
    // Broad discovery query → render the server's structured clarifying questions
    // (NOT generic follow-up chips, which fired literal text and looped).
    const clarifyQuestions = (evt.is_clarifying && Array.isArray(evt.questions) && evt.questions.length)
      ? evt.questions : null;
    // Prefer the server's AI-generated followups (---FOLLOWUPS--- block, already
    // in stream_end as `followups` — same chips the web renders); the hardcoded
    // mode lookup is only the fallback when the model emitted none.
    const serverFollowUps = Array.isArray(evt.followups)
      ? evt.followups.filter(f => typeof f === 'string' && f.trim()).slice(0, 3)
      : [];
    return {
      role: 'ai',
      text: evt.response || streamRawRef.current || 'No response received.',
      clarifyQuestions,
      followUps: clarifyQuestions ? [] : (serverFollowUps.length ? serverFollowUps : getFollowUps(evt.mode)),
      actions: evt.actions || [],
      streaming: false,
    };
  }

  // Replace the in-flight streaming AI bubble with `next`, or append it if none.
  function replaceStreamingBubble(next) {
    setMessages(prev => {
      const out = [...prev];
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].role === 'ai' && out[i].streaming) { out[i] = next; return out; }
      }
      out.push(next);
      return out;
    });
  }

  async function sendMessage(text) {
    const msg = (text || inputText).trim();
    if (!msg || loading) return;
    setInputText('');
    Keyboard.dismiss();
    setChatActive(true);
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    setAwaitingFirstToken(true);
    startPhaseTimer();

    // New chats get a real UUID (was `conv-${Date.now()}`, which collided across users in
    // the same millisecond → duplicate chat_sessions PK 500s). The server may still
    // regenerate it on a legacy collision; we adopt the returned id below.
    const convId = conversationId || uuidv4();
    if (!conversationId) setConversationId(convId);

    // Near-me asks block briefly (≤4s) on a GPS fix; loading UI is already up.
    const coords = await ensureCoords(msg);

    streamRawRef.current = '';
    autoScrollRef.current = true;
    const controller = new AbortController();
    streamAbortRef.current = controller;

    let bubbleAdded = false;
    let gotStreamEnd = false;
    const ensureBubble = () => {
      if (bubbleAdded) return;
      bubbleAdded = true;
      setMessages(prev => [...prev, { role: 'ai', text: '', streaming: true }]);
    };

    try {
      await api.stream('/api/ask/chat/stream',
        {
          message: msg, conversation_id: convId,
          lat: coords ? coords.lat : null, lng: coords ? coords.lng : null,
          persona_user_id: personaAsk ? personaAsk.id : null,
        },
        {
          signal: controller.signal,
          onEvent: (evt) => {
            if (evt.type === 'error') {
              throw new Error(evt.message || 'stream_error');
            }
            // Adopt the server's conversation_id — it may have been regenerated on a
            // cross-user id collision, so turn 2 must reuse the server's id, not ours.
            if (evt.conversation_id) setConversationId(evt.conversation_id);
            if (evt.type === 'text_delta') {
              if (!bubbleAdded) {
                // First token: kill the typing indicator and reveal the bubble.
                stopPhaseTimer();
                setAwaitingFirstToken(false);
                ensureBubble();
                startFlushTimer();
              }
              streamRawRef.current += (evt.delta || '');
            }
            if (evt.type === 'stream_end') {
              gotStreamEnd = true;
              stopFlushTimer();
              ensureBubble();   // guard: 0-token responses still get a bubble
              replaceStreamingBubble(finalizedAiMessage(evt));
            }
          },
        });

      // Stream closed without a stream_end frame → treat as a mid-stream drop.
      if (!gotStreamEnd) throw new Error('stream_incomplete');
    } catch (e) {
      stopFlushTimer();
      stopPhaseTimer();
      // User left/reset the chat — leave the UI as the reset already set it.
      if (e.name === 'AbortError' || controller.signal.aborted) return;

      // Out of free questions — show the upsell, skip the fallback round-trip.
      if (e.status === 402 || e.message === 'paywall') {
        replaceStreamingBubble({
          role: 'ai',
          text: "You've used your free questions. Upgrade at TasteBuddy.ai!",
        });
        return;
      }

      if (!bubbleAdded) {
        // Failed before any token streamed → fall back to the non-streaming call
        // (same endpoint family, identical payload), exactly like the web client.
        try {
          const data = await api.json('/api/ask/chat', {
            method: 'POST',
            body: JSON.stringify({
              message: msg, conversation_id: convId,
              lat: coords ? coords.lat : null, lng: coords ? coords.lng : null,
              persona_user_id: personaAsk ? personaAsk.id : null,
            }),
          });
          if (data.conversation_id) setConversationId(data.conversation_id);
          replaceStreamingBubble(finalizedAiMessage({
            response: data.response, mode: data.mode,
            is_clarifying: data.is_clarifying, questions: data.questions,
            actions: data.actions || [],
            followups: data.followups || [],
          }));
          return;
        } catch (fbErr) {
          const paywall = fbErr.message === 'paywall' || fbErr.status === 402
            || e.message === 'paywall' || e.status === 402;
          setMessages(prev => [...prev, {
            role: 'ai',
            text: paywall
              ? "You've used your free questions. Upgrade at TasteBuddy.ai!"
              : 'Something went wrong. Try again!',
            error: !paywall,
            retryText: paywall ? null : msg,
          }]);
          return;
        }
      }

      // Error after partial text → keep what streamed, append a retry affordance.
      replaceStreamingBubble({
        role: 'ai',
        text: stripPartialBlocks(streamRawRef.current),
        streaming: false,
        error: true,
        retryText: msg,
        errorNote: 'Connection lost mid-response.',
      });
    } finally {
      stopFlushTimer();
      stopPhaseTimer();
      setLoading(false);
      setAwaitingFirstToken(false);
      autoScrollRef.current = false;
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
    }
  }

  function resetChat() {
    if (streamAbortRef.current) { streamAbortRef.current.abort(); streamAbortRef.current = null; }
    stopFlushTimer();
    stopPhaseTimer();
    setLoading(false);
    setAwaitingFirstToken(false);
    setChatActive(false);
    setMessages([]);
    setConversationId(null);
    setPersonaAsk(null);   // leaving the chat drops the cross-user target
    setInputText('');
    setLoadingPhase(LOADING_PHASES[0]);
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
      setKeyboardShown(true);
      const h = (e && e.endCoordinates && e.endCoordinates.height) || 0;
      Animated.timing(kbPad, {
        toValue: h + GAP,                       // flush above keyboard, no safe inset
        duration: (e && e.duration) || 250,     // match the keyboard's animation
        useNativeDriver: false,                  // animating layout (paddingBottom)
      }).start();
    };
    const onHide = (e) => {
      kbVisible.current = false;
      setKeyboardShown(false);
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

  // Logo tap: while the keyboard is up, just bring it down (keep the draft + show the
  // home content again) instead of resetting; otherwise it's the home/new-chat reset.
  const onLogoPress = () => {
    if (keyboardShown) {
      Keyboard.dismiss();
    } else {
      resetChat();
    }
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
        {/* Header — always visible, even during chat */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onLogoPress} activeOpacity={0.75} style={styles.logoBtn}>
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
              {unreadNotifs > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
                </View>
              )}
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

        {/* Home tiles — hidden during a chat. Wrapped in a ScrollView so they stay
            visible (scrollable) while the keyboard is up; the input bar stays pinned
            above the keyboard rather than the tiles being cleared. */}
        {!chatActive && (
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
            <TouchableOpacity
              style={styles.browseTile}
              onPress={() => navigation.navigate('MyPlaces')}
              activeOpacity={0.82}
            >
              <View style={styles.browseIconWrap}>
                <Ionicons name="list" size={22} color={COLORS.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.browseTitle}>My Places</Text>
                <Text style={styles.browseSub}>Browse your ranked Places</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.browseTile}
              onPress={() => navigation.navigate('Personas')}
              activeOpacity={0.82}
            >
              <View style={styles.browseIconWrap}>
                <Ionicons name="people" size={22} color={COLORS.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.browseTitle}>Tastie Personas</Text>
                <Text style={styles.browseSub}>Browse taste profiles and ask their AI</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          </ScrollView>
        )}

        {/* Chat messages */}
        {chatActive && (
          <View style={styles.chatScroll} {...swipeBack.panHandlers}>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              // Follow the growing response while streaming; don't fight the user
              // once the turn settles.
              if (autoScrollRef.current) scrollRef.current?.scrollToEnd({ animated: false });
            }}
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
                      {msg.errorNote ? (
                        <Text style={styles.errorNote}>{msg.errorNote}</Text>
                      ) : null}
                      {msg.error && msg.retryText ? (
                        <TouchableOpacity
                          style={styles.retryBtn}
                          onPress={() => sendMessage(msg.retryText)}
                        >
                          <Ionicons name="refresh" size={14} color={COLORS.gold} style={{ marginRight: 6 }} />
                          <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                      ) : msg.clarifyQuestions ? (
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
            {loading && awaitingFirstToken && (
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

        {/* Input bar — paddingBottom is keyboard-driven (endCoordinates), and
            drops the safe-area inset while the keyboard is visible. Chat History +
            suggestions live INSIDE this bottom-pinned block, directly above the
            textbox, so they're clearly grouped and basically touching the input. */}
        <Animated.View style={[styles.inputSection, { paddingBottom: kbPad }]}>
          {chatActive && (
            <TouchableOpacity onPress={resetChat} style={styles.newChatBtn}>
              <Ionicons name="refresh" size={14} color={COLORS.textMuted} />
              <Text style={styles.newChatText}>New chat</Text>
            </TouchableOpacity>
          )}
          {!chatActive && (
            <>
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => navigation.navigate('ChatHistory')}
                activeOpacity={0.75}
              >
                <Ionicons name="time-outline" size={15} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.historyBtnText}>Chat History</Text>
              </TouchableOpacity>
              <ScrollView
                style={styles.suggestionsScroll}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsContent}
                keyboardShouldPersistTaps="handled"
              >
                {suggestedPrompts.map((prompt, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestChip}
                    onPress={() => sendMessage(prompt)}
                  >
                    <Text style={styles.suggestText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          {personaAsk && (
            <View style={styles.personaBanner}>
              <Text style={styles.personaBannerText}>
                Asking {personaAsk.name.split(' ')[0]}'s AI
              </Text>
              <TouchableOpacity onPress={() => setPersonaAsk(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={14} color={COLORS.tierSText} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={chatInputRef}
              style={styles.input}
              placeholder="Ask TasteBuddy AI Anything"
              placeholderTextColor={COLORS.textLight}
              value={inputText}
              onChangeText={setInputText}
              multiline={true}
              textAlignVertical="top"
              returnKeyType="default"
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
            <TouchableOpacity
              onPress={() => Linking.openURL('https://tastebuddy-colinchia2.pythonanywhere.com/')}
              activeOpacity={0.7}
            >
              <Text style={styles.desktopLink}>
                Go to TasteBuddy.ai on your desktop to see your TasteBoard and more features!
              </Text>
            </TouchableOpacity>
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
  // Unread bell badge — matches web (#E24B4A / white, no border).
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { fontFamily: 'DMSans_700Bold', fontSize: 9, color: COLORS.white },
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
  browseTile: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  browseIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.goldLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  browseTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: COLORS.text },
  browseSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

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
  errorNote: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.tierNextUpText, marginTop: 8 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: COLORS.goldLight, borderRadius: 14, borderWidth: 0.5,
    borderColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12,
  },
  retryText: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: COLORS.tierSText },
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

  // Lives inside the bottom input block now: hug content height, bleed to the
  // screen edges (cancel inputSection's 16 padding) so chips scroll edge-to-edge,
  // and leave a small visual break above the textbox.
  suggestionsScroll: { marginHorizontal: -16, marginBottom: 8 },
  suggestionsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  suggestChip: {
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 0.5,
    borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: 200,
  },
  suggestText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.text, lineHeight: 16 },

  // Chat History sits at the top of the bottom group, right-aligned, snug above
  // the suggestions.
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
    paddingVertical: 6, marginBottom: 2,
  },
  historyBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.textMuted },

  inputSection: { paddingHorizontal: 16, paddingTop: 8 },  // paddingBottom is keyboard-driven (kbPad)
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  newChatText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: COLORS.white, borderRadius: 24, borderWidth: 0.5,
    borderColor: COLORS.border, paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  // Cross-user AI indicator (persona ask) — gold-light pill above the composer
  personaBanner: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    backgroundColor: COLORS.goldLight, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 6,
  },
  personaBannerText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.tierSText },
  input: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text,
    paddingVertical: 8, minHeight: 24, maxHeight: 96,   // ~4 lines, then scrolls internally
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  desktopLink: {
    fontFamily: 'DMSans_500Medium', fontSize: 12, color: COLORS.gold,
    textAlign: 'center', marginTop: 10,
  },
});
