import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import UserActionSheet from '../components/UserActionSheet';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');
const CARD_W = (width - 16 * 2 - 12) / 2;

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function SellerProfileScreen({ navigation, route }) {
  const { seller, listing } = route.params;
  const { listings, startConversation, blockUser, blockedUsers } = useApp();
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [fullProfile, setFullProfile] = useState(null);
  const [myId, setMyId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isBlocked = blockedUsers.includes(seller.id);

  // Fetch full profile from Supabase if seller has a UUID id
  useEffect(() => {
    if (seller.id?.includes('-') && seller.id !== 'me') {
      supabase.from('profiles').select('*').eq('id', seller.id).single().then(({ data }) => {
        if (data) setFullProfile(data);
      }).catch(() => {});
    }
  }, [seller.id]);

  // Check own profile
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMyId(session?.user?.id || null);
    }).catch(() => {});
  }, []);

  // Their active, non-sold listings
  const sellerListings = listings.filter(
    (l) => l.seller?.id === seller.id && l.active && !l.sold
  );

  const handleMessage = () => {
    if (!listing) return;
    try {
      const thread = startConversation(listing);
      navigation.navigate('Chat', { thread, item: listing });
    } catch (e) {
      console.error('[SellerProfile] message nav failed:', e);
    }
  };

  const handleBlock = () => {
    blockUser(seller.id);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setSheetOpen(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isBlocked && (
        <View style={[styles.blockBar, { backgroundColor: colors.danger + '15' }]}>
          <Ionicons name="ban" size={16} color={colors.danger} />
          <Text style={[styles.blockBarText, { color: colors.danger }]}>You've blocked this seller.</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile hero */}
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            {fullProfile?.avatar_url ? (
              <Image source={{ uri: fullProfile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{initials(fullProfile?.display_name || seller.name)}</Text>
            )}
          </View>
          <Text style={styles.sellerName}>{fullProfile?.display_name || seller.name}</Text>

          {fullProfile?.bio ? (
            <Text style={styles.bioText}>{fullProfile.bio}</Text>
          ) : null}

          {fullProfile?.member_since ? (
            <Text style={styles.memberSince}>
              Member since {new Date(fullProfile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          ) : null}

          {(fullProfile?.building || seller.building) ? (
            <View style={styles.buildingRow}>
              <Ionicons name="business-outline" size={14} color={colors.primary} />
              <Text style={styles.buildingText}>{fullProfile?.building || seller.building}</Text>
            </View>
          ) : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="star" size={18} color="#FFB800" />
              <Text style={styles.statNum}>{seller.rating?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={styles.statNum}>{seller.sales ?? 0}</Text>
              <Text style={styles.statLabel}>Sales</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              <Text style={styles.statNum}>{sellerListings.length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
          </View>

          {/* Show Edit Profile button if own profile, else Message CTA */}
          {seller.id === myId ? (
            <TouchableOpacity style={styles.msgBtn} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.85}>
              <Ionicons name="pencil-outline" size={18} color="#fff" />
              <Text style={styles.msgBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : listing && !isBlocked ? (
            <TouchableOpacity style={styles.msgBtn} onPress={handleMessage} activeOpacity={0.85}>
              <Ionicons name="chatbubble-outline" size={18} color="#fff" />
              <Text style={styles.msgBtnText}>Message</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Listings grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {sellerListings.length > 0 ? `${sellerListings.length} Active Listing${sellerListings.length > 1 ? 's' : ''}` : 'No active listings'}
          </Text>

          {sellerListings.length === 0 ? (
            <View style={styles.emptyListings}>
              <Ionicons name="storefront-outline" size={40} color={colors.primaryLight} />
              <Text style={styles.emptyText}>Nothing for sale right now</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {sellerListings.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.listingCard}
                  onPress={() => navigation.navigate('ItemDetail', { item })}
                  activeOpacity={0.88}
                >
                  <Image
                    source={{ uri: item.photos[0] }}
                    style={styles.listingImage}
                    resizeMode="cover"
                  />
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingPrice}>${item.price}</Text>
                    <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.conditionBadge}>
                      <Text style={styles.conditionText}>{item.condition}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* User action sheet (ellipsis button) */}
      <UserActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        seller={seller}
        listing={listing}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },

  // Block bar
  blockBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.danger + '10',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.danger + '25',
  },
  blockBarText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  blockBarBtn: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  blockBarBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 10,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 4,
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  bioText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  memberSince: {
    fontSize: 12,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  sellerName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  buildingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  buildingText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    width: '100%',
    marginTop: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // Message button
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 40,
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 4,
  },
  msgBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Listings
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  emptyListings: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listingCard: {
    width: CARD_W,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  listingImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.border,
  },
  listingInfo: {
    padding: 10,
    gap: 3,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  listingTitle: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
    lineHeight: 17,
  },
  conditionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '18',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 3,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
});
