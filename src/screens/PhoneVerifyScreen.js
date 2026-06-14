import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import colors from '../theme/colors';

export default function PhoneVerifyScreen({ navigation, route }) {
  const { userType, userData } = route.params || {};
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRef = useRef(null);

  // Format to E.164 — assumes US numbers if no country code given
  const toE164 = (raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (raw.trim().startsWith('+')) return `+${digits}`;
    return `+1${digits}`;
  };

  const phoneOk = phone.replace(/\D/g, '').length >= 10;
  const otpOk = otp.length === 6;

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const e164 = toE164(phone);
      const { error: err } = await supabase.auth.updateUser({ phone: e164 });
      if (err) {
        // Supabase returns this if SMS provider isn't configured yet
        if (err.message?.toLowerCase().includes('sms') || err.message?.toLowerCase().includes('provider')) {
          setError('SMS is not yet enabled. Ask your admin to configure Twilio in Supabase.');
        } else {
          setError(err.message);
        }
        return;
      }
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 200);
    } catch (e) {
      setError('Could not send code. Check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const e164 = toE164(phone);
      const { error: err } = await supabase.auth.verifyOtp({
        phone: e164,
        token: otp.trim(),
        type: 'phone_change',
      });
      if (err) { setError(err.message); return; }
      navigation.navigate('LocationPerm', { userType, userData });
    } catch (e) {
      setError('Verification failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('LocationPerm', { userType, userData });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
            <Text style={styles.headerBadgeText}>Verify Phone</Text>
          </View>
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
          </View>

          {step === 'phone' ? (
            <>
              <Text style={styles.title}>Add your phone number</Text>
              <Text style={styles.subtitle}>
                A verified phone number builds trust with buyers and sellers — and makes Proxie safer for everyone.
              </Text>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TextInput
                style={styles.input}
                placeholder="(555) 867-5309"
                placeholderTextColor={colors.textLight}
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(''); }}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={14}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.btn, !phoneOk && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={!phoneOk || loading}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>{loading ? 'Sending...' : 'Send Code'}</Text>
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                We'll send a one-time code. Standard messaging rates may apply. Your number is never shared publicly.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Enter the code</Text>
              <Text style={styles.subtitle}>
                We texted a 6-digit code to {phone}. Enter it below.
              </Text>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TextInput
                ref={otpRef}
                style={[styles.input, styles.otpInput]}
                placeholder="123456"
                placeholderTextColor={colors.textLight}
                value={otp}
                onChangeText={(t) => { setOtp(t.replace(/\D/g, '')); setError(''); }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.btn, !otpOk && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={!otpOk || loading}
                activeOpacity={0.85}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep('phone'); setOtp(''); setError(''); }}>
                <Text style={styles.resendText}>Wrong number? Go back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.cardBackground,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cardBackground, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },

  body: { flex: 1, paddingHorizontal: 28, paddingTop: 32 },

  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },

  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3, marginBottom: 10 },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 28 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.danger + '12',
    borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: colors.danger + '30',
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '500', lineHeight: 18 },

  input: {
    backgroundColor: colors.cardBackground, borderRadius: 14,
    padding: 16, fontSize: 18, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  otpInput: {
    fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: 8,
  },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 16, marginBottom: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  btnDisabled: { backgroundColor: colors.textLight, shadowOpacity: 0 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  disclaimer: { fontSize: 12, color: colors.textLight, lineHeight: 18, textAlign: 'center' },
  resendBtn: { alignItems: 'center', paddingVertical: 12 },
  resendText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
});
