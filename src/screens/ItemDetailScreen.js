import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, Pressable, StyleSheet,
  SafeAreaView, Dimensions, Alert, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getAvailabilityStatus, formatOutpostSchedule } from '../lib/listingUtils';
import { distanceMiles } from '../lib/location';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');

const conditionColors = {
  'New': colors.success,
  'Like New': '#34C759',
  'Good': colors.primary,
  'Fair': colors.warning,
};

export default function ItemDetailScreen({ navigation, route }) {
  const { item } = route.params;
  const {
    startConversation, openCollectionModal, listings,
    openMarkSoldModal, userType, user, signOut, tabBarAnim,
    incrementViews, renewListing, userLocation,
  } = useApp();

  // Show inline guest gate instead of Alert (which browsers block silently)
  const [showGuestBanner, setShowGuestBanner] = useState(false);

  // Hide tab bar + increment view count on mount
  useEffect(() => {
    Animated.timing(tabBarAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    incrementViews(item.id);
    return () => {
      Animated.timing(tabBarAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    };
  }, []);

  const liveItem = listings.find((l) => l.id === item.id) || item;

  // Recompute distance live from GPS rather than trusting whatever stale
  // value the listing object happens to carry — that field isn't kept in
  // sync once you leave the feed screen that originally computed it.
  const liveDistance = userLocation && liveItem.latitude != null && liveItem.longitude != null
    ? distanceMiles(userLocation.latitude, userLocation.longitude, liveItem.latitude, liveItem.longitude)
    : (typeof liveItem.distance === 'number' ? liveItem.distance : null);

  const saved = liveItem.saved;
  const isOwnListing = liveItem.seller?.id === user?.id || liveItem.seller?.id === 'me';
  const isSold = liveItem.sold;
  const isPickedUp = liveItem.pickedUp;
  const isGone = isSold || isPickedUp;
  const isHostOwner = userType === 'host' && isOwnListing;

  const handleSave = () => {
    openCollectionModal(liveItem, () => navigation.navigate('Saved'));
  };

  const handleMessage = async () => {
    if (userType === 'guest') {
      setShowGuestBanner(true);
      return;
    }
    try {
      const thread = await startConversation(liveItem);
      navigation.navigate('Chat', { thread, item: liveItem });
    } catch (e) {
      console.error('[ItemDetail] Chat navigation failed:', e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Floating back + save row */}
      <View style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topBtn} onPress={handleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={saved ? colors.primary : colors.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <Image
          source={{ uri: item.photos[0] }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* SOLD / Picked Up banner */}
        {isSold && (
          <View style={styles.soldBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.soldBannerText}>This item has been sold</Text>
          </View>
        )}
        {isPickedUp && !isSold && (
          <View style={[styles.soldBanner, { backgroundColor: '#A0522D' }]}>
            <Ionicons name="hand-left" size={18} color="#fff" />
            <Text style={styles.soldBannerText}>Already picked up</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Title + Price */}
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{item.title}</Text>
              <View style={[styles.conditionBadge, { backgroundColor: conditionColors[item.condition] || colors.primary }]}>
                <Text style={styles.conditionText}>{item.condition}</Text>
              </View>
            </View>
            <Text style={styles.price}>${item.price}</Text>
          </View>

          {/* Meta chips */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
              <Text style={styles.metaText}>{item.category}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="location-outline" size={14} color={colors.primary} />
              <Text style={styles.metaText}>
                {liveDistance != null ? `${liveDistance.toFixed(1)} mi away` : 'Distance unknown'}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>Posted {liveItem.postedAt}</Text>
            </View>
            {liveItem.views > 0 && (
              <View style={styles.metaChip}>
                <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{liveItem.views} views</Text>
              </View>
            )}
          </View>

          {/* Outpost status — takes over from the normal availability chip until confirmed */}
          {liveItem.is_outpost && !liveItem.outpost_confirmed ? (
            <View style={styles.outpostChip}>
              <View style={styles.outpostChipBadge}>
                <Ionicons name="flag" size={12} color="#fff" />
                <Text style={styles.outpostChipBadgeText}>OUTPOST</Text>
              </View>
              <Text style={styles.outpostChipText}>
                Not live yet — goes live {formatOutpostSchedule(liveItem.outpost_scheduled_at)}
              </Text>
              <Text style={styles.outpostChipSub}>
                You can message the seller now to ask questions before they arrive.
              </Text>
            </View>
          ) : (
            (() => {
              const availability = getAvailabilityStatus(liveItem);
              const isAvailable = availability.state === 'available';
              return (
                <View style={[styles.availabilityChip, isAvailable && styles.availabilityChipOn]}>
                  <Ionicons
                    name={isAvailable ? 'checkmark-circle' : 'time-outline'}
                    size={15}
                    color={isAvailable ? colors.success : colors.textSecondary}
                  />
                  <Text style={[styles.availabilityText, isAvailable && styles.availabilityTextOn]}>
                    {availability.label}
                  </Text>
                </View>
              );
            })()
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>

          {/* Host card — tapping navigates to their profile */}
          <Pressable style={styles.sellerCard} onPress={() => {
            if (userType === 'guest') { setShowGuestBanner(true); return; }
            navigation.navigate('SellerProfile', { seller: liveItem.seller, listing: liveItem });
          }}>
            <View style={styles.sellerAvatar}>
              <Ionicons name="storefront" size={22} color={colors.primaryLight} />
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.hostLabelRow}>
                <Text style={styles.sellerName}>{item.seller.name}</Text>
                {item.seller.phone_verified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={11} color={colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </View>
              {item.seller.building ? (
                <View style={styles.buildingRow}>
                  <Ionicons name="business-outline" size={12} color={colors.primary} />
                  <Text style={styles.buildingText}>{item.seller.building}</Text>
                </View>
              ) : null}
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color="#FFB800" />
                <Text style={styles.rating}>{item.seller.rating}</Text>
                <Text style={styles.sales}>· {item.seller.sales} sales</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </Pressable>

          {/* ── Guest gate banner (inline, no Alert) ── */}
          {showGuestBanner && (
            <View style={styles.guestBanner}>
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.guestBannerTitle}>Account required</Text>
                <Text style={styles.guestBannerDesc}>Create a free account to message sellers and arrange meetups.</Text>
              </View>
              <Pressable style={styles.guestJoinBtn} onPress={signOut}>
                <Text style={styles.guestJoinText}>Join</Text>
              </Pressable>
            </View>
          )}

          {/* ── Action buttons ── */}
          {isHostOwner ? (
            isGone ? (
              <View style={styles.soldConfirmed}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.soldConfirmedText}>{isSold ? 'Marked as Sold' : 'Marked as Picked Up'}</Text>
              </View>
            ) : (
              <View style={styles.ownerActions}>
                <Pressable
                  style={({ pressed }) => [styles.stillAvailBtn, pressed && styles.btnPressed]}
                  onPress={() => { renewListing(liveItem.id); navigation.goBack(); }}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                  <Text style={styles.stillAvailText}>Still Available</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.markSoldBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => openMarkSoldModal(liveItem)}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.markSoldText}>Mark as Sold</Text>
                </Pressable>
              </View>
            )
          ) : isGone ? (
            <View style={styles.soldConfirmed}>
              <Ionicons name="close-circle" size={20} color={colors.textLight} />
              <Text style={styles.soldConfirmedText}>No longer available</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.messageBtn, pressed && styles.messageBtnPressed]}
              onPress={handleMessage}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#fff" />
              <Text style={styles.messageBtnText}>Message Host</Text>
            </Pressable>
          )}
        </View>

        {/* Bottom breathing room */}
        <View style={{ height: 60 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EAF0F8',
  },
  topBar: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  scroll: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: Platform.OS === 'web' ? Math.min(width * 0.75, 340) : width * 0.75,
    backgroundColor: colors.border,
  },
  content: {
    backgroundColor: 'rgba(234, 240, 248, 0.82)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleBlock: { flex: 1, marginRight: 12 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    lineHeight: 28,
  },
  conditionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  price: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  metaText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },

  availabilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availabilityChipOn: {
    backgroundColor: colors.success + '15',
    borderColor: colors.success + '30',
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  availabilityTextOn: {
    color: colors.success,
  },

  outpostChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    maxWidth: '100%',
  },
  outpostChipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.textSecondary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 2,
  },
  outpostChipBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  outpostChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  outpostChipSub: {
    fontSize: 12,
    color: colors.textLight,
    lineHeight: 17,
  },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    backgroundColor: colors.cardBackground,
    padding: 14,
    borderRadius: 14,
  },

  sellerCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCE9F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInfo: { flex: 1 },
  hostLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  sellerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.success + '15', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  verifiedText: { fontSize: 10, fontWeight: '700', color: colors.success },
  buildingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  buildingText: { fontSize: 12, color: colors.primary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 13, fontWeight: '600', color: colors.text },
  sales: { fontSize: 12, color: colors.textSecondary },

  // Guest gate
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primary + '12',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  guestBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  guestBannerDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  guestJoinBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  guestJoinText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Sold
  soldBanner: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  soldBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  markSoldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  markSoldText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  soldConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  soldConfirmedText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Owner status actions
  ownerActions: {
    gap: 10,
  },
  stillAvailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.success + '12',
    borderWidth: 1.5,
    borderColor: colors.success + '40',
  },
  stillAvailText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  // Action buttons
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  messageBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.2,
  },
  btnPressed: {
    opacity: 0.75,
  },
  messageBtnPressed: {
    opacity: 0.82,
  },
});
