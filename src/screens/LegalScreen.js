import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

const TERMS = `Last updated: April 25, 2026

Welcome to Proxie. By creating an account or browsing as a Guest, you agree to these Terms of Service ("Terms"). Please read them carefully.

1. ACCEPTANCE OF TERMS

By accessing or using Proxie ("the App," "the Service"), you confirm that you are at least 18 years old and agree to be bound by these Terms. If you do not agree, do not use the App.

2. DESCRIPTION OF SERVICE

Proxie is a proximity-based marketplace that connects Hosts (individuals selling items) with Guests (individuals browsing nearby sales). Proxie facilitates discovery and communication between users but is not a party to any transaction.

3. HOST RESPONSIBILITIES

As a Host you agree to:
• Accurately represent items you list for sale.
• Honor agreed-upon prices and pickup arrangements.
• Respond to Guest inquiries in a timely manner.
• Mark items as sold when a transaction is complete.
• Not list counterfeit, illegal, or prohibited items.

4. GUEST RESPONSIBILITIES

As a Guest you agree to:
• Communicate respectfully with Hosts.
• Honor commitments to purchase items you've agreed to buy.
• Not harass, threaten, or deceive Hosts.

5. PROHIBITED CONTENT

You may not list or promote: weapons, controlled substances, stolen goods, adult content, counterfeit items, or any item prohibited by applicable law.

6. TRANSACTIONS

Proxie does not process payments or guarantee transactions. All sales are between Hosts and Guests. Proxie is not liable for disputes, non-delivery, item condition, or fraud. Use your best judgment and meet in safe, public locations.

7. RATINGS AND REVIEWS

Peer satisfaction ratings are voluntary and reflect personal experiences. Proxie may remove ratings that violate these Terms or appear fraudulent.

8. PRIVACY

Your use of Proxie is also governed by our Privacy Policy (see Privacy tab). By using the App you consent to the data practices described therein.

9. INTELLECTUAL PROPERTY

All content, branding, and technology in the App is owned by Proxie or its licensors. You may not copy, modify, or distribute App content without written permission.

10. DISCLAIMERS

THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. PROXIE DOES NOT GUARANTEE THE ACCURACY OF LISTINGS, THE SAFETY OF MEETINGS, OR THE CONDUCT OF ANY USER.

11. LIMITATION OF LIABILITY

TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROXIE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE APP.

12. TERMINATION

We may suspend or terminate your account at any time for violations of these Terms. You may delete your account at any time from Settings.

13. GOVERNING LAW

These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-law provisions.

14. CHANGES TO TERMS

We may update these Terms periodically. Continued use of the App after changes constitutes acceptance of the updated Terms.

15. CONTACT

Questions? Reach us at legal@proxie.app.`;

const PRIVACY = `Last updated: April 25, 2026

Proxie ("we," "us," "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use the Proxie app.

1. INFORMATION WE COLLECT

a) Information You Provide
• Account information: name, headline, bio, building/unit (Hosts); name or anonymous browse (Guests).
• Listing content: photos, descriptions, prices, categories.
• Messages: communications between Hosts and Guests.

b) Information Collected Automatically
• Location data: proximity radius used to surface nearby listings. We do not store your precise GPS coordinates.
• Device information: device type, OS version, app version.
• Usage data: screens viewed, items saved, messages sent (aggregate analytics only).

2. HOW WE USE YOUR INFORMATION

• To match Guests with nearby Hosts and listings.
• To facilitate in-app messaging between users.
• To display your profile to nearby Guests (Hosts only).
• To improve the App through aggregate analytics.
• To enforce our Terms of Service and prevent abuse.
• To send you notifications about activity on your account (with your permission).

3. HOW WE SHARE YOUR INFORMATION

We do not sell your personal information. We may share data with:

• Other users: Your Host profile (name, headline, rating, building) is visible to nearby Guests. Guest profiles are not publicly shown.
• Service providers: Trusted vendors who help us operate the App (hosting, analytics), bound by confidentiality obligations.
• Law enforcement: When required by law or to protect safety.

4. LOCATION DATA

Proxie uses your device location to determine your proximity to listings. We use a fuzzy radius — your exact location is never shown to other users. You can disable location access in your device settings, but this will limit App functionality.

5. DATA RETENTION

• Active account data is retained while your account exists.
• You may delete your account at any time from Settings, which removes your profile and listings within 30 days.
• Messages may be retained for up to 90 days after deletion.

6. CHILDREN'S PRIVACY

Proxie is not directed to individuals under 18. We do not knowingly collect data from minors. If you believe a minor has provided us data, contact us at privacy@proxie.app.

7. SECURITY

We use industry-standard encryption and access controls to protect your data. However, no system is completely secure, and we cannot guarantee absolute security.

8. YOUR RIGHTS

Depending on your jurisdiction, you may have the right to:
• Access the personal data we hold about you.
• Request correction of inaccurate data.
• Request deletion of your data.
• Opt out of certain data uses.

To exercise these rights, contact privacy@proxie.app.

9. THIRD-PARTY LINKS

The App may contain links to third-party sites or services. We are not responsible for their privacy practices.

10. CHANGES TO THIS POLICY

We may update this Privacy Policy. We will notify you of significant changes through the App or by email. Continued use after changes constitutes acceptance.

11. CONTACT

For privacy questions or requests:
Email: privacy@proxie.app
Address: Proxie, Inc., 1234 Market St, Suite 100, Wilmington, DE 19801`;

export default function LegalScreen({ navigation, route }) {
  const initialTab = route.params?.tab === 'privacy' ? 'privacy' : 'terms';
  const [activeTab, setActiveTab] = useState(initialTab);

  const content = activeTab === 'terms' ? TERMS : PRIVACY;
  const title = activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => setActiveTab('terms')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="document-text-outline"
            size={15}
            color={activeTab === 'terms' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => setActiveTab('privacy')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="shield-outline"
            size={15}
            color={activeTab === 'privacy' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notice */}
      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
        <Text style={styles.noticeText}>
          This is a placeholder document for demo purposes. Final legal text requires professional review before public release.
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.body}>{content}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Notice
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE5B4',
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#92630A',
    lineHeight: 16,
  },

  // Content
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
  },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 21,
    fontFamily: 'monospace',
  },
});
