import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getAgeBadge, recencyLabel, getAvailabilityStatus, formatOutpostSchedule } from '../lib/listingUtils';
import colors from '../theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const COL_GAP = 10;
const H_PAD = 14;
const CARD_W = (SCREEN_W - H_PAD * 2 - COL_GAP) / 2;

// Deterministic image heights based on item id — creates the staggered look
const IMAGE_HEIGHTS = [180, 220, 160, 240, 200, 170, 230, 190, 210, 175];
function imageHeight(id) {
  const n = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  return IMAGE_HEIGHTS[n % IMAGE_HEIGHTS.length];
}

// Avatar initials from name
function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// Format large numbers: 1000+ → "1.0k"
function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function MasonryCard({ item, onPress }) {
  const { toggleSaved } = useApp();
  const imgH = imageHeight(item.id);
  const ageBadge = getAgeBadge(item.createdAt);
  const recency = recencyLabel(item.createdAt);
  const combinedViews = (item.impression_count || 0) + (item.tap_count || 0);
  const availability = getAvailabilityStatus(item);
  const isPendingOutpost = item.is_outpost && !item.outpost_confirmed;

  // Promotion styles
  const isBoosted = item.is_boosted === true;
  const isPromoted = item.is_promoted === true;

  const handleLike = (e) => {
    e.stopPropagation?.();
    toggleSaved(item.id);
  };

  // Card border style for promoted
  const cardStyle = [
    styles.card,
    isPromoted && styles.promotedCard,
  ];

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={onPress}
      activeOpacity={0.93}
    >
      {/* Boosted amber left-edge accent */}
      {isBoosted && <View style={styles.boostedAccent} />}

      {/* Photo */}
      <View style={[styles.imageWrap, { height: imgH }]}>
        <Image
          source={{ uri: item.photos?.[0] }}
          style={[styles.image, isPendingOutpost && styles.imageOutpostFaded]}
          resizeMode="cover"
        />

        {/* Outpost — not live yet */}
        {isPendingOutpost && (
          <View style={styles.outpostOverlay}>
            <View style={styles.outpostBadge}>
              <Ionicons name="flag" size={11} color="#fff" />
              <Text style={styles.outpostBadgeText}>OUTPOST</Text>
            </View>
            <Text style={styles.outpostScheduleText} numberOfLines={1}>
              {formatOutpostSchedule(item.outpost_scheduled_at)}
            </Text>
          </View>
        )}

        {/* SOLD overlay */}
        {item.sold && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldText}>SOLD</Text>
          </View>
        )}

        {/* Picked Up overlay */}
        {item.pickedUp && !item.sold && (
          <View style={[styles.soldOverlay, { backgroundColor: 'rgba(120,80,20,0.55)' }]}>
            <Text style={styles.soldText}>PICKED UP</Text>
          </View>
        )}

        {/* Heart / Like button */}
        <TouchableOpacity style={styles.heartBtn} onPress={handleLike} activeOpacity={0.7}>
          <Ionicons
            name={item.saved ? 'heart' : 'heart-outline'}
            size={16}
            color={item.saved ? '#E8472A' : '#fff'}
          />
        </TouchableOpacity>

        {/* Availability status badge — suppressed while the Outpost hasn't gone live */}
        {!item.sold && !item.pickedUp && !isPendingOutpost && (
          <View style={[styles.availBadge, availability.state === 'available' && styles.availBadgeOn]}>
            {availability.state === 'available' && <View style={styles.availDot} />}
            <Text style={[styles.availBadgeText, availability.state === 'available' && styles.availBadgeTextOn]} numberOfLines={1}>
              {availability.label}
            </Text>
          </View>
        )}

        {/* Boosted "Nearby+" label — top-right */}
        {isBoosted && !isPromoted && (
          <View style={styles.boostedPill}>
            <Text style={styles.boostedPillText}>Nearby+</Text>
          </View>
        )}

        {/* Promoted label — top-right */}
        {isPromoted && (
          <View style={styles.promotedPill}>
            <Text style={styles.promotedPillText}>Promoted</Text>
          </View>
        )}

        {/* Bottom row: distance left, age right */}
        <View style={styles.pillRow}>
          <View style={styles.distancePill}>
            <Ionicons name="location" size={9} color={colors.primary} />
            <Text style={styles.distanceText}>{item.distance?.toFixed ? item.distance.toFixed(1) : item.distance} mi</Text>
          </View>
          {ageBadge && (
            <View style={[styles.agePill, ageBadge.warn && styles.agePillWarn]}>
              <Text style={[styles.ageText, ageBadge.warn && styles.ageTextWarn]}>{ageBadge.label}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.price}>${item.price}</Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

        {/* Seller row + view count */}
        <View style={styles.sellerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(item.seller?.name)}</Text>
          </View>
          <Text style={styles.sellerName} numberOfLines={1}>{item.seller?.name}</Text>

          {/* Store badge */}
          {item.seller_type === 'store' && (
            <View style={styles.shopBadge}>
              <Ionicons name="storefront" size={11} color={colors.primary} />
              <Text style={styles.shopBadgeText}>Shop</Text>
            </View>
          )}

          {combinedViews > 0 && (
            <View style={styles.viewsChip}>
              <Ionicons name="eye-outline" size={9} color={colors.textLight} />
              <Text style={styles.viewsText}>{formatCount(combinedViews)}</Text>
            </View>
          )}
        </View>

        {/* Recency label */}
        {recency ? (
          <Text style={styles.recencyText}>{recency}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function MasonryGrid({ items, onItemPress }) {
  if (!items || items.length === 0) return null;

  // Split into two columns, alternating
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);

  return (
    <View style={styles.grid}>
      {/* Left column */}
      <View style={styles.column}>
        {left.map((item) => (
          <MasonryCard
            key={item.id}
            item={item}
            onPress={() => onItemPress(item)}
          />
        ))}
      </View>

      {/* Right column */}
      <View style={styles.column}>
        {right.map((item) => (
          <MasonryCard
            key={item.id}
            item={item}
            onPress={() => onItemPress(item)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    gap: COL_GAP,
  },
  column: {
    flex: 1,
    gap: COL_GAP,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  promotedCard: {
    borderWidth: 1.5,
    borderColor: '#0D9488',
  },

  // Boosted left-edge accent
  boostedAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#F59E0B',
    zIndex: 5,
  },

  // Image
  imageWrap: {
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },

  // SOLD overlay
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
  },

  // Heart
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Availability badge
  availBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: '70%',
  },
  availBadgeOn: {
    backgroundColor: 'rgba(52,199,89,0.92)',
  },
  availDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  availBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  availBadgeTextOn: {
    color: '#fff',
  },
  imageOutpostFaded: {
    opacity: 0.45,
  },
  outpostOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    gap: 4,
  },
  outpostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.textSecondary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  outpostBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  outpostScheduleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },

  // Boosted pill
  boostedPill: {
    position: 'absolute',
    top: 8,
    right: 44,
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  boostedPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Promoted pill
  promotedPill: {
    position: 'absolute',
    top: 8,
    right: 44,
    backgroundColor: '#0D9488',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promotedPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // Bottom pill row
  pillRow: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  agePill: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  agePillWarn: {
    backgroundColor: 'rgba(255,165,0,0.9)',
  },
  ageText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  ageTextWarn: {
    color: '#fff',
  },

  // Info block
  info: {
    padding: 10,
    gap: 3,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1e21',
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a1a1a',
    lineHeight: 17,
  },

  // Seller
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.primary,
  },
  sellerName: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    flex: 1,
  },

  // Shop badge
  shopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary + '15',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  shopBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },

  viewsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewsText: {
    fontSize: 9,
    color: colors.textLight,
    fontWeight: '500',
  },

  // Recency label
  recencyText: {
    fontSize: 10,
    color: colors.textLight,
    fontWeight: '400',
    marginTop: 2,
  },
});
