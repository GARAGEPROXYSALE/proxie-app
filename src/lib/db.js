import { supabase } from './supabase';

const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// ── Listings ─────────────────────────────────────────────────

export async function fetchListings() {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!seller_id (
        id, display_name, avatar_url, rating, sales, status, building, seller_type, store_id
      ),
      store:stores (id, name, logo_url, rating, sales)
    `)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(normalizeListingFromDB);
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

export async function repostListingRPC(listingId) {
  const { data, error } = await supabase.rpc('repost_listing', { original_id: listingId });
  if (error) throw error;
  return data; // new listing id
}

export async function incrementViewsRPC(listingId) {
  await supabase.rpc('increment_views', { listing_id: listingId }).catch(() => {});
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
    expires_at: new Date(row.expires_at).getTime(),
    is_boosted: row.is_boosted,
    boosted_radius_miles: row.boosted_radius_miles,
    is_promoted: row.is_promoted,
    repost_of: row.repost_of,
    repost_count: row.repost_count || 0,
    impression_count: row.impression_count || 0,
    tap_count: row.tap_count || 0,
    seller_type: row.seller_type || 'individual',
    store_id: row.store_id,
    store: row.store || null,
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
    },
    // Placeholders populated by feed filter (proximity calc)
    distance: row.distance ?? null,
    angle: row.angle ?? Math.random() * 360,
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
