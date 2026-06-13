import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';

const INCLUDED = [
  { icon: 'radio-outline',       label: 'See items within 500 ft – 5 mi' },
  { icon: 'eye-outline',         label: 'View item details and photos' },
  { icon: 'map-outline',         label: 'Radar map of nearby sales' },
];

const EXCLUDED = [
  { icon: 'chatbubble-outline',  label: 'Message sellers' },
  { icon: 'storefront-outline',  label: 'Post your own listings' },
  { icon: 'bookmark-outline',    label: 'Save items to collections' },
  { icon: 'star-outline',        label: 'Ratings & seller history' },
];

export default function GuestModeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const continueAsGuest = () => {
    navigation.navigate('LocationPerm', {
      userType: 'guest',
      userData: { name: 'Guest', status: 'Browsing nearby', bio: '' },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerBadge}>
          <Ionicons name="person-outline" size={13} color={colors.primary} />
          <Text style={styles.headerBadgeText}>Guest Mode</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="eye-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Browse as a Guest</Text>
          <Text style={styles.heroSub}>
            No account required to explore what's selling near you right now.
          </Text>
        </View>

        {/* Comparison card */}
        <View style={styles.card}>

          {/* Included */}
          <View style={styles.cardSection}>
            <View style={styles.sectionLabel}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.sectionLabelText, { color: colors.success }]}>Available to guests</Text>
            </View>
            {INCLUDED.map((item) => (
              <View key={item.label} style={styles.featureRow}>
                <View style={[styles.featureIconWrap, styles.featureIconIncluded]}>
                  <Ionicons name={item.icon} size={15} color={colors.success} />
                </View>
                <Text style={styles.featureText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Excluded */}
          <View style={styles.cardSection}>
            <View style={styles.sectionLabel}>
              <Ionicons name="lock-closed" size={13} color={colors.textLight} />
              <Text style={[styles.sectionLabelText, { color: colors.textLight }]}>Requires an account</Text>
            </View>
            {EXCLUDED.map((item) => (
              <View key={item.label} style={styles.featureRow}>
                <View style={[styles.featureIconWrap, styles.featureIconExcluded]}>
                  <Ionicons name={item.icon} size={15} color={colors.textLight} />
                </View>
                <Text style={[styles.featureText, styles.featureTextMuted]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Trust note */}
        <View style={styles.trustNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.trustText}>
            No tracking. No email required. Switch to an account any time.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={continueAsGuest}
          activeOpacity={0.88}
        >
          <Ionicons name="eye-outline" size={18} color="#fff" />
          <Text style={styles.continueBtnText}>Continue as Guest</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signUpLink}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.7}
        >
          <Text style={styles.signUpLinkText}>
            Want full access?{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign up free</Text>
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
  },

  // ── Header ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  // ── Scroll ─────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },

  // ── Hero ───────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },

  // ── Comparison card ────────────────────────────────────────────
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardSection: {
    padding: 18,
    gap: 12,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconIncluded: {
    backgroundColor: colors.success + '15',
  },
  featureIconExcluded: {
    backgroundColor: colors.border,
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  featureTextMuted: {
    color: colors.textLight,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 18,
  },

  // ── Trust note ─────────────────────────────────────────────────
  trustNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // ── Bottom actions ─────────────────────────────────────────────
  bottomActions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 17,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 7,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.1,
  },
  signUpLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  signUpLinkText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
