import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, RefreshControl, Linking,
} from 'react-native';

const SCREEN_H = Dimensions.get('window').height;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import RadarView from '../components/RadarView';
import MasonryGrid from '../components/MasonryGrid';
import { PROXIMITY_SNAPS, proximityLabel, nextProximitySnap } from '../lib/listingUtils';
import { getUserLocation } from '../lib/location';
import colors from '../theme/colors';
import { categories } from '../data/mockData';

// Height of the two filter rows (radius + category) + top safe area
const FILTERS_HEIGHT = 88;

export default function NearbyScreen({ navigation }) {
  const {
    proximityMiles, setProximityMiles,
    filteredListings, selectedCategory, setSelectedCategory,
    onScreenScroll, userType, userLocation, setUserLocation,
  } = useApp();
  const isHost = userType === 'host';
  const [viewMode, setViewMode] = useState('radar');
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationStaleNotice, setLocationStaleNotice] = useState(false);
  const staleNoticeTimer = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!userLocation) setLocationDenied(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [userLocation]);

  // Cleanup stale notice timer on unmount
  useEffect(() => {
    return () => {
      if (staleNoticeTimer.current) clearTimeout(staleNoticeTimer.current);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLocationStaleNotice(false);

    // Race GPS against a 3-second timeout
    let freshLoc = null;
    try {
      freshLoc = await Promise.race([
        getUserLocation(),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
    } catch {
      freshLoc = null;
    }

    if (freshLoc) {
      setUserLocation(freshLoc);
    } else {
      // Show stale location notice — auto-dismiss after 3s
      setLocationStaleNotice(true);
      if (staleNoticeTimer.current) clearTimeout(staleNoticeTimer.current);
      staleNoticeTimer.current = setTimeout(() => {
        setLocationStaleNotice(false);
      }, 3000);
    }

    // Always finish refresh after 1200ms
    setTimeout(() => setRefreshing(false), 1200);
  }, [setUserLocation]);

  const filtersTop = insets.top;

  return (
    <View style={styles.root}>

      {/* ── Full-height scrollable list (rendered first so filters float above) ── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScreenScroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: filtersTop + FILTERS_HEIGHT + 8 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressViewOffset={filtersTop + FILTERS_HEIGHT}
          />
        }
      >
        {/* Stale location notice pill */}
        {locationStaleNotice && (
          <View style={styles.staleNoticePill}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.staleNoticeText}>Using last known location</Text>
          </View>
        )}

        {/* Radar card */}
        <View style={styles.radarCard}>
          <View style={styles.radarTopRow}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
            <TouchableOpacity
              style={styles.viewToggle}
              onPress={() => setViewMode(v => v === 'radar' ? 'list' : 'radar')}
            >
              <Ionicons
                name={viewMode === 'radar' ? 'list-outline' : 'radio-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {viewMode === 'radar' ? (
            <>
              <RadarView
                items={filteredListings}
                maxMiles={proximityMiles}
                onItemPress={(item) => navigation.navigate('ItemDetail', { item })}
              />
              <View style={styles.scanStatus}>
                <Text style={styles.scanCount}>
                  {filteredListings.length} {isHost ? 'listings' : 'items'} within {proximityLabel(proximityMiles)}
                </Text>
                <Text style={styles.scanSub}>
                  {isHost ? 'Tap a dot to view a listing' : 'Tap a dot to see the item'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.listViewPlaceholder}>
              <Ionicons name="list" size={40} color={colors.primaryLight} />
              <Text style={styles.scanCount}>{filteredListings.length} items nearby</Text>
              <Text style={styles.scanSub}>Within {proximityLabel(proximityMiles)}</Text>
            </View>
          )}
        </View>

        {/* Items grid header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Items Near You</Text>
          <Text style={styles.listCount}>{filteredListings.length} results</Text>
        </View>

        {/* Thin feed nudge */}
        {filteredListings.length > 0 && filteredListings.length < 4 && nextProximitySnap(proximityMiles) !== null && (
          <TouchableOpacity
            style={styles.thinFeedBanner}
            onPress={() => setProximityMiles(nextProximitySnap(proximityMiles))}
            activeOpacity={0.85}
          >
            <Ionicons name="expand-outline" size={16} color={colors.primary} />
            <Text style={styles.thinFeedText}>
              Feed might be thin — expand to {proximityLabel(nextProximitySnap(proximityMiles))}?
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}

        {filteredListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={56} color={colors.primaryLight} />
            <Text style={styles.emptyTitle}>No items in range</Text>
            <Text style={styles.emptySub}>
              {isHost
                ? 'No one is selling nearby yet. Expand your radius or check back soon.'
                : 'No sales nearby. Try expanding your radius or check back later.'}
            </Text>
          </View>
        ) : (
          <MasonryGrid
            items={filteredListings}
            onItemPress={(item) => navigation.navigate('ItemDetail', { item })}
          />
        )}

      </ScrollView>

      {/* Location denied banner */}
      {locationDenied && !userLocation && (
        <TouchableOpacity
          style={[styles.locationBanner, { top: filtersTop + 88 }]}
          onPress={() => { Linking.openSettings(); setLocationDenied(false); }}
          activeOpacity={0.8}
        >
          <Ionicons name="location-outline" size={14} color={colors.warning} />
          <Text style={styles.locationBannerText}>Enable location for real distances</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.warning} />
        </TouchableOpacity>
      )}

      {/* ── Filter bar — floats above the scroll content ── */}
      <View
        style={[styles.filtersWrapper, { top: filtersTop }]}
        pointerEvents="box-none"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Ionicons name="location" size={13} color={colors.primary} />
          <Text style={styles.filterLabel}>Radius</Text>
          {PROXIMITY_SNAPS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, Math.abs(proximityMiles - m) < 0.001 && styles.chipActive]}
              onPress={() => setProximityMiles(m)}
            >
              <Text style={[styles.chipText, Math.abs(proximityMiles - m) < 0.001 && styles.chipTextActive]}>
                {proximityLabel(m)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={13}
                color={selectedCategory === cat.id ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: SCREEN_H,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },

  // ── Scroll ──────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // ── Stale location notice ──────────────────────────
  staleNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  staleNoticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // ── Location banner ────────────────────────────────────
  locationBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warning + '18',
    borderWidth: 1,
    borderColor: colors.warning + '40',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    zIndex: 20,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
    fontWeight: '500',
  },

  // ── Filter bar (absolutely positioned, always on top) ──
  filtersWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingBottom: 4,
    zIndex: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 7,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // ── Radar card ──────────────────────────────────────
  radarCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 0,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  radarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F8EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  viewToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanStatus: {
    marginTop: 14,
    alignItems: 'center',
  },
  scanCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  scanSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  listViewPlaceholder: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // ── Item grid ───────────────────────────────────────
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  listCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  thinFeedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  thinFeedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

});
