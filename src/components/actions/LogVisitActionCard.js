import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function LogVisitActionCard({ data, cardId, completed }) {
  const navigation = useNavigation();

  if (completed) {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <Text style={styles.successText}>
          ✓ Visit logged{data.place_name ? ` at ${data.place_name}` : ''}!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Log Visit</Text>
      {data.place_name ? <Text style={styles.cardPlace}>{data.place_name}</Text> : null}
      <TouchableOpacity
        style={styles.goldButton}
        onPress={() => navigation.navigate('LogVisit', {
          prefillSearch: data.place_name || '',
          prefillMealPeriod: data.meal_period || null,
          fromActionCard: cardId,
        })}
      >
        <Text style={styles.goldButtonText}>
          Log visit{data.place_name ? ` at ${data.place_name}` : ''}
        </Text>
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
  goldButton: {
    backgroundColor: '#C8960C',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    marginTop: 4,
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
