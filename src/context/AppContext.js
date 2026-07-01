import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Animated, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentUser } from '../data/mockData';
import { supabase } from '../lib/supabase';
import {
  fetchListings, fetchNearbyListings, fetchMyListings, fetchConversations, fetchMessages,
  startConversationDB, sendMessageDB, markMessagesRead, subscribeToMessages,
  fetchWishlist, insertWishlistEntry, deleteWishlistEntry,
  insertListing, updateListingStatus, repostListingRPC, incrementViewsRPC,
  updateListingAvailability, updateListingLocation, setConversationTimer, clearConversationTimer,
  createOutpostCheckoutUrl, fetchInterestedBuyers, setListingSaved, fetchUnconfirmedOutposts,
  writeRating, markFirstSellerReply, setPhoneVerified,
} from '../lib/db';
import { getUserLocation, distanceMiles, bearingAngle } from '../lib/location';
import { isStale, PROXIMITY_SNAPS, getTimerStatus } from '../lib/listingUtils';
import { registerForPushNotificationsAsync, savePushToken, sendPushNotification } from '../lib/pushNotifications';
import { startOutpostLocationMonitoring } from '../lib/outpostLocation';

const AppContext = createContext(null);


// ── Feed ranking helpers ──────────────────────────────────────

/**
 * Sort and inject boosted listings into the feed.
 * Rules:
 *  - Sort ascending by distance (nearest first)
 *  - is_boosted cards are placed after standard listings at the same distance tier
 *  - Feed cap: max 10% boosted
 */
function rankListings(listings) {
  const standard = listings.filter((l) => !l.is_boosted);
  const boosted = listings.filter((l) => l.is_boosted);

  // Sort each group by distance ascending
  const byDist = (a, b) => (a.distance || 0) - (b.distance || 0);
  standard.sort(byDist);
  boosted.sort(byDist);

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

  return merged;
}

export function AppProvider({ children }) {
  // ── Auth ─────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState(null); // 'host' | 'guest'
  const signingOutRef = useRef(false);

  // ── Core state ───────────────────────────────────────────────
  const [isLive, setIsLive] = useState(true);
  const [proximityMiles, setProximityMiles] = useState(1);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [user, setUser] = useState(currentUser);
  const [selectedCategory, setSelectedCategory] = useState('all');


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
      .then((rows) => { if (rows.length > 0) setListings(rows); })
      .catch(() => {});

    // Restore Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserSession(session.user);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED and USER_UPDATED don't need a full profile reload
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      // While signing out, ignore any event that would re-authenticate
      if (signingOutRef.current && session?.user) return;
      if (session?.user) {
        loadUserSession(session.user);
      } else {
        signingOutRef.current = false; // sign-out confirmed by Supabase
        setIsAuthenticated(false);
        setUserType(null);
        setBlockedUsers([]);
        setMessages([]);
      }
    });

    // Get location (non-blocking)
    getUserLocation().then((loc) => {
      if (loc) setUserLocation(loc);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Server-side radius search (PostGIS, via nearby_listings() RPC) — re-fetches
  // from the database whenever location, the radius slider, or category change,
  // instead of every client downloading the whole listings table and filtering
  // it in JS. The initial fetchListings() above stays as a fallback for the
  // brief window before GPS resolves (or for guests who never grant location).
  // Debounced so dragging the slider doesn't fire a request per pixel.
  const nearbyDebounceRef = useRef(null);
  useEffect(() => {
    if (!userLocation) return;
    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);
    nearbyDebounceRef.current = setTimeout(() => {
      fetchNearbyListings({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radiusMiles: proximityMiles,
        category: selectedCategory,
        // user.id defaults to the mock placeholder 'me' for guests — that's not
        // a real uuid, and the RPC param is typed uuid, so only pass it through
        // once the user is actually signed in.
        excludeSellerId: isAuthenticated ? user?.id : null,
      })
        .then((rows) => {
          if (rows.length === 0) return;
          setListings((prev) => {
            const byId = new Map(prev.map((l) => [l.id, l]));
            rows.forEach((r) => byId.set(r.id, { ...byId.get(r.id), ...r }));
            return Array.from(byId.values());
          });
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(nearbyDebounceRef.current);
  }, [userLocation?.latitude, userLocation?.longitude, proximityMiles, selectedCategory, isAuthenticated, user?.id]);

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

      // Mark phone verified if this session was authenticated via OTP phone login.
      if (authUser.phone && !profile.phone_verified) {
        setPhoneVerified(profile.id).catch(() => {});
      }

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
    // Compute real distance first (map), then test against it (filter) — doing
    // both in one filter() callback silently discarded the recomputed values,
    // since reassigning the callback's local `l` doesn't change what filter()
    // returns. Cards were rendering whatever stale distance/angle the listing
    // already had.
    const withDistance = listings.map((l) => {
      let dist = typeof l.distance === 'number' ? l.distance : null;
      let angle = l.angle;
      if (userLocation && l.latitude != null && l.longitude != null) {
        dist = distanceMiles(userLocation.latitude, userLocation.longitude, l.latitude, l.longitude);
        angle = bearingAngle(userLocation.latitude, userLocation.longitude, l.latitude, l.longitude);
      }
      return { ...l, distance: dist, angle };
    });

    const filtered = withDistance.filter((l) => {
      // Unknown distance (no GPS yet, or listing has no coordinates) must
      // exclude the listing, not pass it — `null <= proximityMiles` is true
      // in JS (null coerces to 0), which used to let every coordinate-less
      // listing through regardless of how tight the radius slider was set.
      const withinRange = l.distance != null && l.distance <= proximityMiles;
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
    signingOutRef.current = true; // block any auth event from re-authenticating
    // Clear state first so UI updates immediately regardless of network
    setIsAuthenticated(false);
    setUserType(null);
    setUser(currentUser);
    setBlockedUsers([]);
    setMessages([]);
    setWishlist([]);
    setMarkSoldModal({ visible: false, item: null });
    setRatingPrompt({ visible: false, item: null, buyerName: '', role: 'seller', ratedUserId: null });
    setToast({ visible: false });
    // Invalidate the Supabase session server-side in the background
    supabase.auth.signOut().catch(() => {});
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


  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: false });
  }, []);

  const navigateFromToast = useCallback(() => {
    dismissToast();
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

  const submitRating = useCallback((vote, note = '') => {
    setRatingPrompt((prev) => {
      const { ratedUserId, item, role } = prev;
      if (ratedUserId) {
        // Persist to DB — fire and forget so the sheet closes instantly
        writeRating({
          listingId: item?.id || null,
          ratedId: ratedUserId,
          vote,
          note,
          role: role || 'seller',
        }).catch(() => {});

        sendPushNotification(
          ratedUserId,
          'You got rated!',
          `${user.name || 'Someone'} left you a ${vote === 'up' ? 'positive' : 'negative'} rating for "${item?.title}"`,
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

  // Lets a seller backfill location on their own listing that was published
  // without it (location was denied, or failed silently, at creation time).
  // Captures the seller's CURRENT device location — they need to be at/near
  // the actual sale spot when they do this for the distance to mean anything.
  const addListingLocation = useCallback(async (listingId) => {
    const loc = await getUserLocation();
    if (!loc) throw new Error('Location permission is required to set this.');
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, latitude: loc.latitude, longitude: loc.longitude } : l))
    );
    await updateListingLocation(listingId, loc);
    return loc;
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
      expires_at: now + 30 * 24 * 3600000,
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

  const relistListing = useCallback(async (item) => {
    return addListing({
      title: item.title,
      price: item.price,
      description: item.description,
      condition: item.condition || 'Good',
      category: item.category,
      photos: item.photos || [],
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address || null,
      availabilityType: item.availabilityType || 'anytime',
      schedule: item.schedule || [],
      isOutpost: false,
    });
  }, [addListing]);

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
    incrementViewsRPC(id).catch(() => {});
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
        expires_at: now + 30 * 24 * 3600000,
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

  // Conversations loaded via fetchConversations always start with
  // messages: [] — full history is fetched separately, per-thread, when
  // ChatScreen actually opens (this is that fetch's landing spot). Without
  // this, reopening a thread after a refresh showed it as empty.
  const loadThreadMessages = useCallback((threadId, dbMessages) => {
    setMessages((prev) => {
      const updated = prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        // Preserve any optimistic message sent in this session before the
        // fetch resolved, so it doesn't flash away once the DB list lands.
        const dbIds = new Set(dbMessages.map((m) => m.id));
        const localOnly = (thread.messages || []).filter(
          (m) => !dbIds.has(m.id) && String(m.id).startsWith('temp-')
        );
        return { ...thread, messages: [...dbMessages, ...localOnly] };
      });
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  // Appends a message delivered via the realtime subscription — lets the
  // other party's messages show up live instead of only after a refresh.
  const addIncomingMessage = useCallback((threadId, msg) => {
    setMessages((prev) => {
      const updated = prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        if ((thread.messages || []).some((m) => m.id === msg.id)) return thread;
        return {
          ...thread,
          messages: [...(thread.messages || []), msg],
          lastMessage: msg.text,
          timestamp: 'Now',
        };
      });
      messagesRef.current = updated;
      return updated;
    });
  }, []);

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
        // Track first seller reply for response-time badge
        if (thread?.seller_id === user.id) {
          markFirstSellerReply(convoId, user.id).catch(() => {});
        }
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

  // Always loads message history before handing the thread back — relying
  // solely on ChatScreen's own mount-time fetch left a window where
  // "Message Host" on a listing you'd already messaged about handed back a
  // thread that looked brand new (messages: []) until that fetch resolved,
  // which read as "my previous conversation is gone."
  const hydrateThreadMessages = useCallback(async (threadLocalId, convoId) => {
    if (!convoId) return null;
    try {
      const dbMessages = await fetchMessages(convoId);
      let hydrated = null;
      setMessages((prev) => {
        const updated = prev.map((t) => {
          if (t.id !== threadLocalId) return t;
          hydrated = { ...t, messages: dbMessages };
          return hydrated;
        });
        messagesRef.current = updated;
        return updated;
      });
      return hydrated;
    } catch {
      return null;
    }
  }, []);

  const startConversation = useCallback(async (listing) => {
    const existing = messagesRef.current.find((m) => m.listingId === listing.id);
    if (existing) {
      const convoId = existing.dbConversationId || existing.id;
      const hydrated = await hydrateThreadMessages(existing.id, convoId);
      return hydrated || existing;
    }

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

    // Create in DB — this upserts, so if this buyer/seller/listing combo
    // already has a conversation row server-side (e.g. created in a past
    // session), we get that existing row's id back, not a fresh one.
    try {
      if (user.id && listing.seller?.id && listing.id && !listing.id.startsWith('temp')) {
        const dbConvo = await startConversationDB(listing.id, user.id, listing.seller.id);
        setMessages((prev) => {
          const updated = prev.map((t) => t.id === newThread.id ? { ...t, dbConversationId: dbConvo.id } : t);
          messagesRef.current = updated;
          return updated;
        });
        newThread.dbConversationId = dbConvo.id;

        // Pull any history that conversation already had — covers the case
        // where the upsert just resurfaced a pre-existing conversation.
        const hydrated = await hydrateThreadMessages(newThread.id, dbConvo.id);
        if (hydrated) return hydrated;
      }
    } catch (e) {
      console.warn('[startConversation] DB failed:', e.message);
    }

    return newThread;
  }, [user.id, hydrateThreadMessages]);

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
        relistListing,
        incrementViews,
        incrementImpressions,
        renewListing,
        pickUpListing,
        repostListing,
        setListingAvailability,
        addListingLocation,
        // Outpost
        payOutpostFee,
        beginOutpostMonitoring,
        getInterestedBuyersForListing,
        // Messages
        sendMessage,
        startConversation,
        loadThreadMessages,
        addIncomingMessage,
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
