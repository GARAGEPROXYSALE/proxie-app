import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Push notifications are a native-only capability — Expo's push service has no
// web equivalent. Every export here safely no-ops on web instead of throwing,
// so the app keeps working in the browser preview while still being fully
// wired up for real iOS/Android builds.

let Notifications = null;
let Device = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Requests permission and returns an Expo push token, or null if unavailable
// (web, simulator, permission denied, or no EAS project configured yet).
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web' || !Notifications || !Device) return null;

  if (!Device.isDevice) {
    console.warn('[push] Simulators/emulators cannot receive real push tokens.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId in app.json — run `eas init` to enable push tokens.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return token;
  } catch (e) {
    console.warn('[push] Could not get push token:', e.message);
    return null;
  }
}

export async function savePushToken(userId, token) {
  if (!userId || !token) return;
  await supabase
    .from('profiles')
    .update({ push_token: token, push_token_updated_at: new Date().toISOString() })
    .eq('id', userId)
    .catch(() => {});
}

// Fire-and-forget: looks up the recipient's push token and asks the
// send-push Edge Function to deliver it. Never throws — a failed push
// should never break the action that triggered it (sending a message, etc).
export async function sendPushNotification(recipientUserId, title, body, data = {}) {
  if (!recipientUserId) return;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', recipientUserId)
      .single();

    if (!profile?.push_token) return;

    await supabase.functions.invoke('send-push', {
      body: { to: profile.push_token, title, body, data },
    });
  } catch (e) {
    console.warn('[push] Failed to send notification:', e.message);
  }
}

// Listener for taps on a delivered notification — wire this up once in App.js
// with access to the navigation ref to deep-link into the right chat/screen.
export function addNotificationResponseListener(callback) {
  if (Platform.OS === 'web' || !Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}
