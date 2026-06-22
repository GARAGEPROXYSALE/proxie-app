import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Animated, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockListings, currentUser, mockMessages } from '../data/mockData';
import { supabase } from '../lib/supabase';
import {
  fetchListings, fetchMyListings, fetchConversations, fetchMessages,
  startConversationDB, sendMessageDB, markMessagesRead, subscribeToMessages,
  fetchWishlist, insertWishlistEntry, deleteWishlistEntry,
  insertListing, updateListingStatus, repostListingRPC, incrementViewsRPC,
  updateListingAvailability, setConversationTimer, clearConversationTimer,
  createOutpostCheckoutUrl, fetchInterestedBuyers, setListingSaved, fetchUnconfirmedOutposts,
} from '../lib/db';
import { getUserLocation, distanceMiles, bearingAngle } from '../lib/location';
import { isStale, PROXIMITY_SNAPS, getTimerStatus } from '../lib/listingUtils';
import { registerForPushNotificationsAsync, savePushToken, sendPushNotification } from '../lib/pushNotifications';
import { startOutpostLocationMonitoring } from '../lib/outpostLocation';

const AppContext = createContext(null);

const DEFAULT_COLLECTIONS = [
  { id: 'saved-all', name: 'All Saved Items', emoji: '🔖', count: 2 },
  { id: 'saved-furn', name: 'Furniture', emoji: '🛋️', count: 0 },
  { id: 'saved-tech', name: 'Electronics', emoji: '📱', count: 0 },
];

const DEFAULT_ITEM_COLLECTIONS = {
  '2': ['saved-all'],
  '6': ['saved-all'],
};

// ── Feed ranking helpers ──────────────────────────────────────

/**
 * Sort and inject promoted/boosted listings into the feed.
 * Rules:
 *  - Sort ascending by distance (nearest first)
 *  - is_boosted cards are placed after standard listings at the same distance tier
 *  - is_promoted card injected at position 11+ (never first), max 1 per 10 standard cards
 *  - Feed caps: max 10% boosted, max 1 promoted per 10 standard cards
 */
function rankListings(listings) {
  const standard = listings.filter((l) => !l.is_boosted && !l.is_promoted);
  const boosted = listings.filter((l) => l.is_boosted && !l.is_promoted);
  const promoted = listings.filter((l) => l.is_promoted);

  // Sort each group by distance ascending
  const byDist = (a, b) => (a.distance || 0) - (b.distance || 0);
  standard.sort(byDist);
  boosted.sort(byDist);
  promoted.sort(byDist);

  // Cap boosted at 10% of total
  const maxBoosted = Math.max(1, Math.floor(listings.length * 0.1));
  const cappedBoosted = boosted.slice(0, maxBoosted);

  // Merge standard + boosted: boosted go after the standard card at same distance tier
  const merged = [];
  let bIdx = 0;
  for (let i = 0; i < standard.length; i++) {
    merged.push(standard[i]);
    // Insert boosted cards that are <= current standard card's distance
    while (bIdx < cappedBoosted.length && cappedBoosted[bIdx].distance <= standard[i].distance) {
      merged.push(cappedBoosted[bIdx]);
      bIdx++;
    }
  }
  // Append any remaining boosted after all standard cards
  while (bIdx < cappedBoosted.length) {
    merged.push(cappedBoosted[bIdx]);
    bIdx++;
  }

  // Inject promoted cards: max 1 per 10 standard cards, never at position 0
  // Inject at position 11 (index 10) if feed is large enough, else at the end
  if (promoted.length === 0) return merged;

  const result = [...merged];
  let promoInserted = 0;
  for (let p = 0; p < promoted.length; p++) {
    const insertPos = 10 + promoInserted * 11; // position 11, 22, etc.
    if (insertPos < result.length) {
      result.splice(insertPos, 0, promoted[p]);
    } else if (result.length > 0) {
      result.push(promoted[p]);
    }
    promoInserted++;
  }

  return result;
}

export function AppProvider({ children }) {
  // ── Auth ─────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState(null); // 'host' | 'guest'

  // ── Core state ───────────────────────────────────────────────
  const [isLive, setIsLive] = useState(true);
  const [proximityMiles, setProximityMiles] = useState(1);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [listings, setListings] = useState(mockListings);
  const [messages, setMessages] = useState(mockMessages);
  const messagesRef = useRef(mockMessages);
  const [user, setUser] = useState(currentUser);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // ── Collections ──────────────────────────────────────────────
  const [collections, setCollections] = useState(DEFAULT_COLLECTIONS);
  const [itemCollections, setItemCollections] = useState(DEFAULT_ITEM_COLLECTIONS);

  // ── Collections modal ────────────────────────────────────────
  const [collectionModal, setCollectionModal] = useState({ visible: false, item: null });
  const onNavigateRef = useRef(null);

  // ── Save toast ───────────────────────────────────────────────
  const [toast, setToast] = useState({ visible: false });
  const toastTimer = useRef(null);

  // ── Mark-as-sold modal ───────────────────────────────────────
  const [markSoldModal, setMarkSoldModal] = useState({ visible: false, item: null });

  // ── Rating prompt ────────────────────────────────────────────
  const [ratingPrompt, setRatingPrompt] = useState({ visible: false, item: null, buyerName: '', role: 'seller', ratedUserId: null });

  const [userLocation, setUserLocation] = useState(null);

  // ── Wishlist ─────────────────────────────────────────────────
  const [wishlist, setWishlist] = useState([]);

  // On mount: restore auth session + load real data + get location
  useEffect(() => {
    // Load real listings from Supabase (all users including guests see these)
    fetchListings()
      .then((rows) => {
        if (rows.length >= 10) {
          // Enough real content — drop mock data entirely
          setListings(rows);
        } else if (rows.length > 0) {
          // Merge real listings at the top, keep mock data to fill the feed
          const realIds = new Set(rows.map((r) => r.id));
          setListings([...rows, ...mockListings.filter((m) => !realIds.has(m.id))]);
        }
        // else keep mockListings as-is
      })
      .catch(() => {});

    // Restore Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserSession(session.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserSession(session.user);
      } else {
        setIsAuthenticated(false);
        setUserType(null);
        setBlockedUsers([]);
        setMessages(mockMessages);
      }
    });

    // Get location (non-blocking)
    getUserLocation().then((loc) => {
      if (loc) setUserLocation(loc);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const loadUserSession = useCallback(async (authUser) => {
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    // No profile row yet — user signed up but DB trigger / manual insert didn't run.
    // Create it now from auth metadata so the user is immediately functional.
    if (!profile) {
      const meta = authUser.user_metadata || {};
      await supabase.from('profiles').upsert({
        id: authUser.id,
        display_name: meta.display_name || authUser.email?.split('@')[0] || 'Proxie User',
        status: meta.status || '',
        bio: meta.bio || '',
      }, { onConflict: 'id' }).catch(() => {});

      // Re-fetch so the rest of the function has a real object
      const { data: created } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      profile = created;
    }

    if (profile) {
      setUserType('host');
      setUser((prev) => ({
        ...prev,
        id: profile.id,
        name: profile.display_name ?? prev.name,
        status: profile.status ?? prev.status,
        bio: profile.bio ?? '',
        building: profile.building ?? null,
        rating: profile.rating ?? prev.rating,
        sales: profile.sales ?? prev.sales,
        avatar_url: profile.avatar_url ?? null,
      }));
      setIsAuthenticated(true);

      // Register for push notifications — no-ops on web, returns null without
      // an EAS projectId or on a simulator. Fire-and-forget either way.
      registerForPushNotificationsAsync()
        .then((token) => { if (token) savePushToken(profile.id, token); })
        .catch(() => {});

      // If this seller already has an unconfirmed Outpost listing (e.g. they
      // killed the app and reopened it before arriving), resume monitoring.
      fetchUnconfirmedOutposts(profile.id)
        .then((outposts) => { if (outposts.length > 0) startOutpostLocationMonitoring().catch(() => {}); })
        .catch(() => {});

      // Load blocks
      const { data: blocks } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', profile.id);
      if (blocks) setBlockedUsers(blocks.map((b) => b.blocked_id));

      // Load real conversations
      fetchConversations(profile.id)
        .then((convos) => {
          if (convos.length > 0) {
            // timer_duration_ms isn't persisted (only expires_at + extended_count) —
            // for restored sessions with an active timer, assume the longest quick
            // preset (60 min) as the denominator so the color bar still reads sensibly.
            const withTimerDefaults = convos.map((c) =>
              c.timerExpiresAt && !c.timerDurationMs
                ? { ...c, timerDurationMs: 60 * 60000 }
                : c
            );
            setMessages(withTimerDefaults);
            messagesRef.current = withTimerDefaults;
          }
        })
        .catch(() => {});

      // Load wishlist from DB
      fetchWishlist(profile.id)
        .then((entries) => {
          if (entries.length > 0) setWishlist(entries.map((e) => ({
            id: e.id,
            categories: e.categories || [],
            maxPrice: e.max_price,
            radiusMiles: e.radius_miles,
            keywords: e.keywords || '',
            created_at: e.created_at,
          })));
        })
        .catch(() => {});
    }
  }, []);

  // ── "Still for sale?" — stale own listings (> 6h old) ───────
  const staleListing = listings.find(
    (l) => (l.seller?.id === user?.id || l.seller?.id === 'me') && !l.sold && !l.pickedUp && l.active && isStale(l.createdAt)
  );

  // ── Tab bar scroll-hide animation (1=visible, 0=hidden) ──────
  const tabBarAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);

  const onScreenScroll = useCallback((event) => {
    const y = event.nativeEvent.contentOffset.y;
    const dy = y - lastScrollY.current;
    lastScrollY.current = y;
    if (dy > 2 && y > 20) {
      tabBarAnim.setValue(0);
    } else if (dy < -2) {
      tabBarAnim.setValue(1);
    }
  }, [tabBarAnim]);

  // ── Filtered listings — sorted by distance, boosted/promoted injected ──
  const filteredListings = (() => {
    const filtered = listings.filter((l) => {
      // Compute real distance if we have GPS + listing coords
      let dist = l.distance;
      let angle = l.angle;
      if (userLocation && l.latitude != null && l.longitude != null) {
        dist = distanceMiles(userLocation.latitude, userLocation.longitude, l.latitude, l.longitude);
        angle = bearingAngle(userLocation.latitude, userLocation.longitude, l.latitude, l.longitude);
        // Attach real values so RadarView + cards show them
        l = { ...l, distance: dist, angle };
      }
      const withinRange = dist <= proximityMiles;
      const matchesCategory = selectedCategory === 'all' || l.category.toLowerCase() === selectedCategory;
      const notBlocked = !blockedUsers.includes(l.seller?.id);
      const notOwn = l.seller?.id !== user?.id && l.seller?.id !== 'me';
      return withinRange && matchesCategory && l.active && notBlocked && notOwn;
    });

    return rankListings(filtered);
  })();

  // Messages with blocked users' threads hidden
  const visibleMessages = messages.filter((m) => !blockedUsers.includes(m.with?.id));

  // ── Auth actions ─────────────────────────────────────────────

  const signIn = useCallback((type, userData = {}) => {
    setUserType(type);
    setUser((prev) => ({ ...prev, ...userData, userType: type }));
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(() => {
    supabase.auth.signOut().catch(() => {}); // fire and forget
    setIsAuthenticated(false);
    setUserType(null);
    setUser(currentUser);
    setBlockedUsers([]);
  }, []);

  // ── Block / unblock ──────────────────────────────────────────

  const blockUser = useCallback(async (userId) => {
    setBlockedUsers((prev) => prev.includes(userId) ? prev : [...prev, userId]);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('blocked_users').upsert({ blocker_id: session.user.id, blocked_id: userId });
    }
  }, []);

  const unblockUser = useCallback(async (userId) => {
    setBlockedUsers((prev) => prev.filter((id) => id !== userId));
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('blocked_users').delete().eq('blocker_id', session.user.id).eq('blocked_id', userId);
    }
  }, []);

  // ── Collections actions ──────────────────────────────────────

  const openCollectionModal = useCallback((item, onNavigate) => {
    onNavigateRef.current = onNavigate || null;
    setCollectionModal({ visible: true, item });
  }, []);

  const closeCollectionModal = useCallback(() => {
    setCollectionModal({ visible: false, item: null });
  }, []);

  const createCollection = useCallback((name, emoji = '📁') => {
    const id = 'col-' + Date.now();
    setCollections((prev) => [...prev, { id, name, emoji, count: 0 }]);
    return id;
  }, []);

  const saveToCollection = useCallback((itemId, collectionId) => {
    setListings((prev) =>
      prev.map((l) => (l.id === itemId ? { ...l, saved: true } : l))
    );
    setItemCollections((prev) => {
      const existing = prev[itemId] || [];
      if (existing.includes(collectionId)) return prev;
      return { ...prev, [itemId]: [...existing, collectionId] };
    });
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, count: c.count + 1 } : c
      )
    );
    closeCollectionModal();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true });
    toastTimer.current = setTimeout(() => setToast({ visible: false }), 3500);
  }, [closeCollectionModal]);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: false });
  }, []);

  const navigateFromToast = useCallback(() => {
    dismissToast();
    if (onNavigateRef.current) onNavigateRef.current();
  }, [dismissToast]);

  // ── Sold flow ────────────────────────────────────────────────

  const openMarkSoldModal = useCallback((item) => {
    // Collect everyone who has a thread about this listing
    const buyers = messagesRef.current
      .filter((t) => String(t.listingId) === String(item?.id))
      .map((t) => ({ id: t.with?.id, name: t.with?.name, threadId: t.id }))
      .filter((b) => b.id && b.name);
    setMarkSoldModal({ visible: true, item, buyers });
  }, []);

  const closeMarkSoldModal = useCallback(() => {
    setMarkSoldModal({ visible: false, item: null, buyers: [] });
  }, []);

  const confirmMarkSold = useCallback((itemId, buyer) => {
    // buyer: { id, name, threadId } | { name } for free-text fallback
    const buyerName = buyer?.name || '';
    let soldItem;
    setListings((prev) => {
      soldItem = prev.find((l) => l.id === itemId);
      return prev.map((l) =>
        l.id === itemId
          ? { ...l, sold: true, active: false, status: 'sold', buyerName: buyerName || null }
          : l
      );
    });
    setUser((prev) => ({ ...prev, sales: prev.sales + 1 }));
    setMarkSoldModal({ visible: false, item: null, buyers: [] });

    // After seller rates, write a pending rating for the buyer to pick up in ChatScreen
    if (buyer?.threadId) {
      AsyncStorage.setItem(
        `proxie_pending_buyer_rating_${buyer.threadId}`,
        JSON.stringify({ item: soldItem, sellerName: user?.name || 'the seller', sellerId: user?.id })
      ).catch(() => {});
    }

    setTimeout(() => {
      setRatingPrompt({ visible: true, item: soldItem, buyerName, role: 'seller', ratedUserId: buyer?.id || null });
    }, 600);
  }, [user?.name, user?.id]);

  const submitRating = useCallback((vote) => {
    if (vote === 'up') {
      setUser((prev) => ({
        ...prev,
        rating: Math.min(5.0, parseFloat((prev.rating + 0.1).toFixed(1))),
      }));
    }
    setRatingPrompt((prev) => {
      if (prev.ratedUserId) {
        sendPushNotification(
          prev.ratedUserId,
          'You got rated!',
          `${user.name || 'Someone'} left you a ${vote === 'up' ? 'positive' : 'negative'} rating for "${prev.item?.title}"`,
          { type: 'rating' }
        );
      }
      return { visible: false, item: null, buyerName: '', role: 'seller', ratedUserId: null };
    });
  }, [user.name]);

  const dismissRating = useCallback(() => {
    setRatingPrompt({ visible: false, item: null, buyerName: '', role: 'seller', ratedUserId: null });
  }, []);

  const openRatingPrompt = useCallback(({ item, buyerName, role, ratedUserId }) => {
    setRatingPrompt({ visible: true, item, buyerName, role, ratedUserId: ratedUserId || null });
  }, []);

  // ── Listings ─────────────────────────────────────────────────

  const toggleSaved = useCallback((id) => {
    let nowSaved = false;
    let isOutpost = false;
    setListings((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        nowSaved = !l.saved;
        isOutpost = !!l.is_outpost;
        return { ...l, saved: nowSaved };
      })
    );
    // Outpost saves double as a subscription to the "confirmed" push notification —
    // persist to listing_saves so the server-side trigger can find this buyer later.
    if (isOutpost && user.id && !String(id).startsWith('temp-')) {
      setListingSaved(user.id, id, nowSaved).catch(() => {});
    }
  }, [user.id]);

  const setListingAvailability = useCallback((listingId, { availabilityType, schedule }) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === listingId ? { ...l, availability_type: availabilityType, schedule: schedule || [] } : l
      )
    );
    if (!String(listingId).startsWith('temp-')) {
      updateListingAvailability(listingId, { availabilityType, schedule }).catch(() => {});
    }
  }, []);

  const addListing = useCallback(async (listing) => {
    const now = Date.now();
    const optimistic = {
      ...listing,
      id: `temp-${now}`,
      seller: { id: user.id || 'me', name: user.name, rating: user.rating, sales: user.sales, building: user.building },
      angle: Math.random() * 360,
      distance: 0,
      saved: false,
      active: true,
      createdAt: now,
      expires_at: now + 7 * 24 * 3600000,
      status: 'active',
      repost_of: null, repost_count: 0, impression_count: 0, tap_count: 0,
      is_boosted: false, boosted_radius_miles: null, is_promoted: false,
      seller_type: 'individual', store_id: null,
    };
    setListings((prev) => [optimistic, ...prev]);

    try {
      const saved = await insertListing(listing);
      setListings((prev) => prev.map((l) => l.id === optimistic.id ? { ...saved, seller: optimistic.seller, angle: optimistic.angle, distance: 0, saved: false } : l));
      return saved;
    } catch (e) {
      // Roll back optimistic listing and surface the error to the caller
      setListings((prev) => prev.filter((l) => l.id !== optimistic.id));
      throw e;
    }
  }, [user]);

  // ── Outpost ──────────────────────────────────────────────────

  // Opens Stripe Checkout in the system browser for the Outpost posting fee.
  // Never an in-app WebView — this is what keeps it an "external purchase
  // link" rather than something requiring Apple IAP on iOS.
  const payOutpostFee = useCallback(async (listingId) => {
    const url = await createOutpostCheckoutUrl(listingId);
    await Linking.openURL(url);
  }, []);

  // Call right after a seller successfully publishes an Outpost listing so
  // their device starts watching for arrival at the listing's coordinates.
  const beginOutpostMonitoring = useCallback(async () => {
    await startOutpostLocationMonitoring();
  }, []);

  const getInterestedBuyersForListing = useCallback(async (listingId) => {
    return fetchInterestedBuyers(listingId);
  }, []);

  const incrementViews = useCallback((id) => {
    setListings((prev) =>
      prev.map((l) => l.id === id ? { ...l, tap_count: (l.tap_count || 0) + 1 } : l)
    );
    incrementViewsRPC(id);
  }, []);

  const incrementImpressions = useCallback((id) => {
    setListings((prev) =>
      prev.map((l) => l.id === id ? { ...l, impression_count: (l.impression_count || 0) + 1 } : l)
    );
  }, []);

  const renewListing = useCallback((id) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, createdAt: Date.now(), postedAt: 'Just now', active: true } : l
      )
    );
  }, []);

  const pickUpListing = useCallback((id) => {
    setListings((prev) =>
      prev.map((l) => l.id === id ? { ...l, pickedUp: true, active: false } : l)
    );
  }, []);

  const repostListing = useCallback(async (id) => {
    const now = Date.now();
    // Optimistic update
    setListings((prev) => {
      const original = prev.find((l) => l.id === id);
      if (!original) return prev;
      const repost = {
        ...original,
        id: `repost-${now}`,
        createdAt: now,
        expires_at: now + 7 * 24 * 3600000,
        status: 'active',
        active: true,
        repost_of: original.id,
        repost_count: (original.repost_count || 0) + 1,
        impression_count: 0,
        tap_count: 0,
      };
      return prev.map((l) => l.id === id ? { ...l, status: 'expired', active: false } : l).concat(repost);
    });
    // Persist to DB
    try {
      await repostListingRPC(id);
      // Reload listings from DB to get the real new ID
      fetchListings().then((rows) => { if (rows.length > 0) setListings(rows); }).catch(() => {});
    } catch (e) {
      console.warn('[repostListing] DB failed:', e.message);
    }
  }, []);

  // ── Wishlist actions ─────────────────────────────────────────

  const addWishlistEntry = useCallback(async (entry) => {
    const optimistic = { id: `temp-${Date.now()}`, ...entry, created_at: Date.now() };
    setWishlist((prev) => [...prev, optimistic]);
    try {
      if (user.id) {
        const saved = await insertWishlistEntry(user.id, entry);
        setWishlist((prev) => prev.map((e) => e.id === optimistic.id ? { ...e, id: saved.id } : e));
      }
    } catch (e) {
      console.warn('[addWishlistEntry] DB failed:', e.message);
    }
  }, [user.id]);

  const removeWishlistEntry = useCallback(async (id) => {
    setWishlist((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteWishlistEntry(id);
    } catch (e) {
      console.warn('[removeWishlistEntry] DB failed:', e.message);
    }
  }, []);

  // ── Thread management ────────────────────────────────────────

  const markRead = useCallback((threadId) => {
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, unread: 0, markedUnread: false } : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  const markUnread = useCallback((threadId) => {
    setMessages((prev) => {
      const thread = prev.find((t) => t.id === threadId);
      const isCurrentlyUnread = thread?.markedUnread || thread?.unread > 0;
      const updated = prev.map((t) =>
        t.id === threadId
          ? { ...t, markedUnread: !isCurrentlyUnread, unread: isCurrentlyUnread ? 0 : 1 }
          : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  const pinThread = useCallback((threadId) => {
    setMessages((prev) => {
      const thread = prev.find((t) => t.id === threadId);
      if (!thread) return prev;
      // Enforce max 3 pins — caller must check pinnedCount and show toast if needed
      const pinnedCount = prev.filter((t) => t.pinned && t.id !== threadId).length;
      if (!thread.pinned && pinnedCount >= 3) return prev;
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, pinned: !t.pinned } : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  const muteThread = useCallback((threadId, duration) => {
    // duration in ms, or 'forever'
    const until = duration === 'forever' ? 'forever' : Date.now() + duration;
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, muted: until } : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  const unmuteThread = useCallback((threadId) => {
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, muted: null } : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  const archiveThread = useCallback((threadId) => {
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, archived: true, pinned: false } : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  // ── "In the area" chat timer ──────────────────────────────────
  // timer_expires_at / timer_extended_count persist in Supabase (conversations table)
  // so the timer survives app kills and is visible to both buyer + seller.

  const setThreadTimer = useCallback((threadId, durationMs, extendedCount) => {
    const expiresAt = new Date(Date.now() + durationMs).toISOString();
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId
          ? { ...t, timerExpiresAt: expiresAt, timerExtendedCount: extendedCount, timerDurationMs: durationMs }
          : t
      );
      messagesRef.current = updated;
      return updated;
    });
    const thread = messagesRef.current.find((t) => t.id === threadId);
    const convoId = thread?.dbConversationId || thread?.id;
    if (convoId) {
      setConversationTimer(convoId, expiresAt, extendedCount).catch(() => {});
    }
    return expiresAt;
  }, []);

  const startChatTimer = useCallback((threadId, minutes) => {
    setThreadTimer(threadId, minutes * 60000, 0);
  }, [setThreadTimer]);

  const extendChatTimer = useCallback((threadId, minutes = 30) => {
    const thread = messagesRef.current.find((t) => t.id === threadId);
    const newCount = (thread?.timerExtendedCount || 0) + 1;
    setThreadTimer(threadId, minutes * 60000, newCount);

    // In-app toast for when the seller has the app open right now...
    setToast({
      visible: true,
      message: `You're still in the area — extended by ${minutes} min`,
    });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ visible: false }), 3000);

    // ...and a real push notification for when they don't.
    if (thread?.with?.id) {
      sendPushNotification(
        thread.with.id,
        `${user.name || 'Buyer'} is still in the area`,
        `Extended by ${minutes} min for "${thread.listingTitle}"`,
        { threadId, type: 'timer_extend' }
      );
    }
  }, [setThreadTimer, user.name]);

  const clearThreadTimer = useCallback((threadId) => {
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, timerExpiresAt: null, timerExtendedCount: 0, timerDurationMs: null } : t
      );
      messagesRef.current = updated;
      return updated;
    });
    const thread = messagesRef.current.find((t) => t.id === threadId);
    const convoId = thread?.dbConversationId || thread?.id;
    if (convoId) {
      clearConversationTimer(convoId).catch(() => {});
    }
  }, []);

  const unarchiveThread = useCallback((threadId) => {
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, archived: false } : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  const deleteThread = useCallback((threadId) => {
    setMessages((prev) => {
      const updated = prev.filter((t) => t.id !== threadId);
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  const flagThread = useCallback((threadId) => {
    setMessages((prev) => {
      const updated = prev.map((t) =>
        t.id === threadId ? { ...t, flagged: !t.flagged } : t
      );
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  // ── Messages ─────────────────────────────────────────────────

  const sendMessage = useCallback(async (threadId, text, extra = {}) => {
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      from: user.id || 'me',
      text,
      type: extra.type || 'text',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...extra,
    };
    setMessages((prev) => {
      const updated = prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        return { ...thread, lastMessage: text, timestamp: 'Now', markedUnread: false, unread: 0, messages: [...(thread.messages || []), optimisticMsg] };
      });
      messagesRef.current = updated;
      return updated;
    });

    // Persist to DB
    try {
      const thread = messagesRef.current.find((t) => t.id === threadId);
      const convoId = thread?.dbConversationId || thread?.id;
      if (convoId && user.id) {
        await sendMessageDB(convoId, user.id, text, extra);
      }
      if (thread?.with?.id) {
        const baseBody = extra.type === 'offer' ? `Sent an offer: $${extra.offerPrice}` : text;
        // Only mention the "in the area" timer if one is actually running right now —
        // never reference it in the notification when no timer is active.
        const timerStatus = thread.timerExpiresAt
          ? getTimerStatus(thread.timerExpiresAt, thread.timerDurationMs || 60 * 60000)
          : null;
        const body = timerStatus && !timerStatus.expired
          ? `${baseBody}  ·  ⏱ ${timerStatus.label} left`
          : baseBody;

        sendPushNotification(
          thread.with.id,
          user.name || 'New message',
          body,
          { threadId, type: 'message' }
        );
      }
    } catch (e) {
      console.warn('[sendMessage] DB failed:', e.message);
    }
  }, [user.id, user.name]);

  const startConversation = useCallback(async (listing) => {
    const existing = messagesRef.current.find((m) => m.listingId === listing.id);
    if (existing) return existing;

    const newThread = {
      id: String(Date.now()),
      listingId: listing.id,
      listingTitle: listing.title,
      with: listing.seller,
      buyer_id: user.id || 'me',
      seller_id: listing.seller?.id,
      lastMessage: '',
      timestamp: 'Now',
      unread: 0,
      messages: [],
    };

    setMessages((prev) => {
      const updated = [newThread, ...prev];
      messagesRef.current = updated;
      return updated;
    });

    // Create in DB
    try {
      if (user.id && listing.seller?.id && listing.id && !listing.id.startsWith('temp')) {
        const dbConvo = await startConversationDB(listing.id, user.id, listing.seller.id);
        // Attach dbConversationId to the thread
        setMessages((prev) => {
          const updated = prev.map((t) => t.id === newThread.id ? { ...t, dbConversationId: dbConvo.id } : t);
          messagesRef.current = updated;
          return updated;
        });
        newThread.dbConversationId = dbConvo.id;
      }
    } catch (e) {
      console.warn('[startConversation] DB failed:', e.message);
    }

    return newThread;
  }, [user.id]);

  return (
    <AppContext.Provider
      value={{
        // Auth
        isAuthenticated,
        userType,
        signIn,
        signOut,
        // Live
        isLive, setIsLive,
        proximityMiles, setProximityMiles,
        listings, filteredListings,
        messages,
        user, setUser,
        selectedCategory, setSelectedCategory,
        // Collections
        collections, itemCollections,
        collectionModal,
        openCollectionModal,
        closeCollectionModal,
        createCollection,
        saveToCollection,
        // Save toast
        toast,
        navigateFromToast,
        dismissToast,
        // Sold flow
        staleListing,
        markSoldModal,
        openMarkSoldModal,
        closeMarkSoldModal,
        confirmMarkSold,
        ratingPrompt,
        submitRating,
        dismissRating,
        openRatingPrompt,
        // Tab bar
        tabBarAnim,
        onScreenScroll,
        // Listings
        toggleSaved,
        addListing,
        incrementViews,
        incrementImpressions,
        renewListing,
        pickUpListing,
        repostListing,
        setListingAvailability,
        // Outpost
        payOutpostFee,
        beginOutpostMonitoring,
        getInterestedBuyersForListing,
        // Messages
        sendMessage,
        startConversation,
        visibleMessages,
        // Block
        blockedUsers,
        blockUser,
        unblockUser,
        // Location
        userLocation,
        setUserLocation,
        // Thread management
        markRead,
        markUnread,
        pinThread,
        flagThread,
        muteThread,
        unmuteThread,
        archiveThread,
        unarchiveThread,
        deleteThread,
        // "In the area" chat timer
        startChatTimer,
        extendChatTimer,
        clearThreadTimer,
        // Wishlist
        wishlist,
        addWishlistEntry,
        removeWishlistEntry,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
