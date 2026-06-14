import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import MarkdownMessage from '../../components/MarkdownMessage';
import { COLORS } from '../../constants/colors';

const FOLLOW_UP_PROMPTS = [
  'What\'s the best Italian near me?',
  'Plan me a 3-stop food crawl',
  'Where should I go for a special occasion?',
];

export default function OnboardingAskAIScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const { refreshUser } = useAuth();

  const [messages, setMessages] = useState([]); // [{role: 'user'|'ai', text}]
  const [questionsRemaining, setQuestionsRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const conversationId = useRef(null);
  const scrollRef = useRef(null);

  const initialQuestion = city
    ? `Where should I eat dinner in ${city} tonight?`
    : 'Where should I eat dinner tonight based on my rankings?';

  useEffect(() => {
    setMessages([{ role: 'user', text: initialQuestion }]);
    sendQuestion(initialQuestion, true);
  }, []);

  async function sendQuestion(message, isInitial = false) {
    if (!isInitial) {
      setMessages(prev => [...prev, { role: 'user', text: message }]);
      setFollowUpLoading(true);
    }
    try {
      const data = await api.json('/api/ask/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversation_id: conversationId.current,
          // Onboarding taste, not a charge: ask the backend to NOT decrement the
          // free 3/30-day quota for this call. (Honored once the companion web
          // change lands — see report; meanwhile we simply never show a counter.)
          onboarding: true,
        }),
      });
      conversationId.current = data.conversation_id;
      const aiText = data.response || '';
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
      if (data.questions_remaining !== undefined) {
        setQuestionsRemaining(data.questions_remaining);
      }
    } catch (e) {
      if (!isInitial) Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setFollowUpLoading(false);
      setFollowUpText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function handleFollowUp(text) {
    if (!text.trim() || followUpLoading) return;
    sendQuestion(text.trim());
  }

  function handleDone() {
    navigation.navigate('Paywall', { city });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Ask TasteBuddy AI Anything</Text>
          <Text style={styles.headerSub}>A taste of what it can do — from your own list</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Chat messages */}
          {messages.map((msg, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                msg.role === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              {msg.role === 'ai' ? (
                <MarkdownMessage text={msg.text} />
              ) : (
                <Text selectable style={styles.userBubbleText}>{msg.text}</Text>
              )}
            </View>
          ))}

          {/* Typing indicator while initial or follow-up loads */}
          {(loading || followUpLoading) && (
            <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
              <ActivityIndicator size="small" color={COLORS.gold} />
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          )}

          {/* Follow-up prompts — show after first AI response */}
          {!loading && messages.some(m => m.role === 'ai') && (
            <>
              <View style={styles.highlightBox}>
                <Text style={styles.highlightText}>
                  💚 That recommendation filters out places you ranked lower and focuses on what you actually like.
                </Text>
              </View>

              <Text style={styles.followUpLabel}>Try asking:</Text>
              {FOLLOW_UP_PROMPTS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.promptChip}
                  onPress={() => handleFollowUp(prompt)}
                  disabled={followUpLoading}
                >
                  <Text style={styles.promptText}>"{prompt}"</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.followUpRow}>
                <TextInput
                  style={styles.followUpInput}
                  value={followUpText}
                  onChangeText={setFollowUpText}
                  placeholder="Ask something else…"
                  placeholderTextColor={COLORS.textLight}
                  returnKeyType="send"
                  onSubmitEditing={() => handleFollowUp(followUpText)}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !followUpText.trim() && styles.sendBtnDisabled]}
                  onPress={() => handleFollowUp(followUpText)}
                  disabled={!followUpText.trim() || followUpLoading}
                >
                  {followUpLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.sendBtnText}>→</Text>}
                </TouchableOpacity>
              </View>

            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleDone} disabled={loading}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: COLORS.border,
  },
  logo: { fontFamily: 'Outfit_800ExtraBold', fontSize: 18, color: COLORS.gold },
  headerSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  bubble: {
    borderRadius: 16, padding: 14, marginBottom: 10, maxWidth: '90%',
  },
  userBubble: {
    alignSelf: 'flex-end', backgroundColor: COLORS.gold,
    borderBottomRightRadius: 4,
  },
  userBubbleText: {
    fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#fff', lineHeight: 20,
  },
  aiBubble: {
    alignSelf: 'flex-start', backgroundColor: '#fff',
    borderWidth: 0.5, borderColor: COLORS.border,
    borderBottomLeftRadius: 4, maxWidth: '95%',
  },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12,
  },
  typingText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted,
  },
  highlightBox: {
    backgroundColor: '#EAF3DE', borderRadius: 12, padding: 14, marginBottom: 20, marginTop: 4,
  },
  highlightText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#27500A', lineHeight: 19,
  },
  followUpLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 12, color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  promptChip: {
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  promptText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.text },
  followUpRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  followUpInput: {
    flex: 1, backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 14, color: COLORS.text, fontFamily: 'DMSans_400Regular',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  paywallNote: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted,
    textAlign: 'center', marginTop: 12,
  },
  footer: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17, alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
