import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS } from '../constants/colors';

export default function AskScreen({ navigation, route }) {
  const prefilledQuery = route?.params?.prefilledQuery;
  return (
    <View style={styles.container}>
      <ScreenHeader title="Ask TasteBuddy" navigation={navigation} />
      <View style={styles.body}>
        {prefilledQuery ? (
          <Text style={styles.prefill}>"{prefilledQuery}"</Text>
        ) : null}
        <Text style={styles.sub}>Use the AI chat on the home screen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  prefill: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: COLORS.gold, marginBottom: 12, textAlign: 'center' },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: COLORS.textMuted },
});
