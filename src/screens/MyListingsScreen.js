import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { fetchInterestedCounts } from '../lib/db';
import { formatOutpostSchedule } from '../lib/listingUtils';
import InterestedBuyersSheet from '../components/InterestedBuyersSheet';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (width - 32 - CARD_GAP) / 2;

const TABS = ['Active', 'Sold'];

function ListingGridCard({ item, onPress, interestedCount, onShowInterested, onAddLocation, fixingLocation }) {
  const isSold = item.sold || item.pickedUp;
  const isPendingOutpost = item.is_outpost && !item.outpost_confirmed;
  // Outpost listings get their coordinates from the geocoded address instead
  // of device GPS, so a missing lat/long there isn't this kind of problem.
  const missingLocation = !item.is_outpost && (item.latitude == null || item.longitude == null);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.imageWrap}>
        {item.photos?.[0] ? (
          <Image source={{ uri: item.photos[0] }} style={[styles.image, isPendingOutpost && styles.imageFaded]} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={32} color={colors.textLight} />
          </View>
        )}
        {isPendingOutpost && (
          <View style={styles.outpostOverlay}>
            <View style={styles.outpostBadge}>
              <Ionicons name="flag" size={10} color="#fff" />
              <Text style={styles.outpostBadgeText}>
                {item.outpost_fee_paid ? 'OUTPOST' : 'UNPAID'}
              </Text>
            </View>
            <Text style={styles.outpostScheduleText} numberOfLines={1}>
              {formatOutpostSchedule(item.outpost_scheduled_at)}
            </Text>
          </View>
        )}
        {isSold && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldOverlayText}>{item.pickedUp ? 'Picked Up' : 'Sold'}</Text>
          </View>
        )}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>${item.price}</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardMeta}>{item.category}</Text>
        {item.postedAt ? (
          <Text style={styles.cardAge}>Posted {item.postedAt}</Text>
        ) : null}
        {interestedCount > 0 && (
          <TouchableOpacity
            style={styles.interestedBadge}
            onPress={(e) => { e.stopPropagation?.(); onShowInterested(); }}
            activeOpacity={0.75}
          >
            <Ionicons name="people" size={12} color={colors.primary} />
            <Text style={styles.interestedBadgeText}>{interestedCount} interested</Text>
          </TouchableOpacity>
        )}
        {missingLocation && (
          <TouchableOpacity
            style={styles.missingLocationBadge}
            onPress={(e) => { e.stopPropagation?.(); onAddLocation(item); }}
            activeOpacity={0.75}
            disabled={fixingLocation}
          >
            <Ionicons name="location-outline" size={12} color={colors.danger} />
            <Text style={styles.missingLocationText}>
              {fixingLocation ? 'Setting location…' : 'No location — tap to fix'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MyListingsScreen({ navigation }) {
  const { listings, user, openMarkSoldModal, addListingLocation } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('Active');
  const [interestedCounts, setInterestedCounts] = useState({});
  const [interestedSheetListing, setInterestedSheetListing] = useState(null);
  const [fixingLocationId, setFixingLocationId] = useState(null);
  const [locationError, setLocationError] = useState('');

  const handleAddLocation = async (item) => {
    setLocationError('');
    setFixingLocationId(item.id);
    try {
      await addListingLocation(item.id);
    } catch (e) {
      setLocationError(`Couldn't set location for "${item.title}" — make sure location access is allowed, then try again.`);
    } finally {
      setFixingLocationId(null);
    }
  };

  const myListings = listings.filter(
    (l) => l.seller?.id === user?.id || l.seller?.id === 'me'
  );
  const activeListings = myListings.filter((l) => !l.sold && !l.pickedUp && l.status !== 'expired');
  const soldListings = myListings.filter((l) => l.sold || l.pickedUp);
  const displayed = tab === 'Active' ? activeListings : soldListings;

  useEffect(() => {
    const ids = myListings.filter((l) => !String(l.id).startsWith('temp-')).map((l) => l.id);
    if (ids.length === 0) return;
    fetchInterestedCounts(ids).then(setInterestedCounts).catch(() => {});
  }, [myListings.length]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Garage</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateListing')}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t}
              <Text style={styles.tabCount}>
                {'  '}{t === 'Active' ? activeListings.length : soldListings.length}
              </Text>
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {locationError ? (
        <View style={styles.locationErrorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.locationErrorText}>{locationError}</Text>
        </View>
      ) : null}

      {/* Grid */}
      <FlatList
        data={displayed}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={48} color={colors.primaryLight} />
            <Text style={styles.emptyTitle}>
              {tab === 'Active' ? 'Nothing listed yet' : 'No sold items yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'Active'
                ? 'Tap + to post your first item'
                : 'Mark an item sold from your active listings'}
            </Text>
            {tab === 'Active' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateListing')}
              >
                <Text style={styles.emptyBtnText}>Post an Item</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ListingGridCard
            item={item}
            onPress={() => navigation.navigate('ItemDetail', { item })}
            interestedCount={interestedCounts[item.id] || 0}
            onShowInterested={() => setInterestedSheetListing(item)}
            onAddLocation={handleAddLocation}
            fixingLocation={fixingLocationId === item.id}
          />
        )}
      />

      <InterestedBuyersSheet
        visible={!!interestedSheetListing}
        onClose={() => setInterestedSheetListing(null)}
        listing={interestedSheetListing}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.cardBackground,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.cardBackground,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 3,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },
  tabCount: { fontWeight: '500', opacity: 0.8 },

  grid: { paddingHorizontal: 16, paddingBottom: 40 },
  row: { justifyContent: 'space-between', marginBottom: CARD_GAP },

  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: CARD_WIDTH, backgroundColor: colors.border },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  soldOverlayText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  priceBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  priceText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  cardInfo: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 18 },
  cardMeta: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 3 },
  cardAge: { fontSize: 10, color: colors.textLight, marginTop: 1 },

  // Outpost
  imageFaded: { opacity: 0.45 },
  outpostOverlay: { position: 'absolute', top: 8, left: 8, right: 8, gap: 4 },
  outpostBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: colors.textSecondary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  outpostBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  outpostScheduleText: { fontSize: 10, fontWeight: '700', color: colors.text },

  // Interested buyers
  interestedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start', backgroundColor: colors.primary + '15',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6,
  },
  interestedBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },

  // Missing location
  missingLocationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start', backgroundColor: colors.danger + '15',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6,
  },
  missingLocationText: { fontSize: 10, fontWeight: '700', color: colors.danger },
  locationErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '12', borderWidth: 1, borderColor: colors.danger + '30',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 16, marginBottom: 12,
  },
  locationErrorText: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.danger, lineHeight: 17 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 20, backgroundColor: colors.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
