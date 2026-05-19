import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { COLORS } from './src/constants/colors';

import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import LogVisitScreen from './src/screens/LogVisitScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AddPlaceScreen from './src/screens/AddPlaceScreen';
import AskScreen from './src/screens/AskScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ChatHistoryScreen from './src/screens/ChatHistoryScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import EditVisitScreen from './src/screens/EditVisitScreen';
import EditPlaceScreen from './src/screens/EditPlaceScreen';
import PairwiseScreen from './src/screens/PairwiseScreen';
import ResortScreen from './src/screens/ResortScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite }}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      ) : !user.onboarding_complete ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="LogVisit" component={LogVisitScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="AddPlace" component={AddPlaceScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Ask" component={AskScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="ChatHistory" component={ChatHistoryScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Activity" component={ActivityScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="EditVisit" component={EditVisitScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="EditPlace" component={EditPlaceScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Pairwise" component={PairwiseScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Resort" component={ResortScreen} options={{ presentation: 'modal' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite }}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
