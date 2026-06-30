import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

const TRUST_SIGNALS = [
  {
    icon: 'location-outline',
    color: colors.primary,
    title: 'Show items near you',
    body: 'Distance-sorted listings from 500 ft to 7 miles away.',
  },
  {
    icon: 'eye-off-outline',
    color: colors.success,
    title: 'Your exact location is never shared',
    body: 'Sellers only see approximate proximity — never your address.',
  },
  {
    icon: 'settings-outline',
    color: colors.textSecondary,
    title: 'Change it any time',
    body: 'Manage location access in your device settings at any time.',
  },
];

export default function LocationPermScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { signIn } = useApp();
  const { userType = 'guest', userData = {} } = route?.params ?? {};

  const [loading, setLoading] = useState(false);

  const finishOnboarding = () => {
    signIn(userType, userData);
  };

  const handleAllow = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      // Whether granted or denied, proceed — AppContext's own location hook
      // will pick up the permission state on next mount.
      // (If granted, NearbyScreen will receive real distances automatically.)
    } catch (_) {
      // Silently continue on any error
    } finally {
      setLoading(false);
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Hero ── */}
      <View style={styles.heroSection}>
        <View style={styles.iconRing}>
          <View style={styles.iconInner}>
            <Ionicons name="location" size={44} color={colors.primary} />
          </View>
          {/* Radar rings */}
          <View style={[styles.ring, styles.ring1]} />
          <View style={[styles.ring, styles.ring2]} />
        </View>

        <Text style={styles.title}>Enable Location</Text>
        <Text style={styles.subtitle}>
          Proxie works best when it knows where you are. See what's literally around the corner.
        </Text>
      </View>

      {/* ── Trust signals ── */}
      <View style={styles.trustCard}>
        {TRUST_SIGNALS.map((item, idx) => (
          <View key={item.title}>
            <View style={styles.trustRow}>
              <View style={[styles.trustIconWrap, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <View style={styles.trustTextBlock}>
                <Text style={styles.trustTitle}>{item.title}</Text>
                <Text style={styles.trustBody}>{item.body}</Text>
              </View>
            </View>
            {idx < TRUST_SIGNALS.length - 1 && <View style={styles.trustDivider} />}
          </View>
        ))}
      </View>

      {/* ── CTAs ── */}
      <View style={styles.ctaBlock}>
        <TouchableOpacity
          style={styles.allowBtn}
          onPress={handleAllow}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.allowBtnText}>Allow Location Access</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Not now — use approximate distances</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  // ── Hero ───────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  iconRing: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ring1: {
    width: 108,
    height: 108,
    opacity: 0.25,
  },
  ring2: {
    width: 136,
    height: 136,
    opacity: 0.12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 290,
  },

  // ── Trust card ─────────────────────────────────────────────────
  trustCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
  },
  trustIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  trustTextBlock: {
    flex: 1,
    gap: 2,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  trustBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  trustDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  // ── CTAs ───────────────────────────────────────────────────────
  ctaBlock: {
    gap: 8,
    paddingBottom: 8,
  },
  allowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  allowBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
