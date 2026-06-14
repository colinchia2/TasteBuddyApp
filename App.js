import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
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
import OnboardingValuePropScreen from './src/screens/onboarding/OnboardingValuePropScreen';
import OnboardingProfileScreen from './src/screens/onboarding/OnboardingProfileScreen';
import OnboardingDinnerScreen from './src/screens/onboarding/OnboardingDinnerScreen';
import OnboardingCuisineScreen from './src/screens/onboarding/OnboardingCuisineScreen';
import OnboardingRankScreen from './src/screens/onboarding/OnboardingRankScreen';
import OnboardingSTierScreen from './src/screens/onboarding/OnboardingSTierScreen';
import OnboardingMilestoneScreen from './src/screens/onboarding/OnboardingMilestoneScreen';
import OnboardingMoreCategoriesScreen from './src/screens/onboarding/OnboardingMoreCategoriesScreen';
import OnboardingAskAIScreen from './src/screens/onboarding/OnboardingAskAIScreen';
import OnboardingTransitionScreen from './src/screens/onboarding/OnboardingTransitionScreen';
import OnboardingCategoryEducationScreen from './src/screens/onboarding/OnboardingCategoryEducationScreen';
import OnboardingPaywallScreen from './src/screens/onboarding/OnboardingPaywallScreen';
import OnboardingImportScreen from './src/screens/onboarding/OnboardingImportScreen';
import OnboardingImportChooserScreen from './src/screens/onboarding/OnboardingImportChooserScreen';
import OnboardingTextListScreen from './src/screens/onboarding/OnboardingTextListScreen';
import OnboardingTileRankerScreen from './src/screens/onboarding/OnboardingTileRankerScreen';
import OnboardingRecapScreen from './src/screens/onboarding/OnboardingRecapScreen';
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
import MyPlacesScreen from './src/screens/MyPlacesScreen';
import RankingsScreen from './src/screens/RankingsScreen';
import PersonaProfileScreen from './src/screens/PersonaProfileScreen';
import PersonasBrowseScreen from './src/screens/PersonasBrowseScreen';
import EmailVerificationPendingScreen from './src/screens/EmailVerificationPendingScreen';

const Stack = createNativeStackNavigator();

// Onboarding redesign (Part 2) step↔screen resume contract. Import is the default
// path after Profile; bailing mid-import resumes to the chooser (step 2) and the
// scan re-runs fresh (cheap — zero Google calls at scan). Cuisine (step 6) is the
// CONDITIONAL confirm step and self-skips forward when nothing is low-confidence.
function stepToScreen(step) {
  if (!step || step <= 0) return 'ValueProp';
  if (step === 1) return 'Profile';
  if (step === 2) return 'ImportChooser';
  if (step === 3) return 'Dinner';        // manual suggest-and-type fallback (<10 gate)
  if (step === 4) return 'TileRanker';
  if (step === 5) return 'STier';
  if (step === 6) return 'Cuisine';         // conditional cuisine-confirm
  if (step === 7) return 'MoreCategories';  // opt-in additional-category loop
  if (step === 8) return 'Recap';
  if (step === 9) return 'AskAI';           // "Ask TasteBuddy AI Anything"
  return 'Paywall';
}

const OnboardingStack = createNativeStackNavigator();

function OnboardingNavigator({ step }) {
  return (
    <OnboardingStack.Navigator
      initialRouteName={stepToScreen(step)}
      screenOptions={{ headerShown: false }}
    >
      {/* Onboarding redesign (Part 2): ValueProp → Profile → ImportChooser →
          {Calendar review | Text-list | manual Dinner} → TileRanker → STier →
          conditional Cuisine → Recap → Paywall. Legacy screens (Transition,
          Milestone, MoreCategories, CategoryEducation, AskAI, Rank) stay
          registered for safety but are no longer in the main path. */}
      <OnboardingStack.Screen name="ValueProp" component={OnboardingValuePropScreen} />
      <OnboardingStack.Screen name="Profile" component={OnboardingProfileScreen} />
      <OnboardingStack.Screen name="ImportChooser" component={OnboardingImportChooserScreen} />
      <OnboardingStack.Screen name="Import" component={OnboardingImportScreen} />
      <OnboardingStack.Screen name="TextList" component={OnboardingTextListScreen} />
      <OnboardingStack.Screen name="Dinner" component={OnboardingDinnerScreen} />
      <OnboardingStack.Screen name="TileRanker" component={OnboardingTileRankerScreen} />
      <OnboardingStack.Screen name="STier" component={OnboardingSTierScreen} />
      <OnboardingStack.Screen name="Cuisine" component={OnboardingCuisineScreen} />
      <OnboardingStack.Screen name="Recap" component={OnboardingRecapScreen} />
      <OnboardingStack.Screen name="Paywall" component={OnboardingPaywallScreen} />
      {/* legacy (unreferenced in the new flow, kept to avoid nav crashes) */}
      <OnboardingStack.Screen name="Transition" component={OnboardingTransitionScreen} />
      <OnboardingStack.Screen name="Rank" component={OnboardingRankScreen} />
      <OnboardingStack.Screen name="Milestone" component={OnboardingMilestoneScreen} />
      <OnboardingStack.Screen name="MoreCategories" component={OnboardingMoreCategoriesScreen} />
      <OnboardingStack.Screen name="CategoryEducation" component={OnboardingCategoryEducationScreen} />
      <OnboardingStack.Screen name="AskAI" component={OnboardingAskAIScreen} />
    </OnboardingStack.Navigator>
  );
}

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
      ) : !user.email_confirmed ? (
        <Stack.Screen name="EmailVerificationPending" component={EmailVerificationPendingScreen} />
      ) : !user.onboarding_complete ? (
        <Stack.Screen name="Onboarding">
          {() => <OnboardingNavigator step={user.onboarding_step || 0} />}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="CheckIn" component={CheckInScreen} />
          <Stack.Screen name="LogVisit" component={LogVisitScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="AddPlace" component={AddPlaceScreen} />
          <Stack.Screen name="Ask" component={AskScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="ChatHistory" component={ChatHistoryScreen} />
          <Stack.Screen name="Activity" component={ActivityScreen} />
          <Stack.Screen name="EditVisit" component={EditVisitScreen} />
          <Stack.Screen name="EditPlace" component={EditPlaceScreen} />
          <Stack.Screen name="Pairwise" component={PairwiseScreen} />
          <Stack.Screen name="Resort" component={ResortScreen} />
          <Stack.Screen name="MyPlaces" component={MyPlacesScreen} />
          <Stack.Screen name="Rankings" component={RankingsScreen} />
          <Stack.Screen name="PersonaProfile" component={PersonaProfileScreen} />
          <Stack.Screen name="Personas" component={PersonasBrowseScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    function handleNotifResponse(response) {
      const data = response?.notification?.request?.content?.data || {};
      if (data.type === 'visit_reminder' && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('LogVisit', {
          placeId: data.place_id || null,
          placeName: data.place_name || '',
          checkinId: data.checkin_id || null,
        });
      }
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotifResponse);
    return () => sub.remove();
  }, []);

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

  // Universal Links / deep-link routing (Stream C2). Declarative route map only —
  // the screen-side handlers (resolve /u/<username> -> userId via /api/persona/lookup;
  // open the Lite PlaceCardModal by slug on My Places) land in the C3 OTA on this
  // build's new runtime. AASA (server) + associatedDomains entitlement (this build)
  // are what make the https links fire; tastebuddy:// keeps the existing scheme.
  const linking = {
    prefixes: ['https://tastebuddy-colinchia2.pythonanywhere.com', 'tastebuddy://'],
    config: {
      screens: {
        PersonaProfile: 'u/:username',
        MyPlaces: 'my-places/:slug',
      },
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          onReady={() => {
            // Cold start: check if app was opened by tapping a notification
            Notifications.getLastNotificationResponseAsync().then(response => {
              if (!response) return;
              const data = response.notification.request.content.data || {};
              if (data.type === 'visit_reminder') {
                navigationRef.current?.navigate('LogVisit', {
                  placeId: data.place_id || null,
                  placeName: data.place_name || '',
                  checkinId: data.checkin_id || null,
                });
              }
            });
          }}
        >
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
