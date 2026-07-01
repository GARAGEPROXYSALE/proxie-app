import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* ── Logo + brand ── */}
      <View style={styles.brandSection}>
        <View style={styles.logoCircle}>
          <Ionicons name="radio" size={52} color="#fff" />
        </View>
        <Text style={styles.appName}>Proxie</Text>
        {/* Feature pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="location" size={12} color={colors.primary} />
            <Text style={styles.pillText}>Hyper-local</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="flash" size={12} color={colors.primary} />
            <Text style={styles.pillText}>Real-time</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
            <Text style={styles.pillText}>Cash & carry</Text>
          </View>
        </View>
      </View>

      {/* ── CTAs ── */}
      <View style={styles.ctaBlock}>
        {/* Primary: Create Account */}
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.88}
        >
          <Ionicons name="storefront-outline" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create Account</Text>
        </TouchableOpacity>

        {/* Secondary: Sign In */}
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => navigation.navigate('SignIn')}
          activeOpacity={0.82}
        >
          <Ionicons name="log-in-outline" size={18} color={colors.primary} />
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>

        {/* Tertiary: Guest */}
        <TouchableOpacity
          style={styles.guestBtn}
          onPress={() => navigation.navigate('GuestMode')}
          activeOpacity={0.7}
        >
          <Text style={styles.guestText}>Browse without an account</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By continuing you agree to our{' '}
          <Text
            style={styles.footerLink}
            onPress={() => navigation.navigate('Legal', { tab: 'terms' })}
          >
            Terms
          </Text>
          {' '}and{' '}
          <Text
            style={styles.footerLink}
            onPress={() => navigation.navigate('Legal', { tab: 'privacy' })}
          >
            Privacy Policy
          </Text>
          .
        </Text>
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

  // ── Brand ──────────────────────────────────────────────────────
  brandSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 16,
  },
  logoCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 270,
    marginBottom: 24,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ── CTAs ───────────────────────────────────────────────────────
  ctaBlock: {
    gap: 10,
    paddingBottom: 8,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  createBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  signInBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.1,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  guestText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // ── Footer ─────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerText: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
