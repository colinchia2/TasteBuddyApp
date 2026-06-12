import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function AddPlaceActionCard({ data, cardId, completed }) {
  const navigation = useNavigation();

  if (completed) {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <Text style={styles.successText}>✓ {data.place_name ? `${data.place_name} added` : 'Place added'} to TasteBuddy!</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>Add Place</Text>
      {data.place_name ? <Text style={styles.cardPlace}>{data.place_name}</Text> : null}
      <TouchableOpacity
        style={styles.goldButton}
        onPress={() => navigation.navigate('AddPlace', {
          placeName: data.place_name || '',
          // #5: discover_new quick-add — prefill the candidate's gpid so AddPlace
          // pre-selects it (skips search; de-dupes by google_place_id).
          googlePlaceId: data.google_place_id || '',
          fromActionCard: cardId,
        })}
      >
        <Text style={styles.goldButtonText}>+ Add {data.place_name || 'a Place'}</Text>
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
