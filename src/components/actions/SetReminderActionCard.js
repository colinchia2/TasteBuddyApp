import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { api } from '../../api/client';

function isoDateToDisplay(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  if (p.length !== 3) return '';
  return p[1] + '/' + p[2] + '/' + p[0];
}

function time24To12h(t) {
  if (!t) return '9:00 AM';
  const p = t.split(':');
  let h = parseInt(p[0]);
  const m = p[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h}:${m} ${ampm}`;
}

function displayDateToIso(val) {
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function time12To24h(val) {
  const m = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '09:00';
  let h = parseInt(m[1]);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export default function SetReminderActionCard({ data }) {
  const [completed, setCompleted] = useState(false);
  const [reason, setReason] = useState(data.reason || '');
  const rawDate = data.reminder_at ? data.reminder_at.split('T')[0] : '';
  const rawTime = data.reminder_at ? (data.reminder_at.split('T')[1] || '').substring(0, 5) || '09:00' : '09:00';
  const [reminderDate, setReminderDate] = useState(isoDateToDisplay(rawDate));
  const [reminderTime, setReminderTime] = useState(time24To12h(rawTime));
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!reminderDate) { Alert.alert('Pick a date'); return; }
    const isoDate = displayDateToIso(reminderDate);
    if (!isoDate) { Alert.alert('Date format should be MM/DD/YYYY'); return; }
    setLoading(true);
    try {
      const time24 = time12To24h(reminderTime || '9:00 AM');
      // Send the user's LOCAL wall-clock (naive, no Z). The server converts to
      // UTC via the user's timezone — same authority path as web (not the
      // device's zone via toISOString).
      const resp = await api.json('/api/reminders', {
        method: 'POST',
        body: JSON.stringify({
          place_name: data.place_name || null,
          reminder_at: `${isoDate}T${time24}:00`,
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
          placeholder="MM/DD/YYYY"
          placeholderTextColor="#aaa"
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={reminderTime}
          onChangeText={setReminderTime}
          placeholder="9:00 AM"
          placeholderTextColor="#aaa"
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
