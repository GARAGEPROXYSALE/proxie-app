import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, RefreshControl, Linking, Platform, TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';

const SCREEN_H = Dimensions.get('window').height;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import RadarView from '../components/RadarView';
import MasonryGrid from '../components/MasonryGrid';
import { PROXIMITY_SNAPS, proximityLabel, nextProximitySnap, getAvailabilityStatus } from '../lib/listingUtils';
import { getUserLocation } from '../lib/location';
import colors from '../theme/colors';
import { categories } from '../data/mockData';

// Search row + category chip row heights
const SEARCH_ROW_H = 50;
const CHIPS_ROW_H = 44;
const FILTERS_HEIGHT = SEARCH_ROW_H + CHIPS_ROW_H;

export default function NearbyScreen({ navigation }) {
  const {
    proximityMiles, setProximityMiles,
    filteredListings, selectedCategory, setSelectedCategory,
    onScreenScroll, userType, userLocation, setUserLocation,
  } = useApp();
  const isHost = userType === 'host';
  const [viewMode, setViewMode] = useState('radar');
  const [activeNowOnly, setActiveNowOnly] = useState(false);
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationStaleNotice, setLocationStaleNotice] = useState(false);
  const staleNoticeTimer = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!userLocation) setLocationDenied(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [userLocation]);

  // "Active now" depends on knowing where the user is — collapse the filter
  // (and clear it) the moment location isn't available, instead of leaving
  // it silently applied with no visible toggle to turn it off.
  useEffect(() => {
    if (!userLocation && activeNowOnly) setActiveNowOnly(false);
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

  const snapIndex = useMemo(() => {
    const idx = PROXIMITY_SNAPS.findIndex((m) => Math.abs(m - proximityMiles) < 0.001);
    return idx >= 0 ? idx : 0;
  }, [proximityMiles]);

  const lastSnapIndex = useRef(snapIndex);

  const displayedListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredListings;
    return filteredListings.filter(
      (l) =>
        l.title?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.category?.toLowerCase().includes(q)
    );
  }, [filteredListings, searchQuery]);

  // Map/radar view only — does NOT affect the feed grid below, which always
  // shows every listing (with a status badge) so buyers can plan routes ahead.
  const radarItems = useMemo(() => {
    if (!activeNowOnly) return filteredListings;
    return filteredListings.filter((l) => getAvailabilityStatus(l).state === 'available');
  }, [filteredListings, activeNowOnly]);

  const handleSliderChange = useCallback((value) => {
    const index = Math.round(value);
    if (index !== lastSnapIndex.current) {
      lastSnapIndex.current = index;
      setProximityMiles(PROXIMITY_SNAPS[index]);
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  }, [setProximityMiles]);

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
        {/* Location off notice card */}
        {locationDenied && !userLocation && (
          <TouchableOpacity
            style={styles.locationCard}
            onPress={() => { Linking.openSettings(); setLocationDenied(false); }}
            activeOpacity={0.85}
          >
            <View style={styles.locationCardIconWrap}>
              <Ionicons name="location-outline" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationCardTitle}>Turn on location</Text>
              <Text style={styles.locationCardSub}>See real distances to items near you</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>
        )}

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
            {viewMode === 'radar' && userLocation && (
              <TouchableOpacity
                style={[styles.activeNowToggle, activeNowOnly && styles.activeNowToggleOn]}
                onPress={() => setActiveNowOnly((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.activeNowDot, activeNowOnly && styles.activeNowDotOn]} />
                <Text style={[styles.activeNowText, activeNowOnly && styles.activeNowTextOn]}>Active now</Text>
              </TouchableOpacity>
            )}
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
                items={radarItems}
                maxMiles={proximityMiles}
                onItemPress={(item) => navigation.navigate('ItemDetail', { item })}
              />
              <View style={styles.radiusSliderContainer}>
                <Text style={styles.radiusLabel}>Within {proximityLabel(proximityMiles)}</Text>
                <Slider
                  style={styles.radiusSlider}
                  minimumValue={0}
                  maximumValue={PROXIMITY_SNAPS.length - 1}
                  step={1}
                  value={snapIndex}
                  onValueChange={handleSliderChange}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.primary}
                />
                <View style={styles.sliderEndLabels}>
                  <Text style={styles.sliderEndLabel}>{proximityLabel(PROXIMITY_SNAPS[0])}</Text>
                  <Text style={styles.sliderEndLabel}>{proximityLabel(PROXIMITY_SNAPS[PROXIMITY_SNAPS.length - 1])}</Text>
                </View>
              </View>
              <View style={styles.scanStatus}>
                <Text style={styles.scanCount}>
                  {radarItems.length} {isHost ? 'listings' : 'items'} nearby
                  {activeNowOnly && radarItems.length !== filteredListings.length ? ` · active now` : ''}
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
          <Text style={styles.listCount}>
            {searchQuery.trim() ? `${displayedListings.length} of ${filteredListings.length}` : `${filteredListings.length} results`}
          </Text>
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

        {displayedListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={searchQuery.trim() ? 'search-outline' : 'radio-outline'}
              size={56}
              color={colors.primaryLight}
            />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : 'No items in range'}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery.trim()
                ? 'Try a different keyword or clear the search.'
                : isHost
                  ? 'No one is selling nearby yet. Expand your radius or check back soon.'
                  : 'No sales nearby. Try expanding your radius or check back later.'}
            </Text>
            {searchQuery.trim() ? (
              <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchBtnText}>Clear Search</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <MasonryGrid
            items={displayedListings}
            onItemPress={(item) => navigation.navigate('ItemDetail', { item })}
          />
        )}

      </ScrollView>

      {/* ── Filter bar — floats above the scroll content ── */}
      <View
        style={[styles.filtersWrapper, { top: filtersTop }]}
        pointerEvents="box-none"
      >
        {/* Search bar row */}
        <View style={styles.searchRow} pointerEvents="box-none">
          <View style={styles.searchInputWrap} pointerEvents="auto">
            <Ionicons name="search-outline" size={16} color={colors.textLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              placeholderTextColor={colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category chips */}
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

  // ── Location off card ──────────────────────────────────
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  locationCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  locationCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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

  // ── Search bar ─────────────────────────────────────────
  searchRow: {
    height: SEARCH_ROW_H,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    justifyContent: 'center',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },

  // ── Empty search CTA ───────────────────────────────────
  clearSearchBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  clearSearchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 7,
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
  activeNowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  activeNowToggleOn: {
    backgroundColor: colors.success + '20',
  },
  activeNowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textLight,
  },
  activeNowDotOn: {
    backgroundColor: colors.success,
  },
  activeNowText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeNowTextOn: {
    color: colors.success,
  },
  radiusSliderContainer: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 14,
    alignItems: 'center',
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  radiusSlider: {
    width: '100%',
    height: 40,
  },
  sliderEndLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  sliderEndLabel: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '500',
  },
  scanStatus: {
    marginTop: 10,
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
