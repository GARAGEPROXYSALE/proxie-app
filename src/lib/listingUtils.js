// ── Proximity snap points & labels ──────────────────────────────

export const PROXIMITY_SNAPS = [0.095, 0.189, 0.25, 0.5, 1, 2, 3, 5];

export function proximityLabel(miles) {
  if (miles <= 0.095) return '500 ft';
  if (miles <= 0.189) return '1,000 ft';
  if (miles <= 0.25)  return '¼ mi';
  if (miles <= 0.5)   return '½ mi';
  if (miles <= 1)     return '1 mi';
  if (miles <= 2)     return '2 mi';
  if (miles <= 3)     return '3 mi';
  return '5 mi';
}

/** Returns the next snap value above `miles`, or null if already at max. */
export function nextProximitySnap(miles) {
  const idx = PROXIMITY_SNAPS.findIndex((s) => Math.abs(s - miles) < 0.001);
  if (idx === -1 || idx >= PROXIMITY_SNAPS.length - 1) return null;
  return PROXIMITY_SNAPS[idx + 1];
}

// ── Listing age badges ───────────────────────────────────────────

/**
 * Returns { label, warn } for a listing's age badge.
 * warn=true when >= 5 days old (approaching 7-day auto-expiry).
 */
export function getAgeBadge(createdAt) {
  if (!createdAt) return null;
  const ms = Date.now() - createdAt;
  const hours = ms / 3600000;
  if (hours < 1) return { label: 'Just now', warn: false };
  if (hours < 24) return { label: `${Math.floor(hours)}h ago`, warn: false };
  const days = Math.floor(hours / 24);
  if (days < 5) return { label: `${days}d ago`, warn: false };
  return { label: `${days}d ago`, warn: true };
}

/** True if listing is older than 6 hours (show "still for sale?" prompt). */
export function isStale(createdAt) {
  if (!createdAt) return false;
  return Date.now() - createdAt > 6 * 3600000;
}

/** True if listing is older than 7 days (auto-expiry threshold). */
export function isExpired(createdAt) {
  if (!createdAt) return false;
  return Date.now() - createdAt > 7 * 24 * 3600000;
}

/**
 * Returns a human-readable recency label for display on cards.
 * - Under 1 min: "Listed just now"
 * - Under 1 hour: "Listed N minutes ago"
 * - 1–23 hours: "Listed N hours ago"
 * - 1–6 days: "Listed N days ago"
 * - 7+ days: "Listed 7 days ago"
 */
export function recencyLabel(createdAt) {
  if (!createdAt) return '';
  const ms = Date.now() - createdAt;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'Listed just now';
  if (minutes < 60) return `Listed ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `Listed ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(ms / (24 * 3600000));
  if (days < 7) return `Listed ${days} day${days === 1 ? '' : 's'} ago`;
  return 'Listed 7 days ago';
}
