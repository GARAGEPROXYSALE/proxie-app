import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Dimensions, Alert, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { isStale, isExpired } from '../lib/listingUtils';
import colors from '../theme/colors';
import { Swipeable } from 'react-native-gesture-handler';

const SCREEN_H = Dimensions.get('window').height;

// ─────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, onPress, children, badge }) {
  return (
    <TouchableOpacity style={styles.sectionCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name={icon} size={18} color={colors.textSecondary} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {badge != null && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {children}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// Swipeable stale check-in card — reveals Still Available + Mark Sold
// ─────────────────────────────────────────────────────────────

function SwipeableStaleCard({ listing, onMarkSold, onStillAvailable }) {
  const swipeRef = useRef(null);

  const renderRightActions = () => (
    <View style={styles.listingSwipeActions}>
      <TouchableOpacity
        style={styles.swipeStillAvail}
        onPress={() => { swipeRef.current?.close(); onStillAvailable(listing.id); }}
        activeOpacity={0.85}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
        <Text style={styles.swipeActionText}>Still{'\n'}Available</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.swipeMarkSold}
        onPress={() => { swipeRef.current?.close(); onMarkSold(listing); }}
        activeOpacity={0.85}
      >
        <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
        <Text style={styles.swipeActionText}>Mark{'\n'}Sold</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={50}
      overshootRight={false}
    >
      <View style={styles.staleCard}>
        <Image source={{ uri: listing.photos?.[0] }} style={styles.staleImage} resizeMode="cover" />
        <View style={styles.staleInfo}>
          <Text style={styles.staleName} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.staleAge}>Listed {listing.postedAt} · ${listing.price}</Text>
          <Text style={styles.stalePrompt}>← Swipe to update</Text>
        </View>
        <Ionicons name="chevron-back" size={14} color={colors.textLight} style={{ transform: [{ scaleX: -1 }], marginRight: 10 }} />
      </View>
    </Swipeable>
  );
}

// ─────────────────────────────────────────────────────────────
// Swipeable listing row — reveals Still Available + Mark Sold
// ─────────────────────────────────────────────────────────────

function SwipeableListingRow({ listing, onMarkSold, onStillAvailable }) {
  const swipeRef = useRef(null);

  const renderRightActions = () => (
    <View style={styles.listingSwipeActions}>
      <TouchableOpacity
        style={styles.swipeStillAvail}
        onPress={() => { swipeRef.current?.close(); onStillAvailable(listing.id); }}
        activeOpacity={0.85}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
        <Text style={styles.swipeActionText}>Still{'\n'}Available</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.swipeMarkSold}
        onPress={() => { swipeRef.current?.close(); onMarkSold(listing); }}
        activeOpacity={0.85}
      >
        <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
        <Text style={styles.swipeActionText}>Mark{'\n'}Sold</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={50}
      overshootRight={false}
    >
      <View style={styles.myListingRow}>
        <Image source={{ uri: listing.photos?.[0] }} style={styles.myListingImage} resizeMode="cover" />
        <View style={styles.myListingInfo}>
          <Text style={styles.myListingTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.myListingPrice}>${listing.price}</Text>
          <Text style={styles.myListingMeta}>{listing.postedAt}</Text>
        </View>
        <Ionicons name="chevron-back" size={14} color={colors.textLight} style={{ transform: [{ scaleX: -1 }] }} />
      </View>
    </Swipeable>
  );
}

// ─────────────────────────────────────────────────────────────
// HOST VIEW
// ─────────────────────────────────────────────────────────────

function HostView({ navigation, user, listings, messages, onScreenScroll, openMarkSoldModal, insets, signOut, renewListing }) {
  const myListings = listings.filter((l) => l.seller.id === user.id || l.seller.id === 'me');
  const unreadCount = messages.reduce((acc, m) => acc + m.unread, 0);
  const savedItems = listings.filter((l) => l.saved);
  const activeListings = myListings.filter((l) => !l.sold && !l.pickedUp && l.status !== 'expired');
  const soldListings = myListings.filter((l) => l.sold || l.pickedUp);
  const expiredListings = myListings.filter((l) => l.status === 'expired' || isExpired(l.createdAt));

  const staleListings = activeListings.filter((l) => isStale(l.createdAt));

  const [listingsTab, setListingsTab] = useState('active');

  // FAB fades in when top bar scrolls out of view, fades out when it returns
  const fabOpacity = useRef(new Animated.Value(0)).current;
  const fabActiveRef = useRef(false);
  const [fabActive, setFabActive] = useState(false);

  const handleScroll = useCallback((event) => {
    onScreenScroll(event);
    const y = event.nativeEvent.contentOffset.y;
    // Top bar is ~58px tall; show FAB once it's fully scrolled away
    const shouldShow = y > 58;
    if (shouldShow !== fabActiveRef.current) {
      fabActiveRef.current = shouldShow;
      setFabActive(shouldShow);
      Animated.timing(fabOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [onScreenScroll, fabOpacity]);

  return (
    <View style={[styles.safeArea, { height: SCREEN_H }]}>
      {/* Safe area spacer — always pinned, covers the notch */}
      <View style={{ height: insets.top, backgroundColor: colors.background }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        {/* Top bar — scrolls away with the page */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>My Garage</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Saved')}
            >
              <Ionicons name="bookmark-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('CreateListing')}
            >
              <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content wrapper — provides the horizontal padding for all sections below */}
        <View style={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileLeft}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>
                  {(user.name || 'H').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.profileMid}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileStatus}>{user.status || 'Garage Sale Host'}</Text>
            {user.bio ? <Text style={styles.profileBio}>{user.bio}</Text> : null}
            {user.building ? (
              <View style={styles.buildingRow}>
                <Ionicons name="business-outline" size={12} color={colors.primary} />
                <Text style={styles.buildingText}>{user.building}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Row — tappable to jump to tab */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={() => setListingsTab('active')} activeOpacity={0.7}>
            <Text style={[styles.statNum, listingsTab === 'active' && styles.statNumActive]}>{activeListings.length}</Text>
            <Text style={[styles.statLabel, listingsTab === 'active' && styles.statLabelActive]}>Active</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.stat} onPress={() => setListingsTab('sold')} activeOpacity={0.7}>
            <Text style={[styles.statNum, listingsTab === 'sold' && styles.statNumActive]}>{soldListings.length + user.sales}</Text>
            <Text style={[styles.statLabel, listingsTab === 'sold' && styles.statLabelActive]}>Sold</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: '#FFB800' }]}>
              {user.rating ? user.rating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.stat} onPress={() => setListingsTab('saved')} activeOpacity={0.7}>
            <Text style={[styles.statNum, listingsTab === 'saved' && styles.statNumActive]}>{savedItems.length}</Text>
            <Text style={[styles.statLabel, listingsTab === 'saved' && styles.statLabelActive]}>Saved</Text>
          </TouchableOpacity>
        </View>

        {/* Stale listing check-ins */}
        {staleListings.length > 0 && (
          <View style={styles.staleSection}>
            <View style={styles.staleTitleRow}>
              <Ionicons name="time-outline" size={15} color={colors.warning} />
              <Text style={styles.staleTitle}>Still for sale?</Text>
            </View>
            {staleListings.map((l) => (
              <SwipeableStaleCard
                key={l.id}
                listing={l}
                onMarkSold={openMarkSoldModal}
                onStillAvailable={renewListing}
              />
            ))}
          </View>
        )}

        {/* My Listings section — Active / Sold / Saved tabs */}
        <View style={styles.myListingsSection}>
          <View style={styles.myListingsHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.sectionTitle}>My Garage</Text>
            </View>
            <View style={styles.tabSwitcher}>
              {['active', 'sold', 'saved'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabBtn, listingsTab === t && styles.tabBtnActive]}
                  onPress={() => setListingsTab(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabBtnText, listingsTab === t && styles.tabBtnTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Active ── */}
          {listingsTab === 'active' && (
            activeListings.length === 0 ? (
              <View style={styles.emptySection}>
                <Ionicons name="pricetag-outline" size={32} color={colors.primaryLight} />
                <Text style={styles.emptyText}>No active listings</Text>
                <Text style={styles.emptySubText}>Tap + to post your first item</Text>
              </View>
            ) : (
              <View style={styles.myListingsList}>
                {activeListings.map((l) => (
                  <SwipeableListingRow
                    key={l.id}
                    listing={l}
                    onMarkSold={openMarkSoldModal}
                    onStillAvailable={renewListing}
                  />
                ))}
              </View>
            )
          )}

          {/* ── Sold ── */}
          {listingsTab === 'sold' && (
            soldListings.length === 0 ? (
              <View style={styles.emptySection}>
                <Ionicons name="checkmark-circle-outline" size={32} color={colors.primaryLight} />
                <Text style={styles.emptyText}>Nothing sold yet</Text>
                <Text style={styles.emptySubText}>Mark items as sold from your active listings</Text>
              </View>
            ) : (
              <View style={styles.myListingsList}>
                {soldListings.map((l) => (
                  <View key={l.id} style={styles.myListingRow}>
                    <Image source={{ uri: l.photos?.[0] }} style={[styles.myListingImage, { opacity: 0.7 }]} resizeMode="cover" />
                    <View style={styles.myListingInfo}>
                      <Text style={styles.myListingTitle} numberOfLines={1}>{l.title}</Text>
                      <Text style={styles.myListingPrice}>${l.price}</Text>
                      <View style={styles.soldBadge}>
                        <Text style={styles.soldBadgeText}>{l.pickedUp ? 'Picked Up' : 'Sold'}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )
          )}

          {/* ── Saved ── */}
          {listingsTab === 'saved' && (
            savedItems.length === 0 ? (
              <View style={styles.emptySection}>
                <Ionicons name="bookmark-outline" size={32} color={colors.primaryLight} />
                <Text style={styles.emptyText}>No saved items</Text>
                <Text style={styles.emptySubText}>Bookmark items while browsing to see them here</Text>
              </View>
            ) : (
              <View style={styles.myListingsList}>
                {savedItems.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={styles.myListingRow}
                    onPress={() => navigation.navigate('ItemDetail', { item: l })}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: l.photos?.[0] }} style={styles.myListingImage} resizeMode="cover" />
                    <View style={styles.myListingInfo}>
                      <Text style={styles.myListingTitle} numberOfLines={1}>{l.title}</Text>
                      <Text style={styles.myListingPrice}>${l.price}</Text>
                      <Text style={styles.myListingMeta}>
                        {typeof l.distance === 'number' ? `${l.distance.toFixed(1)} mi away` : l.distance}
                      </Text>
                    </View>
                    <Ionicons name="bookmark" size={16} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}
        </View>

        {/* Grid — Saved + Messages */}
        <View style={styles.grid}>
          <SectionCard
            title="Saved"
            icon="bookmark-outline"
            onPress={() => navigation.navigate('Saved')}
            badge={savedItems.length}
          >
            {savedItems.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>Bookmark items you love</Text>
              </View>
            ) : (
              <View style={styles.miniListings}>
                {savedItems.slice(0, 2).map((l) => (
                  <View key={l.id} style={styles.miniItem}>
                    <Image source={{ uri: l.photos[0] }} style={styles.miniImage} resizeMode="cover" />
                    <Text style={styles.miniTitle} numberOfLines={1}>{l.title}</Text>
                    <Text style={styles.miniPrice}>${l.price}</Text>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          <SectionCard
            title="Messages"
            icon="chatbubble-outline"
            onPress={() => navigation.navigate('Messages')}
            badge={unreadCount}
          >
            {messages.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No conversations yet</Text>
              </View>
            ) : (
              <View>
                {messages.slice(0, 2).map((m) => (
                  <View key={m.id} style={styles.msgPreview}>
                    <View style={styles.msgAvatar}>
                      <Ionicons name="person" size={16} color={colors.primaryLight} />
                    </View>
                    <View style={styles.msgText}>
                      <Text style={styles.msgName}>{m.with.name}</Text>
                      <Text style={styles.msgLast} numberOfLines={1}>{m.lastMessage || 'New conversation'}</Text>
                    </View>
                    {m.unread > 0 && <View style={styles.unreadDot} />}
                  </View>
                ))}
              </View>
            )}
          </SectionCard>
        </View>

        {/* Grid — Building Mode */}
        <View style={styles.grid}>
          <SectionCard
            title="Building Mode"
            icon="business-outline"
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={styles.emptySection}>
              {user.building ? (
                <Text style={styles.buildingCardText}>{user.building}</Text>
              ) : (
                <Text style={styles.emptyText}>Join your building's sale</Text>
              )}
            </View>
          </SectionCard>

          <SectionCard
            title="Wishlist"
            icon="bookmark-outline"
            onPress={() => navigation.navigate('Wishlist')}
          >
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>Track categories you want</Text>
            </View>
          </SectionCard>
        </View>

        {/* Account footer */}
        <View style={styles.accountSection}>
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <View style={styles.accountRowLeft}>
              <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.accountRowLabel}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate('Legal', { tab: 'terms' })}
            activeOpacity={0.7}
          >
            <View style={styles.accountRowLeft}>
              <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.accountRowLabel}>Terms &amp; Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() =>
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
              ])
            }
            activeOpacity={0.7}
          >
            <View style={styles.accountRowLeft}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[styles.accountRowLabel, { color: colors.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        </View>{/* end scrollContent wrapper */}
      </ScrollView>

      {/* FAB — fades in when top bar scrolls out of view */}
      <Animated.View
        pointerEvents={fabActive ? 'box-none' : 'none'}
        style={[styles.fab, { bottom: insets.bottom + 80, opacity: fabOpacity }]}
      >
        <TouchableOpacity
          style={styles.fabInner}
          onPress={() => navigation.navigate('CreateListing')}
          activeOpacity={0.88}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// GUEST VIEW
// ─────────────────────────────────────────────────────────────

function GuestView({ navigation, user, listings, messages, onScreenScroll, insets, signOut }) {
  const savedItems = listings.filter((l) => l.saved);
  const unreadCount = messages.reduce((acc, m) => acc + m.unread, 0);

  return (
    <View style={[styles.safeArea, { height: SCREEN_H }]}>
      {/* Safe area spacer */}
      <View style={{ height: insets.top, backgroundColor: colors.background }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScreenScroll}
      >
        {/* Top bar — scrolls with content */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>My Hub</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Wishlist')}
            >
              <Ionicons name="bookmark-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.scrollContent}>
        {/* Guest greeting card */}
        <View style={styles.guestGreetCard}>
          <View style={styles.guestAvatarWrap}>
            <View style={styles.guestAvatar}>
              <Text style={styles.avatarInitials}>
                {(user.name || 'G').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={[styles.statusBadge, styles.guestStatusBadge]}>
              <Ionicons name="search" size={8} color={colors.textSecondary} />
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>GUEST</Text>
            </View>
          </View>
          <View style={styles.guestGreetText}>
            <Text style={styles.guestGreeting}>Hey, {user.name || 'there'}! 👋</Text>
            <Text style={styles.guestSub}>Find amazing deals from Hosts nearby.</Text>
          </View>
        </View>

        {/* Quick browse CTA */}
        <TouchableOpacity
          style={styles.browseCard}
          onPress={() => navigation.getParent()?.navigate('NearbyTab')}
          activeOpacity={0.88}
        >
          <View style={styles.browseIconWrap}>
            <Ionicons name="radio" size={28} color="#fff" />
          </View>
          <View style={styles.browseText}>
            <Text style={styles.browseTitle}>Browse Nearby Sales</Text>
            <Text style={styles.browseSub}>See what's for sale within your radius</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Saved + Messages */}
        <View style={styles.grid}>
          <SectionCard
            title="Saved Items"
            icon="bookmark-outline"
            onPress={() => navigation.navigate('Saved')}
            badge={savedItems.length}
          >
            {savedItems.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>Tap 🔖 on any item to save it</Text>
              </View>
            ) : (
              <View style={styles.miniListings}>
                {savedItems.slice(0, 2).map((l) => (
                  <View key={l.id} style={styles.miniItem}>
                    <Image source={{ uri: l.photos[0] }} style={styles.miniImage} resizeMode="cover" />
                    <Text style={styles.miniTitle} numberOfLines={1}>{l.title}</Text>
                    <Text style={styles.miniPrice}>${l.price}</Text>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          <SectionCard
            title="Messages"
            icon="chatbubble-outline"
            onPress={() =>
              Alert.alert(
                'Account Required',
                'Create a free account to message sellers and arrange meetups with Hosts near you.',
                [
                  { text: 'Not Now', style: 'cancel' },
                  { text: 'Create Account', onPress: signOut },
                ]
              )
            }
          >
            <View style={styles.emptySection}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textLight} />
              <Text style={styles.emptyText}>Sign up to message Hosts</Text>
            </View>
          </SectionCard>
        </View>

        {/* Wishlist CTA */}
        <TouchableOpacity
          style={styles.browseCard}
          onPress={() => navigation.navigate('Wishlist')}
          activeOpacity={0.88}
        >
          <View style={[styles.browseIconWrap, { backgroundColor: colors.primaryDark }]}>
            <Ionicons name="bookmark" size={28} color="#fff" />
          </View>
          <View style={styles.browseText}>
            <Text style={styles.browseTitle}>Wishlist</Text>
            <Text style={styles.browseSub}>Get notified when a match lists nearby</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>

        {/* Guest tip */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color={colors.warning} />
          <View style={styles.tipText}>
            <Text style={styles.tipTitle}>Want to sell too?</Text>
            <Text style={styles.tipBody}>
              Sign up as a Host to list items and get discovered by nearby buyers.
            </Text>
          </View>
        </View>

        {/* Account footer */}
        <View style={styles.accountSection}>
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <View style={styles.accountRowLeft}>
              <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.accountRowLabel}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate('Legal', { tab: 'terms' })}
            activeOpacity={0.7}
          >
            <View style={styles.accountRowLeft}>
              <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.accountRowLabel}>Terms &amp; Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity
            style={styles.accountRow}
            onPress={() =>
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
              ])
            }
            activeOpacity={0.7}
          >
            <View style={styles.accountRowLeft}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[styles.accountRowLabel, { color: colors.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
        </View>{/* end scrollContent wrapper */}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT — routes to Host or Guest view
// ─────────────────────────────────────────────────────────────

export default function IdentityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, listings, messages, onScreenScroll, openMarkSoldModal, userType, signOut, renewListing } = useApp();

  const sharedProps = { navigation, user, listings, messages, onScreenScroll, insets, signOut };

  if (userType === 'host') {
    return <HostView {...sharedProps} openMarkSoldModal={openMarkSoldModal} renewListing={renewListing} />;
  }
  return <GuestView {...sharedProps} />;
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  // Profile card (Host)
  profileCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  profileLeft: { marginRight: 14 },
  avatarContainer: { alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 5,
    backgroundColor: '#E8F8EE',
    gap: 4,
  },
  guestStatusBadge: {
    backgroundColor: colors.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.success,
  },
  profileMid: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: colors.text },
  profileStatus: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  profileBio: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  buildingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  buildingText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  editProfileBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    flexDirection: 'row',
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Grid
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  sectionCard: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    minHeight: 120,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptySection: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  emptyText: { fontSize: 12, color: colors.textLight, textAlign: 'center' },
  buildingCardText: { fontSize: 12, color: colors.primary, textAlign: 'center', fontWeight: '500' },

  miniListings: { flexDirection: 'row', gap: 6 },
  miniItem: { flex: 1, alignItems: 'center', position: 'relative' },
  miniImage: { width: '100%', height: 50, borderRadius: 8, backgroundColor: colors.border },
  miniSoldBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSoldText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  miniTitle: { fontSize: 10, color: colors.text, marginTop: 3, textAlign: 'center' },
  miniPrice: { fontSize: 11, color: colors.primary, fontWeight: '700' },

  msgPreview: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#DCE9F5',
    alignItems: 'center', justifyContent: 'center',
  },
  msgText: { flex: 1 },
  msgName: { fontSize: 12, fontWeight: '600', color: colors.text },
  msgLast: { fontSize: 11, color: colors.textSecondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  // Stale listings
  staleSection: { marginBottom: 16 },
  staleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  staleTitle: { fontSize: 14, fontWeight: '700', color: colors.warning },
  staleCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE5B4',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  staleImage: { width: 64, height: 64, backgroundColor: colors.border },
  staleInfo: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  staleName: { fontSize: 13, fontWeight: '600', color: colors.text },
  staleAge: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  stalePrompt: { fontSize: 11, color: colors.warning, fontWeight: '600', marginTop: 3 },
  // My Listings section (with tab switcher)
  myListingsSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  myListingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 2,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  myListingsList: {
    gap: 10,
  },
  myListingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  myListingImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  myListingInfo: {
    flex: 1,
    gap: 2,
  },
  myListingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  myListingPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  myListingMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Floating action button
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Guest-specific
  guestGreetCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  guestAvatarWrap: { alignItems: 'center' },
  guestAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestGreetText: { flex: 1 },
  guestGreeting: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  guestSub: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  browseCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  browseIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  browseText: { flex: 1 },
  browseTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 3 },
  browseSub: { fontSize: 13, color: colors.textSecondary },

  // Account footer
  accountSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountRowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  accountDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF8E8',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FFE5B4',
  },
  tipText: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#92630A', marginBottom: 3 },
  tipBody: { fontSize: 13, color: '#92630A', lineHeight: 18 },

  // Stat tap-to-filter highlight
  statNumActive: { color: colors.primary },
  statLabelActive: { color: colors.primary, fontWeight: '700' },

  // Sold badge
  soldBadge: {
    backgroundColor: colors.success + '20',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  soldBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },

  // Empty state sub-text
  emptySubText: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 2,
  },

  // Swipeable listing row actions
  listingSwipeActions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginLeft: 4,
    gap: 2,
  },
  swipeStillAvail: {
    width: 90,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeMarkSold: {
    width: 90,
    backgroundColor: '#4A5568',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
});
