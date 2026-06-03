import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { api } from '../api/client';
import { COLORS } from '../constants/colors';

export default function CheckInScreen({ navigation }) {
  const [step, setStep] = useState('loading');
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const searchTimer = useRef(null);

  useEffect(() => { loadNearby(); }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(searchQuery), 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  async function loadNearby() {
    setStep('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Enable location to find nearby places.');
        setStep('list');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const data = await api.json(
        `/api/places/google-nearby?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}`
      );
      setNearbyPlaces(data);
      setStep('list');
    } catch (e) {
      setNearbyPlaces([]);
      setStep('list');
    }
  }

  async function runSearch(q) {
    if (q.trim().length < 2) return;
    setSearchLoading(true);
    try {
      const data = await api.json(`/api/places/google-autocomplete?q=${encodeURIComponent(q)}`);
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function checkIn(place, cityName) {
    setConfirming(place.google_place_id);
    try {
      const data = await api.json('/api/places/gps-checkin', {
        method: 'POST',
        body: JSON.stringify({
          google_place_id: place.google_place_id,
          name: place.name,
          address: place.address || null,
          lat: place.lat || null,
          lng: place.lng || null,
          city: (cityName || '').trim() || null,
        }),
      });
      setCheckedIn({
        name: place.name,
        checkin_id: data.checkin_id,
        place_id: data.place_id,
        in_my_list: data.in_my_list,
        google_place_id: place.google_place_id,
      });
      setStep('confirmed');
    } catch (e) {
      // Hard block: server couldn't resolve a city. Prompt for one, then retry.
      if (e.need_city) {
        Alert.prompt(
          'City required',
          e.message || 'Enter the city for this place.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save',
              onPress: (val) => {
                if (val && val.trim()) checkIn(place, val.trim());
                else Alert.alert('City required', 'Please enter a city to continue.');
              },
            },
          ],
          'plain-text',
        );
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setConfirming(null);
    }
  }

  function logNow() {
    if (!checkedIn) return;
    if (checkedIn.in_my_list) {
      navigation.replace('LogVisit', {
        placeId: checkedIn.place_id,
        placeName: checkedIn.name,
        checkinId: checkedIn.checkin_id,
      });
    } else {
      navigation.replace('AddPlace', {
        googlePlaceId: checkedIn.google_place_id,
        placeName: checkedIn.name,
        onDone: () => navigation.replace('LogVisit', {
          placeId: checkedIn.place_id,
          placeName: checkedIn.name,
          checkinId: checkedIn.checkin_id,
        }),
      });
    }
  }

  if (step === 'loading') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Log a Visit" navigation={navigation} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Finding places nearby…</Text>
        </View>
      </View>
    );
  }

  if (step === 'confirmed') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Log a Visit" navigation={navigation} />
        <View style={styles.confirmedBody}>
          <Ionicons name="checkmark-circle" size={64} color={COLORS.gold} style={{ marginBottom: 16 }} />
          <Text style={styles.confirmedTitle}>You're checked in!</Text>
          <Text style={styles.confirmedSub}>
            We'll send you a reminder tomorrow at 10am to finish logging your visit to{' '}
            <Text style={{ fontFamily: 'DMSans_700Bold' }}>{checkedIn?.name}</Text>.
          </Text>
          <TouchableOpacity style={styles.logNowBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.logNowText}>Remind me to finish logging later</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={logNow}>
            <Text style={styles.doneText}>I'll actually continue logging right now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isSearching = searchQuery.trim().length > 0;
  const listData = isSearching ? searchResults : nearbyPlaces;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Log a Visit" navigation={navigation} />

      {/* Fixed search header — lives OUTSIDE FlatList to avoid keyboard dismiss bug */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Where are you right now?</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any restaurant…"
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchLoading && <ActivityIndicator size="small" color={COLORS.gold} style={{ marginLeft: 8 }} />}
        </View>
        {!isSearching && (
          <>
            <Text style={styles.listSub}>Google Places within 100m of you</Text>
            <TouchableOpacity onPress={loadNearby} style={styles.refreshRow}>
              <Ionicons name="refresh" size={14} color={COLORS.gold} />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.google_place_id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={() => (
          <View style={styles.emptyWrap}>
            {isSearching
              ? <Text style={styles.emptyText}>{searchLoading ? 'Searching…' : 'No results found.'}</Text>
              : (
                <>
                  <Text style={styles.emptyText}>No places found within 100m.</Text>
                  <Text style={styles.emptySub}>Try searching above.</Text>
                </>
              )
            }
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.placeCard}
            onPress={() => checkIn(item)}
            disabled={confirming === item.google_place_id}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.placeName}>{item.name}</Text>
              {item.address ? <Text style={styles.placeAddr}>{item.address}</Text> : null}
              {!isSearching && item.types?.[0] ? (
                <Text style={styles.placeType}>{item.types[0].replace(/_/g, ' ')}</Text>
              ) : null}
            </View>
            {confirming === item.google_place_id
              ? <ActivityIndicator size="small" color={COLORS.gold} />
              : <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            }
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontFamily: 'DMSans_400Regular', color: COLORS.textMuted, marginTop: 12, fontSize: 14 },
  listHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  listTitle: { fontFamily: 'Outfit_700Bold', fontSize: 20, color: COLORS.text, marginBottom: 12 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15,
    color: COLORS.text, padding: 0,
  },
  listSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  refreshText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: COLORS.gold },
  placeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 16, marginBottom: 10, borderRadius: 14,
    borderWidth: 0.5, borderColor: COLORS.border, padding: 16,
  },
  placeName: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: COLORS.text },
  placeAddr: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  placeType: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: COLORS.textLight, marginTop: 3, textTransform: 'capitalize' },
  confirmedBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmedTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: COLORS.text, marginBottom: 12 },
  confirmedSub: {
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: 40,
  },
  logNowBtn: {
    backgroundColor: COLORS.gold, borderRadius: 24, paddingVertical: 16,
    paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 14,
  },
  logNowText: { color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 16 },
  doneBtn: { paddingVertical: 12 },
  doneText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: COLORS.textMuted },
  emptyWrap: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted, marginBottom: 6 },
  emptySub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textLight },
});
