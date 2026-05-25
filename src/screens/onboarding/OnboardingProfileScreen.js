import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { COLORS } from '../../constants/colors';
import TBLogo from '../../components/TBLogo';

export default function OnboardingProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [city, setCity] = useState('');
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [emailConsent, setEmailConsent] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const cityDebounce = useRef(null);

  function onCityChange(text) {
    setCity(text);
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (text.trim().length < 2) { setCitySuggestions([]); return; }
    cityDebounce.current = setTimeout(async () => {
      setCityLoading(true);
      try {
        const results = await api.json(
          `/api/places/city-autocomplete?q=${encodeURIComponent(text.trim())}`
        );
        setCitySuggestions(results || []);
      } catch {
        setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 350);
  }

  async function handleContinue() {
    if (!displayName.trim() || displayName.trim().length < 2) {
      Alert.alert('Display name must be at least 2 characters.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Please enter your city.');
      return;
    }
    if (!emailConsent) {
      Alert.alert('Please accept the email confirmation to continue.');
      return;
    }

    setLoading(true);
    try {
      let expoPushToken = null;
      if (pushEnabled) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          try {
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            const tokenData = await Notifications.getExpoPushTokenAsync(
              projectId ? { projectId } : {}
            );
            expoPushToken = tokenData.data;
          } catch {
            // push token unavailable in Expo Go without projectId — skip
          }
        }
      }

      await api.json('/api/onboarding/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: displayName.trim(),
          city: city.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          email_consent: emailConsent,
          push_enabled: pushEnabled,
          ...(expoPushToken ? { expo_push_token: expoPushToken } : {}),
          onboarding_step: 2,
        }),
      });

      navigation.navigate('Transition', { city: city.trim(), displayName: displayName.trim() });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TBLogo size={40} style={styles.logoImg} />
        <Text style={styles.title}>Let's set you up</Text>
        <Text style={styles.subtitle}>Just a couple of things before we get into it.</Text>

        <Text style={styles.label}>What should we call you?</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor={COLORS.textLight}
          autoCorrect={false}
        />

        <Text style={[styles.label, { marginTop: 20 }]}>What city do you eat in most?</Text>
        <View style={styles.cityWrap}>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={onCityChange}
            placeholder="e.g. New York"
            placeholderTextColor={COLORS.textLight}
            autoCorrect={false}
          />
          {cityLoading && (
            <ActivityIndicator
              size="small" color={COLORS.gold}
              style={styles.citySpinner}
            />
          )}
          {citySuggestions.length > 0 && (
            <View style={styles.dropdown}>
              {citySuggestions.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.dropdownItem, i < citySuggestions.length - 1 && styles.dropdownBorder]}
                  onPress={() => { setCity(item.name); setCitySuggestions([]); }}
                >
                  <Text style={styles.dropdownName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.dropdownDesc} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.checkRow}>
          <Switch
            value={emailConsent}
            onValueChange={setEmailConsent}
            trackColor={{ true: COLORS.gold }}
            thumbColor="#fff"
          />
          <Text style={styles.checkText}>
            I confirm my email and agree to receive notifications about my food journey
          </Text>
        </View>

        <View style={styles.checkRow}>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ true: COLORS.gold }}
            thumbColor="#fff"
          />
          <Text style={styles.checkText}>
            Send me push notifications for check-in reminders
          </Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Continue →</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
  logoImg: { marginBottom: 24 },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: COLORS.text, marginBottom: 8 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted, marginBottom: 28 },
  label: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text, marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.text, fontFamily: 'DMSans_400Regular',
  },
  cityWrap: { position: 'relative', zIndex: 10, marginBottom: 24 },
  citySpinner: { position: 'absolute', right: 14, top: 16 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5,
    borderColor: COLORS.border, zIndex: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownBorder: { borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  dropdownName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.text },
  dropdownDesc: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  checkText: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: COLORS.textMuted, lineHeight: 18,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 28, paddingVertical: 17,
    alignItems: 'center', marginTop: 24,
  },
  btnText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
});
