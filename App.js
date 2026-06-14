import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppProvider, useApp } from './src/context/AppContext';
import CustomTabBar from './src/components/CustomTabBar';
import SaveToast from './src/components/SaveToast';
import CollectionModal from './src/components/CollectionModal';
import MarkSoldModal from './src/components/MarkSoldModal';
import RatingModal from './src/components/RatingModal';

// Screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import GuestModeScreen from './src/screens/GuestModeScreen';
import LocationPermScreen from './src/screens/LocationPermScreen';
import LegalScreen from './src/screens/LegalScreen';
import IdentityScreen from './src/screens/IdentityScreen';
import NearbyScreen from './src/screens/NearbyScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import CreateListingScreen from './src/screens/CreateListingScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SavedScreen from './src/screens/SavedScreen';
import SellerProfileScreen from './src/screens/SellerProfileScreen';
import SignInScreen from './src/screens/SignInScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import StorefrontScreen from './src/screens/StorefrontScreen';

const Tab = createBottomTabNavigator();
const OnboardingStack = createStackNavigator();
const HomeStack = createStackNavigator();
const NearbyStack = createStackNavigator();

// ── Onboarding navigator (pre-auth) ──────────────────────────
function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false, cardStyle: { flex: 1 } }}>
      <OnboardingStack.Screen name="Welcome" component={OnboardingScreen} />
      <OnboardingStack.Screen name="SignUp" component={SignUpScreen} />
      <OnboardingStack.Screen name="SignIn" component={SignInScreen} />
      <OnboardingStack.Screen name="GuestMode" component={GuestModeScreen} />
      <OnboardingStack.Screen name="LocationPerm" component={LocationPermScreen} />
      <OnboardingStack.Screen name="Legal" component={LegalScreen} />
    </OnboardingStack.Navigator>
  );
}

// ── Main tab navigators (post-auth) ──────────────────────────
function NearbyNavigator() {
  return (
    <NearbyStack.Navigator screenOptions={{ headerShown: false, cardStyle: { flex: 1 } }}>
      <NearbyStack.Screen name="NearbyHome" component={NearbyScreen} />
      <NearbyStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <NearbyStack.Screen name="Chat" component={ChatScreen} />
      <NearbyStack.Screen name="Messages" component={MessagesScreen} />
      <NearbyStack.Screen
        name="CreateListing"
        component={CreateListingScreen}
        options={{ presentation: 'modal' }}
      />
      <NearbyStack.Screen name="Saved" component={SavedScreen} />
      <NearbyStack.Screen name="SellerProfile" component={SellerProfileScreen} />
      <NearbyStack.Screen name="Wishlist" component={WishlistScreen} />
      <NearbyStack.Screen name="Storefront" component={StorefrontScreen} />
      <NearbyStack.Screen name="Legal" component={LegalScreen} />
    </NearbyStack.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, cardStyle: { flex: 1 } }}>
      <HomeStack.Screen name="HomeScreen" component={IdentityScreen} />
      <HomeStack.Screen name="Settings" component={SettingsScreen} />
      <HomeStack.Screen
        name="CreateListing"
        component={CreateListingScreen}
        options={{ presentation: 'modal' }}
      />
      <HomeStack.Screen name="Messages" component={MessagesScreen} />
      <HomeStack.Screen name="Chat" component={ChatScreen} />
      <HomeStack.Screen name="Saved" component={SavedScreen} />
      <HomeStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <HomeStack.Screen name="SellerProfile" component={SellerProfileScreen} />
      <HomeStack.Screen name="EditProfile" component={EditProfileScreen} />
      <HomeStack.Screen name="Wishlist" component={WishlistScreen} />
      <HomeStack.Screen name="Storefront" component={StorefrontScreen} />
      <HomeStack.Screen name="Legal" component={LegalScreen} />
    </HomeStack.Navigator>
  );
}

// ── Global overlays (toasts, modals on top of everything) ────
function GlobalOverlays({ navigationRef }) {
  const { toast, navigateFromToast } = useApp();

  const handleToastNavigate = () => {
    try {
      navigationRef.current?.navigate('HomeTab', { screen: 'Saved' });
    } catch {
      navigationRef.current?.navigate('Saved');
    }
    navigateFromToast();
  };

  return (
    <>
      <CollectionModal />
      <SaveToast visible={toast.visible} onNavigate={handleToastNavigate} />
      <MarkSoldModal />
      <RatingModal />
    </>
  );
}

// ── Main tabs (shown after auth) ─────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Nearby first, Home second */}
      <Tab.Screen name="NearbyTab" component={NearbyNavigator} />
      <Tab.Screen name="HomeTab" component={HomeNavigator} />
    </Tab.Navigator>
  );
}

// ── Root navigator — switches between onboarding and main app ─
function RootNavigator({ navigationRef }) {
  const { isAuthenticated } = useApp();
  return isAuthenticated ? <MainTabs /> : <OnboardingNavigator />;
}

export default function App() {
  const navigationRef = useRef(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <NavigationContainer ref={navigationRef}>
            <RootNavigator navigationRef={navigationRef} />
          </NavigationContainer>
          <GlobalOverlays navigationRef={navigationRef} />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
