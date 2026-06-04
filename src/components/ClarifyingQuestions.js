import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

// Renders the server's discovery/clarifying questions (is_clarifying + questions)
// as tappable options + a custom field + submit — parity with the web clarifying
// UI. Selecting an option/typing registers a STRUCTURED answer; on submit we
// compile a single specific message (so it advances to a real recommendation,
// never re-classifies into a confused loop). "Surprise me" skips to picks.
export default function ClarifyingQuestions({ questions, onSubmit, onSurprise }) {
  const [answers, setAnswers] = useState({});   // { [qIndex]: string }
  const [submitted, setSubmitted] = useState(false);

  function setAnswer(i, val) {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [i]: val }));
  }

  const allAnswered = questions.every((_, i) => (answers[i] || '').trim().length > 0);

  function submit() {
    if (!allAnswered || submitted) return;
    setSubmitted(true);
    const compiled = questions.map((q, i) => `${q.question} ${(answers[i] || '').trim()}`).join(' | ');
    onSubmit(compiled);
  }
  function surprise() {
    if (submitted) return;
    setSubmitted(true);
    onSurprise();
  }

  return (
    <View style={styles.wrap}>
      {questions.map((q, i) => {
        const opts = q.options || [];
        const isCustom = answers[i] != null && answers[i] !== '' && !opts.includes(answers[i]);
        return (
          <View key={i} style={styles.card}>
            <Text style={styles.question}>{q.question}</Text>
            {opts.map((opt, j) => {
              const selected = answers[i] === opt;
              return (
                <TouchableOpacity
                  key={j}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setAnswer(i, opt)}
                  disabled={submitted}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={[styles.optionText, selected && styles.optionTextOn]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            <TextInput
              style={styles.customInput}
              placeholder="Or type your own…"
              placeholderTextColor={COLORS.textLight}
              value={isCustom ? answers[i] : ''}
              onChangeText={(t) => setAnswer(i, t)}
              editable={!submitted}
            />
          </View>
        );
      })}

      {!submitted && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.submitBtn, !allAnswered && styles.submitBtnOff]}
            onPress={submit}
            disabled={!allAnswered}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>Get my recommendations →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.surpriseBtn} onPress={surprise} activeOpacity={0.7}>
            <Text style={styles.surpriseText}>Surprise me</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 12 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, padding: 12,
  },
  question: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.text, marginBottom: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 10, borderRadius: 9, marginBottom: 6,
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: COLORS.offWhite,
  },
  optionSelected: { borderColor: COLORS.gold, backgroundColor: COLORS.goldLight },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: COLORS.border,
    marginRight: 10, alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: COLORS.gold },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.gold },
  optionText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.text },
  optionTextOn: { fontFamily: 'DMSans_700Bold', color: '#633806' },
  customInput: {
    borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 9, marginTop: 2,
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.text, backgroundColor: '#fff',
  },
  actions: { gap: 8 },
  submitBtn: {
    backgroundColor: COLORS.gold, borderRadius: 22, paddingVertical: 12, alignItems: 'center',
  },
  submitBtnOff: { backgroundColor: '#e8c46a', opacity: 0.6 },
  submitText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#fff' },
  surpriseBtn: { alignItems: 'center', paddingVertical: 8 },
  surpriseText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: COLORS.gold },
});
