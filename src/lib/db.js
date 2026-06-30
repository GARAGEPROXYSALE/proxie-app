import { supabase } from './supabase';
import { timeAgoShort } from './listingUtils';

const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// ── Listings ─────────────────────────────────────────────────

export async function fetchListings() {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!seller_id (
        id, display_name, avatar_url, rating, sales, status, building, seller_type, store_id,
        phone_verified, avg_response_hours, ratings_count
      ),
      store:stores (id, name, logo_url, rating, sales)
    `)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(normalizeListingFromDB);
}

// Server-side radius search via the nearby_listings() RPC (PostGIS ST_DWithin
// under the hood) — the database filters by distance and joins seller/store
// in one query, instead of every client downloading the entire listings
// table and filtering it in JS. Requires migration_nearby_listings.sql to
// have been run. Falls back to the old whole-table fetchListings() when the
// caller has no location yet (nothing to filter by).
export async function fetchNearbyListings({ latitude, longitude, radiusMiles, category, excludeSellerId }) {
  const { data, error } = await supabase.rpc('nearby_listings', {
    p_lat: latitude,
    p_lon: longitude,
    p_radius_miles: radiusMiles,
    p_category: category && category !== 'all' ? category : null,
    p_exclude_seller_id: excludeSellerId || null,
  });

  if (error) throw error;

  return (data || []).map(normalizeNearbyRow);
}

export async function fetchMyListings(userId) {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!seller_id (
        id, display_name, avatar_url, rating, sales, status, building, seller_type, store_id
      )
    `)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeListingFromDB);
}

export async function fetchStorefrontListings(storeId) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeListingFromDB);
}

export async function insertListing(listing) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  // seller_id always comes from the verified session — never from the client payload
  // is_boosted, is_promoted, seller_type (store) are set server-side or by admins only
  const payload = {
    seller_id: session.user.id,
    title: listing.title,
    price: listing.price,
    description: listing.description,
    category: listing.category,
    photos: listing.photos || [],
    latitude: listing.latitude,
    longitude: listing.longitude,
    address: listing.address,
    availability_type: listing.availabilityType || 'anytime',
    schedule: listing.schedule || [],
  };

  // Try with condition first; if the column doesn't exist in this DB, retry without it
  let result = await supabase.from('listings').insert({ ...payload, condition: listing.condition || 'Good' }).select().single();
  if (result.error?.message?.includes('condition')) {
    result = await supabase.from('listings').insert(payload).select().single();
  }
  if (result.error) throw result.error;
  return normalizeListingFromDB(result.data);
}

export async function updateListingStatus(listingId, status) {
  const { error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId);
  if (error) throw error;
}

export async function updateListingAvailability(listingId, { availabilityType, schedule }) {
  const { error } = await supabase
    .from('listings')
    .update({ availability_type: availabilityType, schedule: schedule || [] })
    .eq('id', listingId);
  if (error) throw error;
}

// Backfills location on a listing that was published before location was
// required (or whose GPS capture failed silently at the time) — without
// this, the listing can never be distance-filtered or placed on the map.
export async function updateListingLocation(listingId, { latitude, longitude }) {
  const { error } = await supabase
    .from('listings')
    .update({ latitude, longitude })
    .eq('id', listingId);
  if (error) throw error;
}

export async function repostListingRPC(listingId) {
  const { data, error } = await supabase.rpc('repost_listing', { original_id: listingId });
  if (error) throw error;
  return data; // new listing id
}

// ── Outpost ──────────────────────────────────────────────────

export async function fetchOutpostFee() {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'outpost_fee_usd')
    .single();
  if (error) throw error;
  return Number(data?.value ?? 5.99);
}

// Opens a Stripe Checkout Session via the create-outpost-checkout Edge
// Function and returns its hosted URL. The caller is responsible for
// opening it in the system browser (Linking.openURL) — never an in-app
// WebView — to qualify as an external purchase link.
export async function createOutpostCheckoutUrl(listingId) {
  const { data, error } = await supabase.functions.invoke('create-outpost-checkout', {
    body: { listing_id: listingId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url;
}

// Called by the seller's own device when their background/foreground location
// task detects them within range of their Outpost listing's coordinates.
export async function confirmOutpostRPC(listingId) {
  const { error } = await supabase.rpc('confirm_outpost', { listing_id: listingId });
  if (error) throw error;
}

export async function fetchInterestedBuyers(listingId) {
  const { data, error } = await supabase.rpc('get_interested_buyers', { p_listing_id: listingId });
  if (error) throw error;
  return (data || []).map((row) => ({
    buyerId: row.buyer_id,
    name: row.buyer_name || 'Buyer',
    avatarUrl: row.buyer_avatar_url || null,
    conversationId: row.conversation_id,
    firstMessageAt: row.first_message_at,
  }));
}

// One call for every listing on the seller's My Garage screen instead of
// one RPC per card. Returns { [listingId]: count }.
export async function fetchInterestedCounts(listingIds) {
  if (!listingIds?.length) return {};
  const { data, error } = await supabase.rpc('get_interested_counts', { p_listing_ids: listingIds });
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => { map[row.listing_id] = Number(row.interested_count); });
  return map;
}

// Toggling save on an Outpost listing both bookmarks it and subscribes the
// buyer to the "outpost confirmed" push notification.
export async function setListingSaved(userId, listingId, saved) {
  if (saved) {
    const { error } = await supabase
      .from('listing_saves')
      .upsert({ user_id: userId, listing_id: listingId }, { onConflict: 'user_id,listing_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('listing_saves')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId);
    if (error) throw error;
  }
}

// Outpost listings the current user (as seller) has posted that haven't
// confirmed yet — used to decide whether to start background location monitoring.
export async function fetchUnconfirmedOutposts(userId) {
  const { data, error } = await supabase
    .from('listings')
    .select('id, latitude, longitude, outpost_scheduled_at')
    .eq('seller_id', userId)
    .eq('is_outpost', true)
    .eq('outpost_confirmed', false)
    .eq('status', 'active');
  if (error) throw error;
  return data || [];
}

// Signed-in users: counted once per listing (record_view dedupes via
// listing_views). Guests have no stable identity to dedupe against, so they
// fall back to the old unconditional increment.
export async function incrementViewsRPC(listingId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.rpc('record_view', { p_listing_id: listingId }).catch(() => {});
  } else {
    await supabase.rpc('increment_views', { listing_id: listingId }).catch(() => {});
  }
}

// ── Photo upload ──────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImageBlob(blob, maxBytes) {
  const type = blob.type || '';
  // HEIC files often report as application/octet-stream on some devices — allow them
  if (!ALLOWED_IMAGE_TYPES.has(type) && !type.startsWith('image/')) {
    throw new Error(`File type not allowed: ${type || 'unknown'}. Use JPEG, PNG, or WebP.`);
  }
  if (blob.size > maxBytes) {
    const mb = (maxBytes / 1024 / 1024).toFixed(0);
    throw new Error(`File too large. Maximum size is ${mb} MB.`);
  }
}

// asset can be a plain URI string or an ImagePicker asset { uri, file, mimeType, ... }
// On web, expo-image-picker provides asset.file (a File object) — use it directly to
// avoid blob-URL fetch failures in some browsers. Fall back to fetch(uri) on native.
export async function uploadListingPhoto(asset, userId) {
  let blob;
  const uri = typeof asset === 'string' ? asset : asset.uri;
  const file = typeof asset === 'object' ? asset.file : null;

  if (file) {
    blob = file;
  } else {
    const response = await fetch(uri);
    blob = await response.blob();
  }

  validateImageBlob(blob, MAX_PHOTO_BYTES);

  const ext = (blob.type || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg') || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('listing-photos')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('listing-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(uri, userId) {
  const response = await fetch(uri);
  const blob = await response.blob();

  validateImageBlob(blob, MAX_AVATAR_BYTES);

  const ext = (blob.type || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg') || 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// ── Saved listings ────────────────────────────────────────────

export async function fetchSavedListings(userId) {
  const { data, error } = await supabase
    .from('saved_listings')
    .select('listing_id, collection_id, listings(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function saveListing(userId, listingId, collectionId = null) {
  const { error } = await supabase
    .from('saved_listings')
    .upsert({ user_id: userId, listing_id: listingId, collection_id: collectionId });
  if (error) throw error;
}

export async function unsaveListing(userId, listingId) {
  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);
  if (error) throw error;
}

// ── Collections ───────────────────────────────────────────────

export async function fetchCollections(userId) {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function insertCollection(userId, name, emoji = '📁') {
  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: userId, name, emoji })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Conversations & Messages ──────────────────────────────────

export async function fetchConversations(userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      buyer:profiles!buyer_id (id, display_name, avatar_url, rating),
      seller:profiles!seller_id (id, display_name, avatar_url, rating),
      listing:listings!listing_id (id, title, photos, price)
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((c) => normalizeConversation(c, userId));
}

export async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at');
  if (error) throw error;
  return (data || []).map(normalizeMessage);
}

export async function startConversationDB(listingId, buyerId, sellerId) {
  // Upsert — safe to call multiple times
  const { data, error } = await supabase
    .from('conversations')
    .upsert(
      { listing_id: listingId, buyer_id: buyerId, seller_id: sellerId },
      { onConflict: 'listing_id,buyer_id,seller_id', ignoreDuplicates: false }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendMessageDB(conversationId, senderId, body, extra = {}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body,
      type: extra.type || 'text',
      offer_price: extra.offerPrice || null,
      meetup_date: extra.meetupDate || null,
      meetup_time: extra.meetupTime || null,
      meetup_location: extra.meetupLocation || null,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeMessage(data);
}

export async function markMessagesRead(conversationId, userId) {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
}

// Subscribe to new messages in a conversation
export function subscribeToMessages(conversationId, callback) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => callback(normalizeMessage(payload.new))
    )
    .subscribe();
}

// ── "In the area" chat timer ────────────────────────────────────

export async function setConversationTimer(conversationId, expiresAt, extendedCount = 0) {
  const { error } = await supabase
    .from('conversations')
    .update({ timer_expires_at: expiresAt, timer_extended_count: extendedCount })
    .eq('id', conversationId);
  if (error) throw error;
}

export async function clearConversationTimer(conversationId) {
  const { error } = await supabase
    .from('conversations')
    .update({ timer_expires_at: null, timer_extended_count: 0 })
    .eq('id', conversationId);
  if (error) throw error;
}

// Subscribe to timer changes on a conversation row (so both buyer + seller see live updates)
export function subscribeToConversationTimer(conversationId, callback) {
  return supabase
    .channel(`conversation-timer:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

// ── Wishlist ──────────────────────────────────────────────────

export async function fetchWishlist(userId) {
  const { data, error } = await supabase
    .from('wishlist_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function insertWishlistEntry(userId, entry) {
  const { data, error } = await supabase
    .from('wishlist_entries')
    .insert({
      user_id: userId,
      categories: entry.categories || [],
      max_price: entry.maxPrice || null,
      radius_miles: entry.radiusMiles || 5,
      keywords: entry.keywords || '',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWishlistEntry(id) {
  const { error } = await supabase.from('wishlist_entries').delete().eq('id', id);
  if (error) throw error;
}

// ── Profile ───────────────────────────────────────────────────

// Allowlist prevents mass-assignment of privileged fields (rating, sales, seller_type, store_id)
const PROFILE_SAFE_FIELDS = new Set(['display_name', 'avatar_url', 'bio', 'building', 'status']);

export async function updateProfile(userId, updates) {
  const safe = {};
  for (const [k, v] of Object.entries(updates)) {
    if (PROFILE_SAFE_FIELDS.has(k)) safe[k] = v;
  }
  if (Object.keys(safe).length === 0) return;
  const { error } = await supabase.from('profiles').update(safe).eq('id', userId);
  if (error) throw error;
}

// ── Normalizers (DB row → app shape) ─────────────────────────

function normalizeListingFromDB(row) {
  if (!row) return null;
  const seller = row.seller || {};
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price),
    description: row.description,
    category: row.category,
    photos: row.photos || [],
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    status: row.status,
    active: row.status === 'active',
    sold: row.status === 'sold',
    pickedUp: row.status === 'picked_up',
    createdAt: new Date(row.created_at).getTime(),
    postedAt: timeAgoShort(new Date(row.created_at).getTime()),
    expires_at: new Date(row.expires_at).getTime(),
    is_boosted: row.is_boosted,
    boosted_radius_miles: row.boosted_radius_miles,
    is_promoted: row.is_promoted,
    repost_of: row.repost_of,
    repost_count: row.repost_count || 0,
    impression_count: row.impression_count || 0,
    tap_count: row.tap_count || 0,
    views: row.tap_count || 0,
    seller_type: row.seller_type || 'individual',
    store_id: row.store_id,
    store: row.store || null,
    availability_type: row.availability_type || 'anytime',
    schedule: row.schedule || [],
    is_outpost: row.is_outpost || false,
    outpost_scheduled_at: row.outpost_scheduled_at ? new Date(row.outpost_scheduled_at).getTime() : null,
    outpost_confirmed: row.outpost_confirmed || false,
    outpost_confirmed_at: row.outpost_confirmed_at ? new Date(row.outpost_confirmed_at).getTime() : null,
    outpost_fee_paid: row.outpost_fee_paid || false,
    outpost_fee_amount: row.outpost_fee_amount != null ? Number(row.outpost_fee_amount) : null,
    seller: {
      id: seller.id || row.seller_id,
      name: seller.display_name || 'Seller',
      avatar_url: seller.avatar_url || null,
      rating: seller.rating ?? 5.0,
      sales: seller.sales ?? 0,
      status: seller.status || '',
      building: seller.building || null,
      seller_type: seller.seller_type || 'individual',
      store_id: seller.store_id || null,
      phone_verified: seller.phone_verified || false,
      avg_response_hours: seller.avg_response_hours ?? null,
      ratings_count: seller.ratings_count ?? 0,
    },
    // Placeholders populated by feed filter (proximity calc)
    distance: row.distance ?? null,
    angle: row.angle ?? Math.random() * 360,
    saved: false,
  };
}

// Same shape as normalizeListingFromDB, but reading the flat seller_*/store_*
// columns nearby_listings() returns (a joined RPC result can't nest objects
// the way a PostgREST embedded select can) — and trusting the distance the
// database already computed instead of recalculating it client-side.
function normalizeNearbyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price),
    description: row.description,
    category: row.category,
    photos: row.photos || [],
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    status: row.status,
    active: row.status === 'active',
    sold: row.status === 'sold',
    pickedUp: row.status === 'picked_up',
    createdAt: new Date(row.created_at).getTime(),
    postedAt: timeAgoShort(new Date(row.created_at).getTime()),
    expires_at: new Date(row.expires_at).getTime(),
    is_boosted: row.is_boosted,
    boosted_radius_miles: row.boosted_radius_miles,
    is_promoted: row.is_promoted,
    repost_of: row.repost_of,
    repost_count: row.repost_count || 0,
    impression_count: row.impression_count || 0,
    tap_count: row.tap_count || 0,
    views: row.tap_count || 0,
    seller_type: row.seller_type || 'individual',
    store_id: row.store_id,
    store: row.store_name
      ? { id: row.store_id, name: row.store_name, logo_url: row.store_logo_url, rating: row.store_rating, sales: row.store_sales }
      : null,
    availability_type: row.availability_type || 'anytime',
    schedule: row.schedule || [],
    is_outpost: row.is_outpost || false,
    outpost_scheduled_at: row.outpost_scheduled_at ? new Date(row.outpost_scheduled_at).getTime() : null,
    outpost_confirmed: row.outpost_confirmed || false,
    outpost_confirmed_at: row.outpost_confirmed_at ? new Date(row.outpost_confirmed_at).getTime() : null,
    outpost_fee_paid: row.outpost_fee_paid || false,
    outpost_fee_amount: row.outpost_fee_amount != null ? Number(row.outpost_fee_amount) : null,
    seller: {
      id: row.seller_id,
      name: row.seller_display_name || 'Seller',
      avatar_url: row.seller_avatar_url || null,
      rating: row.seller_rating ?? 5.0,
      sales: row.seller_sales ?? 0,
      status: row.seller_status || '',
      building: row.seller_building || null,
      seller_type: row.seller_seller_type || 'individual',
      store_id: row.seller_store_id || null,
      phone_verified: row.seller_phone_verified || false,
      avg_response_hours: row.seller_avg_response_hours ?? null,
      ratings_count: row.seller_ratings_count ?? 0,
    },
    distance: row.distance_miles != null ? Number(row.distance_miles) : null,
    angle: null, // bearing is computed client-side once we have userLocation
    saved: false,
  };
}

function normalizeConversation(row, myId) {
  const isMe = (id) => id === myId;
  const other = isMe(row.buyer_id) ? row.seller : row.buyer;
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing?.title || '',
    listingPhoto: row.listing?.photos?.[0] || null,
    listing: row.listing,
    with: {
      id: other?.id,
      name: other?.display_name || 'User',
      avatar_url: other?.avatar_url || null,
      rating: other?.rating ?? 5.0,
    },
    buyer_id: row.buyer_id,
    seller_id: row.seller_id,
    lastMessage: row.last_message_preview || '',
    timestamp: row.last_message_at ? formatTime(row.last_message_at) : '',
    unread: 0,
    pinned: isMe(row.buyer_id) ? row.buyer_pinned : row.seller_pinned,
    archived: isMe(row.buyer_id) ? row.buyer_archived : row.seller_archived,
    timerExpiresAt: row.timer_expires_at || null,
    timerExtendedCount: row.timer_extended_count || 0,
    messages: [],
  };
}

function normalizeMessage(row) {
  return {
    id: row.id,
    from: row.sender_id,
    text: row.body,
    type: row.type || 'text',
    offerPrice: row.offer_price,
    meetupDate: row.meetup_date,
    meetupTime: row.meetup_time,
    meetupLocation: row.meetup_location,
    time: formatTime(row.created_at),
    created_at: row.created_at,
    read_at: row.read_at,
  };
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Trust signals ────────────────────────────────────────────

export async function writeRating({ listingId, ratedId, vote, note, role }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const { error } = await supabase.from('ratings').insert({
    listing_id: listingId || null,
    rater_id: session.user.id,
    rated_id: ratedId,
    vote,
    note: note || '',
    role,
  });
  // 23505 = unique violation — user already rated this listing, skip silently
  if (error && error.code !== '23505') throw error;
  await supabase.rpc('refresh_profile_rating', { p_user_id: ratedId }).catch(() => {});
}

export async function markFirstSellerReply(conversationId, sellerId) {
  const { error } = await supabase
    .from('conversations')
    .update({ first_seller_reply_at: new Date().toISOString() })
    .eq('id', conversationId)
    .is('first_seller_reply_at', null);
  if (error) return;

  // Recompute rolling average response time for this seller
  const { data } = await supabase
    .from('conversations')
    .select('first_seller_reply_at, created_at')
    .eq('seller_id', sellerId)
    .not('first_seller_reply_at', 'is', null);
  if (!data?.length) return;

  const avgHours = data.reduce((sum, c) => {
    return sum + (new Date(c.first_seller_reply_at) - new Date(c.created_at)) / 3600000;
  }, 0) / data.length;

  await supabase
    .from('profiles')
    .update({ avg_response_hours: Math.round(avgHours * 10) / 10 })
    .eq('id', sellerId)
    .catch(() => {});
}

export async function setPhoneVerified(userId) {
  await supabase.from('profiles').update({ phone_verified: true }).eq('id', userId).catch(() => {});
}
