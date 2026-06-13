import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

const HOST_TABS = [
  {
    name: 'NearbyTab',
    label: 'Nearby',
    icon: 'radio-outline',
    iconActive: 'radio',
  },
  {
    name: 'HomeTab',
    label: 'My Garage',
    icon: 'storefront-outline',
    iconActive: 'storefront',
  },
];

const GUEST_TABS = [
  {
    name: 'NearbyTab',
    label: 'Nearby',
    icon: 'radio-outline',
    iconActive: 'radio',
  },
  {
    name: 'HomeTab',
    label: 'My Garage',
    icon: 'storefront-outline',
    iconActive: 'storefront',
  },
];

// Screens inside a stack where the tab bar should not appear
const HIDDEN_ON = new Set([
  'Settings', 'EditProfile', 'Chat', 'CreateListing',
  'ItemDetail', 'SellerProfile', 'Saved', 'Legal',
  'Wishlist', 'Storefront',
]);

/** Walk the nested nav state to find the name of the deepest active screen. */
function getActiveRouteName(navState) {
  if (!navState) return null;
  const route = navState.routes[navState.index];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}

export default function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { tabBarAnim, userType } = useApp();
  const [isVisible, setIsVisible] = useState(true);

  // Track animated value so we can disable pointer events when hidden
  // This prevents invisible tab buttons from stealing taps from underlying screens
  useEffect(() => {
    const id = tabBarAnim.addListener(({ value }) => {
      setIsVisible(value > 0.05);
    });
    return () => tabBarAnim.removeListener(id);
  }, [tabBarAnim]);

  // Hide on detail / secondary screens within any nested stack
  const activeScreen = getActiveRouteName(state);
  if (activeScreen && HIDDEN_ON.has(activeScreen)) return null;

  const tabs = userType === 'host' ? HOST_TABS : GUEST_TABS;

  const translateY = tabBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });

  return (
    <Animated.View
      pointerEvents={isVisible ? 'box-none' : 'none'}
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + 6,
          opacity: tabBarAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.tabRow}>
        {tabs.map((tab, index) => {
          const focused = state.index === index;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, focused && styles.tabActive]}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={22}
                color={focused ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.tabBar,
    borderTopWidth: 0,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
