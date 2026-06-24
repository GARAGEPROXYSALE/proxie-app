// ── Outpost ────────────────────────────────────────────────────

/** "Sat, Jun 21 · 9:00 AM" style label for an Outpost's scheduled arrival. */
export function formatOutpostSchedule(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const datePart = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

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

/**
 * Same time-ago math as recencyLabel, without the "Listed" prefix — for
 * compact spots (meta chips, card footers) that already pair this with a
 * clock icon, so "Listed" would just be redundant.
 */
export function timeAgoShort(createdAt) {
  if (!createdAt) return '';
  const ms = Date.now() - createdAt;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(ms / (24 * 3600000));
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return '7 days ago';
}

// ── Seller availability schedule ──────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseHM(hm) {
  const [h, m] = (hm || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatMinutes(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

function formatDuration(ms) {
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Computes a listing's current availability state against its schedule.
 * Returns { state: 'available' | 'opens' | 'closed', label, nextChangeAt }
 *
 * Listings with availability_type 'anytime' (or no schedule) are always available.
 * Scheduled listings are checked against `schedule`: an array of
 * { days: [0-6], start: 'HH:MM', end: 'HH:MM' } windows in local time.
 */
export function getAvailabilityStatus(listing, now = new Date()) {
  if (!listing || listing.availability_type !== 'scheduled' || !listing.schedule?.length) {
    return { state: 'available', label: 'Available now' };
  }

  const schedule = listing.schedule;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();

  // Currently inside any window?
  const activeWindow = schedule.find((w) => w.days.includes(today) && nowMin >= parseHM(w.start) && nowMin < parseHM(w.end));
  if (activeWindow) {
    return { state: 'available', label: 'Available now' };
  }

  // Find the next upcoming window within the next 7 days
  for (let offset = 0; offset < 8; offset++) {
    const checkDay = (today + offset) % 7;
    const dayWindows = schedule.filter((w) => w.days.includes(checkDay));
    for (const w of dayWindows.sort((a, b) => parseHM(a.start) - parseHM(b.start))) {
      const startMin = parseHM(w.start);
      if (offset === 0 && startMin <= nowMin) continue; // already passed today
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + offset);
      nextDate.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

      // "Likely" on purpose — this is the seller's stated schedule, not proof
      // they're unreachable outside it. Avoid language that reads as certain
      // unavailability when they may well still answer a message.
      if (offset === 0) {
        const msUntil = nextDate - now;
        return { state: 'opens', label: `Likely available in ${formatDuration(msUntil)}`, nextChangeAt: nextDate };
      }
      const dayLabel = offset === 1 ? 'tomorrow' : DAY_NAMES[checkDay];
      return { state: 'closed', label: `Likely available ${dayLabel} ${formatMinutes(startMin)}`, nextChangeAt: nextDate };
    }
  }

  return { state: 'closed', label: 'Closed', nextChangeAt: null };
}

// ── Chat "in the area" timer ────────────────────────────────────

/**
 * Returns { percent, color, label, expired } for a chat timer.
 * percent is remaining time as a fraction of the original duration (0-1).
 */
export function getTimerStatus(timerExpiresAt, totalDurationMs) {
  if (!timerExpiresAt) return null;
  const expiresAt = new Date(timerExpiresAt).getTime();
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    return { percent: 0, color: 'danger', label: 'Timer expired', expired: true };
  }
  const percent = totalDurationMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalDurationMs)) : 0;
  let color = 'success';
  if (percent <= 0.2) color = 'danger';
  else if (percent <= 0.5) color = 'warning';
  return { percent, color, label: formatDuration(remainingMs), expired: false };
}
