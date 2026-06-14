import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import BuildingPicker from '../components/BuildingPicker';
import colors from '../theme/colors';

function SettingRow({ icon, label, value, onPress, rightElement, color, destructive }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.rowIcon, { backgroundColor: (color || colors.primary) + '20' }]}>
        <Ionicons name={icon} size={18} color={color || colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && { color: colors.danger }]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
      ))}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Host Settings ─────────────────────────────────────────────

function HostSettings({ navigation, user, setUser, isLive, setIsLive, signOut }) {
  const insets = useSafeAreaInsets();
  const [buildingMode, setBuildingMode] = useState(!!user.building);
  const [buildingInput, setBuildingInput] = useState(user.building || '');
  const [notifications, setNotifications] = useState(true);

  const handleSaveName = () => {
    Alert.prompt
      ? Alert.prompt('Display Name', 'Enter your name:', (name) => {
          if (name?.trim()) setUser((u) => ({ ...u, name: name.trim() }));
        }, 'plain-text', user.name)
      : Alert.alert('Edit Name', 'Name editing coming soon.');
  };

  const handleSaveBio = () => {
    Alert.prompt
      ? Alert.prompt('Short Bio', 'Tell buyers about yourself:', (bio) => {
          if (bio !== null) setUser((u) => ({ ...u, bio: bio.trim() }));
        }, 'plain-text', user.bio || '')
      : Alert.alert('Edit Bio', 'Open this app on your iPhone to edit your bio directly.');
  };

  const handleSaveHeadline = () => {
    Alert.prompt
      ? Alert.prompt('Selling Headline', 'A short line that appears on your profile:', (headline) => {
          if (headline !== null) setUser((u) => ({ ...u, status: headline.trim() }));
        }, 'plain-text', user.status || '')
      : Alert.alert('Edit Headline', 'Open this app on your iPhone to edit your headline directly.');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, listings, and all data. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you absolutely sure?', 'Your account will be gone forever.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                      await supabase.from('listings').delete().eq('seller_id', session.user.id);
                      await supabase.from('profiles').delete().eq('id', session.user.id);
                      await supabase.auth.signOut();
                    }
                    signOut();
                  } catch {
                    Alert.alert('Error', 'Could not delete account. Please contact support.');
                  }
                },
              },
            ]),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile */}
      <Section title="Host Profile">
        <SettingRow
          icon="person-outline"
          label="Display Name"
          value={user.name}
          onPress={handleSaveName}
        />
        <Divider />
        <SettingRow
          icon="mic-outline"
          label="Selling Headline"
          value={user.status || 'Tap to add a headline'}
          onPress={handleSaveHeadline}
        />
        <Divider />
        <SettingRow
          icon="chatbubble-outline"
          label="Bio"
          value={user.bio || 'Tap to add a bio'}
          onPress={handleSaveBio}
        />
        <Divider />
        <SettingRow
          icon="camera-outline"
          label="Profile Photo"
          onPress={() => Alert.alert('Photo', 'Photo upload coming soon.')}
        />
      </Section>

      {/* Visibility */}
      <Section title="Visibility">
        <SettingRow
          icon="radio-outline"
          label="Go Live"
          value={isLive ? 'Your listings are visible to nearby Guests' : 'You are hidden from Guests'}
          rightElement={
            <Switch
              value={isLive}
              onValueChange={setIsLive}
              trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
              thumbColor={isLive ? colors.primary : '#fff'}
            />
          }
        />
      </Section>

      {/* Building Mode */}
      <Section title="Building Mode">
        <View style={styles.buildingCard}>
          <View style={styles.buildingHeader}>
            <Ionicons name="business" size={20} color={colors.primary} />
            <Text style={styles.buildingTitle}>Join Your Building</Text>
            <Switch
              value={buildingMode}
              onValueChange={setBuildingMode}
              trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
              thumbColor={buildingMode ? colors.primary : '#fff'}
            />
          </View>
          <Text style={styles.buildingDesc}>
            Show your listings only to residents in your building. Perfect for apartment and condo sales.
          </Text>
          {buildingMode && (
            <View style={styles.buildingPickerWrap}>
              <BuildingPicker
                value={buildingInput || null}
                onChange={(val) => {
                  setBuildingInput(val || '');
                  setUser((u) => ({ ...u, building: val || null }));
                }}
                placeholder="Select your building"
              />
            </View>
          )}
        </View>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <SettingRow
          icon="notifications-outline"
          label="Push Notifications"
          rightElement={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
              thumbColor={notifications ? colors.primary : '#fff'}
            />
          }
        />
        <Divider />
        <SettingRow
          icon="chatbubble-ellipses-outline"
          label="New Message Alerts"
          rightElement={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
              thumbColor={notifications ? colors.primary : '#fff'}
            />
          }
        />
      </Section>

      {/* Legal + About */}
      <Section title="About">
        <SettingRow
          icon="information-circle-outline"
          label="About Proxie"
          onPress={() => Alert.alert('Proxie', "The world's biggest garage sale.\n\nVersion 1.0.0")}
        />
        <Divider />
        <SettingRow
          icon="document-text-outline"
          label="Terms of Service"
          onPress={() => navigation.navigate('Legal', { tab: 'terms' })}
        />
        <Divider />
        <SettingRow
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() => navigation.navigate('Legal', { tab: 'privacy' })}
        />
      </Section>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
        <Ionicons name="trash-outline" size={16} color={colors.textLight} />
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Guest Settings ────────────────────────────────────────────

function GuestSettings({ navigation, user, setUser, signOut }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);

  const handleEditName = () => {
    Alert.prompt
      ? Alert.prompt('Your Name', 'What should people call you?', (name) => {
          if (name?.trim()) setUser((u) => ({ ...u, name: name.trim() }));
        }, 'plain-text', user.name)
      : Alert.alert('Edit Name', 'Name editing coming soon.');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile */}
      <Section title="Guest Profile">
        <SettingRow
          icon="person-outline"
          label="Your Name"
          value={user.name || 'Anonymous Guest'}
          onPress={handleEditName}
        />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <SettingRow
          icon="notifications-outline"
          label="Push Notifications"
          rightElement={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
              thumbColor={notifications ? colors.primary : '#fff'}
            />
          }
        />
        <Divider />
        <SettingRow
          icon="chatbubble-ellipses-outline"
          label="Message Alerts"
          rightElement={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
              thumbColor={notifications ? colors.primary : '#fff'}
            />
          }
        />
      </Section>

      {/* Become a Host */}
      <Section title="Upgrade">
        <SettingRow
          icon="storefront-outline"
          label="Become a Host"
          value="List items and get discovered by buyers nearby"
          onPress={() =>
            Alert.alert(
              'Become a Host',
              'Create a Host account to start listing items for sale. You\'ll be taken to sign up.',
              [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Let\'s Go', onPress: signOut },
              ]
            )
          }
          color={colors.success}
        />
      </Section>

      {/* Legal + About */}
      <Section title="About">
        <SettingRow
          icon="information-circle-outline"
          label="About Proxie"
          onPress={() => Alert.alert('Proxie', "The world's biggest garage sale.\n\nVersion 1.0.0")}
        />
        <Divider />
        <SettingRow
          icon="document-text-outline"
          label="Terms of Service"
          onPress={() => navigation.navigate('Legal', { tab: 'terms' })}
        />
        <Divider />
        <SettingRow
          icon="shield-outline"
          label="Privacy Policy"
          onPress={() => navigation.navigate('Legal', { tab: 'privacy' })}
        />
      </Section>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <TouchableOpacity style={styles.deleteAccountBtn} onPress={async () => {
        Alert.alert(
          'Delete Account',
          'This permanently deletes your account and all data. It cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete My Account',
              style: 'destructive',
              onPress: () =>
                Alert.alert('Are you absolutely sure?', 'Your account will be gone forever.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Yes, Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.user) {
                          await supabase.from('listings').delete().eq('seller_id', session.user.id);
                          await supabase.from('profiles').delete().eq('id', session.user.id);
                          await supabase.auth.signOut();
                        }
                        signOut();
                      } catch {
                        Alert.alert('Error', 'Could not delete account. Please contact support.');
                      }
                    },
                  },
                ]),
            },
          ]
        );
      }}>
        <Ionicons name="trash-outline" size={16} color={colors.textLight} />
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Main export ───────────────────────────────────────────────

export default function SettingsScreen({ navigation }) {
  const { user, setUser, isLive, setIsLive, userType, signOut } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerBadge}>
          <Ionicons
            name={userType === 'host' ? 'storefront' : 'search'}
            size={12}
            color={userType === 'host' ? colors.primary : colors.textSecondary}
          />
          <Text style={[
            styles.headerBadgeText,
            userType !== 'host' && { color: colors.textSecondary },
          ]}>
            {userType === 'host' ? 'Host' : 'Guest'}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {userType === 'host' ? (
          <HostSettings
            navigation={navigation}
            user={user}
            setUser={setUser}
            isLive={isLive}
            setIsLive={setIsLive}
            signOut={signOut}
          />
        ) : (
          <GuestSettings
            navigation={navigation}
            user={user}
            setUser={setUser}
            signOut={signOut}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    // Using View + useSafeAreaInsets instead of SafeAreaView so the
    // flex chain is unbroken and the inner ScrollView gets a real height.
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardBackground,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  rowValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 60,
  },

  // Building mode
  buildingCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  buildingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buildingTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  buildingDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  buildingPickerWrap: {
    marginTop: 4,
  },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    marginTop: 24,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },

  // Delete account
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 10,
  },
  deleteAccountText: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '500',
  },
});
