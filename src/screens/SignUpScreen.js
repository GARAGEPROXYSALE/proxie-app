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

export default function SignUpScreen({ navigation, route }) {
  const { signIn } = useApp();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nameOk = name.trim().length >= 2;
  const emailOk = email.trim().includes('@');
  const passwordOk = password.length >= 6;
  const canSubmit = nameOk && emailOk && passwordOk && agreedToTerms && !loading;

  const userData = {
    id: null,
    name: name.trim(),
    status: headline.trim() || 'Garage Sale Host',
    bio: bio.trim() || "One person's trash is another's treasure.",
    building: null,
    rating: 5.0,
    sales: 0,
  };

  const handleSubmit = async () => {
    setError('');
    if (!agreedToTerms) { setError('Please accept the Terms of Service and Privacy Policy to continue.'); return; }
    if (!nameOk) { setError("Please enter your name so buyers know who they're buying from."); return; }
    if (!emailOk) { setError('Please enter a valid email address.'); return; }
    if (!passwordOk) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: name.trim(),
            status: headline.trim() || 'Garage Sale Host',
            bio: bio.trim(),
          },
        },
      });
      if (authError) { setError(authError.message); return; }

      // Write profile row. Works immediately if email confirmation is disabled;
      // if confirmation is required the session is null and this is a no-op —
      // loadUserSession creates the row on first sign-in after confirmation.
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: name.trim(),
          status: headline.trim() || 'Garage Sale Host',
          bio: bio.trim(),
        }, { onConflict: 'id' }).catch(() => {});
      }

      const fullUserData = { ...userData, id: data.user?.id };

      if (data.session) {
        // Email confirmation disabled — go straight to phone verification
        navigation.navigate('PhoneVerify', { userType: 'host', userData: fullUserData });
      } else {
        // Email confirmation required — verify email first, then phone
        navigation.navigate('EmailVerify', {
          email: email.trim(),
          userType: 'host',
          userData: fullUserData,
        });
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Ionicons name="storefront" size={14} color={colors.primary} />
            <Text style={styles.headerBadgeText}>Create Account</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>
              Your profile is how nearby buyers discover you and your items.
            </Text>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. jordan@example.com"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                maxLength={100}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textLight}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                secureTextEntry
                autoComplete="new-password"
                maxLength={100}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Your name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Jordan Smith"
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={(t) => { setName(t); setError(''); }}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Selling headline <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder='e.g. "Weekend garage sale enthusiast"'
                placeholderTextColor={colors.textLight}
                value={headline}
                onChangeText={setHeadline}
                maxLength={80}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Short bio <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell buyers a bit about yourself and what you sell..."
                placeholderTextColor={colors.textLight}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>

            <TouchableOpacity
              style={styles.legalRow}
              onPress={() => setAgreedToTerms((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.legalText}>
                I agree to Proxie's{' '}
                <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { tab: 'terms' })}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { tab: 'privacy' })}>
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              <Ionicons name="storefront-outline" size={18} color="#fff" />
              <Text style={styles.submitText}>{loading ? 'Creating account...' : 'Create Account'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.anonBtn} onPress={() => navigation.navigate('GuestMode')} activeOpacity={0.7}>
              <Text style={styles.anonText}>Browse anonymously — no account needed</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.anonBtn} onPress={() => navigation.navigate('SignIn')} activeOpacity={0.7}>
              <Text style={[styles.anonText, { color: colors.primary }]}>Already have an account? Sign in</Text>
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
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  scroll: { flex: 1 },
  titleBlock: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  form: { paddingHorizontal: 24, gap: 0 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.danger + '12',
    borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: colors.danger + '30',
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '500', lineHeight: 18 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  optional: { fontWeight: '400', color: colors.textLight, fontSize: 13 },
  input: {
    backgroundColor: colors.cardBackground, borderRadius: 14,
    padding: 14, fontSize: 15, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  textArea: { height: 90, paddingTop: 14 },
  legalRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginBottom: 24, backgroundColor: colors.cardBackground,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  legalText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  legalLink: { color: colors.primary, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6, marginBottom: 12,
  },
  submitBtnDisabled: { backgroundColor: colors.textLight, shadowOpacity: 0 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  anonBtn: { alignItems: 'center', paddingVertical: 12 },
  anonText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
});
