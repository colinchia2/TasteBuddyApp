import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TBLogo from '../../components/TBLogo';
import { COLORS } from '../../constants/colors';

export default function OnboardingTransitionScreen({ navigation, route }) {
  const city = route.params?.city || '';
  const displayName = route.params?.displayName || '';
  const firstName = displayName.split(' ')[0] || 'there';

  const [skipping, setSkipping] = useState(false);

  function handleImport() {
    navigation.navigate('Import', { city });
  }

  function handleFresh() {
    setSkipping(true);
    // Brief pause so the user sees the button press before advancing
    setTimeout(() => {
      navigation.navigate('Dinner', { city });
    }, 150);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <TBLogo size={56} style={styles.logo} />
          <Text style={styles.greeting}>Okay great, {firstName}!</Text>
          <Text style={styles.body}>
            Now let's build your personal taste profile. The more you add, the better TasteBuddy's recommendations get.
          </Text>
          <Text style={styles.body}>
            If you've saved restaurants in Google Maps or have Resy/OpenTable reservation history, we can import them automatically.
          </Text>
        </View>

        <View style={styles.choices}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleImport}>
            <Text style={styles.primaryBtnText}>Yes, import my saved places</Text>
            <Text style={styles.primaryBtnSub}>From Google Maps, Resy, OpenTable & more</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleFresh}
            disabled={skipping}
          >
            {skipping
              ? <ActivityIndicator size="small" color={COLORS.textMuted} />
              : <Text style={styles.secondaryBtnText}>No, I'll start fresh</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  container: {
    flex: 1, paddingHorizontal: 32, justifyContent: 'space-between',
    paddingBottom: 48, paddingTop: 32,
  },
  top: { flex: 1, justifyContent: 'center' },
  logo: { marginBottom: 28, alignSelf: 'center' },
  greeting: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 28, color: COLORS.text,
    textAlign: 'center', marginBottom: 20,
  },
  body: {
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: 14,
  },
  choices: { gap: 12 },
  primaryBtn: {
    backgroundColor: COLORS.gold, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff', marginBottom: 4,
  },
  primaryBtnSub: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)',
  },
  secondaryBtn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    borderWidth: 0.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  secondaryBtnText: {
    fontFamily: 'DMSans_500Medium', fontSize: 15, color: COLORS.textMuted,
  },
});
