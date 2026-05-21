import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../../api/client';

export default function SetReminderActionCard({ data }) {
  const [completed, setCompleted] = useState(false);
  const [reason, setReason] = useState(data.reason || '');
  const [reminderDate, setReminderDate] = useState(
    data.reminder_at ? data.reminder_at.split('T')[0] : ''
  );
  const [reminderTime, setReminderTime] = useState(
    data.reminder_at ? (data.reminder_at.split('T')[1] || '').substring(0, 5) : '09:00'
  );
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!reminderDate) { Alert.alert('Pick a date'); return; }
    setLoading(true);
    try {
      const dt = new Date(`${reminderDate}T${reminderTime || '09:00'}`);
      const resp = await api.json('/api/reminders', {
        method: 'POST',
        body: JSON.stringify({
          place_name: data.place_name || null,
          reminder_at: dt.toISOString(),
          reason: reason.trim(),
        }),
      });
      if (resp.success) setCompleted(true);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <Text style={styles.successText}>✓ Reminder set!</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Set Reminder</Text>
      {data.place_name ? <Text style={styles.cardPlace}>{data.place_name}</Text> : null}
      <TextInput
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder="What to remember…"
        placeholderTextColor="#aaa"
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={reminderDate}
          onChangeText={setReminderDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#aaa"
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={reminderTime}
          onChangeText={setReminderTime}
          placeholder="HH:MM"
          placeholderTextColor="#aaa"
          keyboardType="numbers-and-punctuation"
        />
      </View>
      <TouchableOpacity style={styles.goldButton} onPress={submit} disabled={loading}>
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.goldButtonText}>Set Reminder</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    borderColor: '#D97706',
    borderLeftWidth: 3,
    borderLeftColor: '#C8960C',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    backgroundColor: '#FEFCE8',
  },
  cardSuccess: {
    backgroundColor: '#EAF3DE',
    borderColor: '#27500A',
    borderLeftColor: '#27500A',
  },
  cardHeader: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 10,
    color: '#713F12',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardPlace: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 10,
  },
  input: {
    borderWidth: 0.5,
    borderColor: '#D97706',
    borderRadius: 8,
    padding: 8,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: '#1a1a1a',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  goldButton: {
    backgroundColor: '#C8960C',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    marginTop: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  goldButtonText: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 13,
  },
  successText: {
    fontFamily: 'DMSans_700Bold',
    color: '#27500A',
    fontSize: 14,
  },
});
