import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MasonryGrid from '../components/MasonryGrid';
import colors from '../theme/colors';

export default function StorefrontScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { store, listings } = route.params || {};

  if (!store) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.errorState}>
          <Ionicons name="storefront-outline" size={48} color={colors.primaryLight} />
          <Text style={styles.errorText}>Store not found</Text>
        </View>
      </View>
    );
  }

  const activeListings = (listings || []).filter((l) => l.active && !l.sold && !l.pickedUp);
  const thumbnailListings = activeListings.slice(0, 8);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Store header card */}
        <View style={styles.storeCard}>
          {/* Store avatar / icon */}
          <View style={styles.storeIconWrap}>
            <Ionicons name="storefront" size={32} color="#fff" />
          </View>

          <View style={styles.storeInfo}>
            <View style={styles.storeNameRow}>
              <Text style={styles.storeName}>{store.name}</Text>
              <View style={styles.shopBadge}>
                <Ionicons name="storefront" size={11} color="#0D9488" />
                <Text style={styles.shopBadgeText}>Shop</Text>
              </View>
            </View>
            {store.neighborhood ? (
              <View style={styles.neighborhoodRow}>
                <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.neighborhoodText}>{store.neighborhood}</Text>
              </View>
            ) : null}
            {store.description ? (
              <Text style={styles.storeDescription}>{store.description}</Text>
            ) : null}
          </View>

          {/* Stats row */}
          <View style={styles.storeStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{activeListings.length}</Text>
              <Text style={styles.statLabel}>Listings</Text>
            </View>
            {store.rating != null && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: '#F59E0B' }]}>{store.rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </>
            )}
            {store.sales != null && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{store.sales}</Text>
                  <Text style={styles.statLabel}>Sold</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Rotating thumbnail strip */}
        {thumbnailListings.length > 0 && (
          <View style={styles.thumbnailSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailStrip}
            >
              {thumbnailListings.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => navigation.navigate('ItemDetail', { item: l })}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: l.photos?.[0] }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Active listings section header */}
        <View style={styles.listingsHeader}>
          <Text style={styles.listingsTitle}>Active Listings</Text>
          <Text style={styles.listingsCount}>{activeListings.length} items</Text>
        </View>

        {/* Listings grid */}
        {activeListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={40} color={colors.primaryLight} />
            <Text style={styles.emptyTitle}>No active listings</Text>
            <Text style={styles.emptySub}>Check back soon for new items from this shop.</Text>
          </View>
        ) : (
          <MasonryGrid
            items={activeListings}
            onItemPress={(item) => navigation.navigate('ItemDetail', { item })}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {},

  // Top bar
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
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

  // Store header card
  storeCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  storeIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  storeInfo: {
    marginBottom: 16,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  storeName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  shopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D948820',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  shopBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  neighborhoodText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  storeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },

  // Stats
  storeStats: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // Thumbnail strip
  thumbnailSection: {
    marginBottom: 16,
  },
  thumbnailStrip: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.border,
  },

  // Listings section header
  listingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listingsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  listingsCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Error state
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
