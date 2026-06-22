import { Platform } from 'react-native';
import { supabase } from './supabase';
import { distanceMeters } from './location';
import { confirmOutpostRPC, fetchUnconfirmedOutposts } from './db';

// Outpost GPS auto-verification — entirely native-only. There is no web
// equivalent of background geolocation, so every export here safely no-ops
// on web. This also cannot run in a simulator with mocked/no GPS movement,
// and on a real device it requires an EAS build (Expo Go does not support
// background location tasks reliably on current SDKs).

const TASK_NAME = 'OUTPOST_LOCATION_TASK';
const CONFIRM_RADIUS_METERS = 100;

let Location = null;
let TaskManager = null;
if (Platform.OS !== 'web') {
  Location = require('expo-location');
  TaskManager = require('expo-task-manager');

  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    const { locations } = data;
    const here = locations?.[0]?.coords;
    if (!here) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const outposts = await fetchUnconfirmedOutposts(session.user.id);
      const now = Date.now();

      for (const outpost of outposts) {
        if (outpost.latitude == null || outpost.longitude == null) continue;
        const scheduledAt = outpost.outpost_scheduled_at ? new Date(outpost.outpost_scheduled_at).getTime() : null;
        if (scheduledAt && now < scheduledAt) continue;

        const meters = distanceMeters(here.latitude, here.longitude, outpost.latitude, outpost.longitude);
        if (meters <= CONFIRM_RADIUS_METERS) {
          await confirmOutpostRPC(outpost.id).catch(() => {});
        }
      }
    } catch {
      // Best-effort — a failed background check just retries on the next location update.
    }
  });
}

// Call once a seller has at least one unconfirmed Outpost listing — e.g.
// right after publishing one, or on app launch if they already have one pending.
export async function startOutpostLocationMonitoring() {
  if (Platform.OS === 'web' || !Location || !TaskManager) return false;

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    // Foreground-only is still useful — the task just won't run while backgrounded.
    console.warn('[outpost] Background location denied — auto-confirm only works while the app is open.');
  }

  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (alreadyRunning) return true;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60000,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Proxie',
      notificationBody: 'Watching for your Outpost listing to go live nearby.',
    },
  });
  return true;
}

export async function stopOutpostLocationMonitoring() {
  if (Platform.OS === 'web' || !Location) return;
  const running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(TASK_NAME);
}
