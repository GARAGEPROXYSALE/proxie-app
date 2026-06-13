import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import colors from '../theme/colors';

export default function SignInScreen({ navigation }) {
  const { signIn } = useApp();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const emailOk = email.trim().includes('@');
  const passwordOk = password.length >= 6;
  const canSubmit = emailOk && passwordOk && !loading;

  const handleSubmit = async () => {
    setError('');
    if (!emailOk) { setError('Please enter a valid email address.'); return; }
    if (!passwordOk) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      signIn('host', {
        id: data.user.id,
        name: profile?.display_name || email.split('@')[0],
        status: profile?.status || 'Garage Sale Host',
        bio: profile?.bio || '',
        building: profile?.building || null,
        rating: profile?.rating ?? 5.0,
        sales: profile?.sales ?? 0,
        avatar_url: profile?.avatar_url || null,
      });
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Ionicons name="log-in" size={14} color={colors.primary} />
            <Text style={styles.headerBadgeText}>Sign In</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your Proxie account.</Text>
          </View>

          <View style={styles.form}>

            {/* Inline error */}
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, error && !emailOk && styles.inputError]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                maxLength={100}
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, error && !passwordOk && styles.inputError]}
                  placeholder="Your password"
                  placeholderTextColor={colors.textLight}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  maxLength={100}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, (!canSubmit) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading ? (
                <Text style={styles.submitText}>Signing in…</Text>
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>Sign In</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Create account */}
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate('SignUp')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>Don't have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create one</Text></Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
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
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  scroll: { flex: 1 },

  titleBlock: {
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24,
  },
  title: {
    fontSize: 26, fontWeight: '800', color: colors.text,
    marginBottom: 8, letterSpacing: -0.3,
  },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },

  form: { paddingHorizontal: 24 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.danger + '12',
    borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: colors.danger + '30',
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '500', lineHeight: 18 },

  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: colors.cardBackground, borderRadius: 14,
    padding: 14, fontSize: 15, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  inputError: { borderColor: colors.danger + '60' },

  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute', right: 14, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    marginBottom: 12,
  },
  submitBtnDisabled: { backgroundColor: colors.textLight, shadowOpacity: 0 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
});
