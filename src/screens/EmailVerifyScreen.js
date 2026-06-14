import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import colors from '../theme/colors';

export default function EmailVerifyScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { email = '', userData = {}, userType = 'host' } = route?.params ?? {};

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  // When the user clicks the email link on the same device/browser, Supabase
  // restores the session and onAuthStateChange fires in AppContext, which sets
  // isAuthenticated → true → root navigator switches to MainTabs automatically.
  // This polling handles the case where they verified on a different device.
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        clearInterval(interval);
        navigation.navigate('PhoneVerify', { userType, userData });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleResend = async () => {
    if (resending || resent) return;
    setResending(true);
    setError('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) { setError(resendError.message); return; }
      setResent(true);
      setTimeout(() => setResent(false), 30000);
    } catch {
      setError('Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleCheckNow = async () => {
    setChecking(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigation.navigate('PhoneVerify', { userType, userData });
      } else {
        setError("We haven't received your confirmation yet — check your inbox (and spam folder).");
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>

      <View style={styles.iconWrap}>
        <View style={styles.iconRing}>
          <Ionicons name="mail" size={44} color={colors.primary} />
        </View>
        <View style={[styles.ring, styles.ring1]} />
        <View style={[styles.ring, styles.ring2]} />
      </View>

      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>
        We sent a verification link to
      </Text>
      <Text style={styles.emailLabel}>{email}</Text>
      <Text style={styles.instruction}>
        Click the link in that email to activate your account. This tab will continue automatically once confirmed.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleCheckNow}
          disabled={checking}
          activeOpacity={0.85}
        >
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>I've verified — continue</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendBtn, resent && styles.resendBtnSent]}
          onPress={handleResend}
          disabled={resending || resent}
          activeOpacity={0.7}
        >
          {resending ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.resendText, resent && styles.resendTextSent]}>
              {resent ? '✓ Email sent — check your inbox' : 'Resend verification email'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          onPress={() => navigation.navigate('SignIn')}
          activeOpacity={0.7}
        >
          <Text style={styles.signInLinkText}>
            Already have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
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
  ring1: { width: 108, height: 108, opacity: 0.25 },
  ring2: { width: 136, height: 136, opacity: 0.12 },

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
    lineHeight: 22,
  },
  emailLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  instruction: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 24,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger + '12',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.danger + '30',
    alignSelf: 'stretch',
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, lineHeight: 18 },

  actions: { alignSelf: 'stretch', gap: 10 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  resendBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendBtnSent: { borderColor: colors.success },
  resendText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  resendTextSent: { color: colors.success },

  signInLink: { alignItems: 'center', paddingVertical: 10 },
  signInLinkText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
});
