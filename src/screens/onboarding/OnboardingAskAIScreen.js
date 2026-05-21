import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { COLORS } from '../../constants/colors';

const FOLLOW_UP_PROMPTS = [
  'What\'s the best Italian near me?',
  'Plan me a 3-stop food crawl',
  'Where should I go for a special occasion?',
];

export default function OnboardingAskAIScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const { refreshUser } = useAuth();
  const [response, setResponse] = useState('');
  const [questionsRemaining, setQuestionsRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const conversationId = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    sendInitialQuestion();
  }, []);

  async function sendInitialQuestion() {
    const question = city
      ? `Where should I eat dinner in ${city} tonight?`
      : 'Where should I eat dinner tonight based on my rankings?';
    await sendQuestion(question, true);
  }

  async function sendQuestion(message, isInitial = false) {
    if (!isInitial) setFollowUpLoading(true);
    try {
      const data = await api.json('/api/ask/chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversation_id: conversationId.current,
        }),
      });
      conversationId.current = data.conversation_id;
      setResponse(data.response || '');
      if (data.questions_remaining !== undefined) {
        setQuestionsRemaining(data.questions_remaining);
      }
    } catch (e) {
      if (!isInitial) Alert.alert('Error', e.message);
      setResponse('');
    } finally {
      setLoading(false);
      setFollowUpLoading(false);
      setFollowUpText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function handleDone() {
    setFinishing(true);
    try {
      await api.json('/api/onboarding/complete', { method: 'POST' });
      await refreshUser();
      // refreshUser updates onboarding_complete → RootNavigator switches to main app
    } catch (e) {
      Alert.alert('Error', e.message);
      setFinishing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>TasteBuddy AI</Text>
          <Text style={styles.headerSub}>Asking based on YOUR rankings</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.gold} size="large" />
              <Text style={styles.loadingText}>Asking AI based on your taste profile…</Text>
            </View>
          ) : (
            <>
              <View style={styles.aiCard}>
                <Text style={styles.aiResponse}>{response}</Text>
              </View>

              <View style={styles.highlightBox}>
                <Text style={styles.highlightText}>
                  💚 That recommendation is personalized to your tier list — it filters out places you ranked lower and focuses on what you actually like.
                </Text>
              </View>

              <Text style={styles.followUpLabel}>Try asking:</Text>
              {FOLLOW_UP_PROMPTS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.promptChip}
                  onPress={() => sendQuestion(prompt)}
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
                  onSubmitEditing={() => followUpText.trim() && sendQuestion(followUpText.trim())}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !followUpText.trim() && styles.sendBtnDisabled]}
                  onPress={() => followUpText.trim() && sendQuestion(followUpText.trim())}
                  disabled={!followUpText.trim() || followUpLoading}
                >
                  {followUpLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.sendBtnText}>→</Text>}
                </TouchableOpacity>
              </View>

              {questionsRemaining !== null && (
                <Text style={styles.paywallNote}>
                  {questionsRemaining} free question{questionsRemaining !== 1 ? 's' : ''} remaining this month
                </Text>
              )}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleDone} disabled={finishing || loading}>
            {finishing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Go to TasteBoard →</Text>}
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  loadingBox: { alignItems: 'center', paddingVertical: 60 },
  loadingText: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, marginTop: 14,
  },
  aiCard: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 0.5, borderColor: COLORS.border,
    padding: 18, marginBottom: 14,
  },
  aiResponse: {
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.text, lineHeight: 22,
  },
  highlightBox: {
    backgroundColor: '#EAF3DE', borderRadius: 12, padding: 14, marginBottom: 20,
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
