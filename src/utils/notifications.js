// ─── Notifications Utility ───────────────────────────────────
// Notification sounds, browser notifications, service worker, and Web Push
// No external files needed — generated entirely in JavaScript

import { supabase } from '../supabaseClient';

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Plays a multi-tone notification chime that's loud and attention-grabbing.
 * Uses Web Audio API for crisp, high-quality sound at any volume.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();

    // Resume context if suspended (required after user interaction)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // ─── Master Gain (controls overall volume) ────────────────
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.8, now); // Loud!
    masterGain.connect(ctx.destination);

    // ─── Chime Pattern: 3-tone ascending ──────────────────────
    // Like Uber/Lyft notification sounds
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord)
    const durations = [0.15, 0.15, 0.3]; // short, short, long
    const delays = [0, 0.18, 0.36]; // staggered timing

    frequencies.forEach((freq, i) => {
      // Oscillator (tone generator)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delays[i]);

      // Envelope (attack-decay-release)
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now + delays[i]);
      gainNode.gain.linearRampToValueAtTime(0.6, now + delays[i] + 0.03); // Fast attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + delays[i] + durations[i] + 0.15); // Smooth decay

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(now + delays[i]);
      osc.stop(now + delays[i] + durations[i] + 0.2);
    });

    // ─── Second chime (repeat after short pause) ──────────────
    // Double-chime pattern for urgency
    const secondStart = 0.8;
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + secondStart + delays[i]);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now + secondStart + delays[i]);
      gainNode.gain.linearRampToValueAtTime(0.5, now + secondStart + delays[i] + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + secondStart + delays[i] + durations[i] + 0.15);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(now + secondStart + delays[i]);
      osc.stop(now + secondStart + delays[i] + durations[i] + 0.2);
    });

  } catch (err) {
    console.warn('Could not play notification sound:', err);
  }
}

/**
 * Requests browser notification permission.
 * Should be called after user interaction (button click).
 * Returns: 'granted', 'denied', or 'default'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

/**
 * Shows a browser-level OS notification.
 * Works even when the tab is not focused (but browser must be open).
 */
export function showBrowserNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  const notification = new Notification(title, {
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200, 100, 200], // Strong vibration pattern
    requireInteraction: true, // Don't auto-dismiss
    tag: 'dropme-ride-request', // Replace previous notification
    renotify: true, // Re-alert even if replacing
    ...options,
  });

  return notification;
}

/**
 * Registers the service worker for push notifications.
 * Returns the ServiceWorkerRegistration or null.
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    return null;
  }
}

// ─── Web Push Subscription ──────────────────────────────────

/**
 * Converts a URL-safe base64 string to a Uint8Array.
 * Required by the Push API for the applicationServerKey.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribes the current user to Web Push notifications.
 * 
 * Flow:
 * 1. Gets the service worker registration
 * 2. Creates a PushSubscription using the VAPID public key
 * 3. Saves the subscription endpoint + keys to Supabase
 * 
 * Call this after the user has granted notification permission.
 * 
 * @param {string} userId - The current user's UUID
 * @returns {PushSubscription|null} The push subscription, or null if failed
 */
export async function subscribeToPush(userId) {
  try {
    // 1. Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    if (!registration) {
      console.warn('No service worker registration found');
      return null;
    }

    // 2. Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 3. Create new push subscription
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not found in environment variables');
        return null;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required by Chrome — must show a notification for every push
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log('Push subscription created:', subscription.endpoint);
    } else {
      console.log('Existing push subscription found:', subscription.endpoint);
    }

    // 4. Extract the keys from the subscription
    const subscriptionJson = subscription.toJSON();
    const { endpoint } = subscriptionJson;
    const p256dh = subscriptionJson.keys?.p256dh;
    const auth = subscriptionJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      console.error('Push subscription missing required fields');
      return null;
    }

    // 5. Save to Supabase (upsert — update if endpoint already exists for this user)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,endpoint', // Update if same user + device
        }
      );

    if (error) {
      console.error('Failed to save push subscription:', error.message);
    } else {
      console.log('Push subscription saved to Supabase');
    }

    return subscription;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

/**
 * Unsubscribes from Web Push and removes the subscription from Supabase.
 * Call this on logout.
 * 
 * @param {string} userId - The current user's UUID
 */
export async function unsubscribeFromPush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;

      // Unsubscribe from browser
      await subscription.unsubscribe();

      // Remove from Supabase
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);

      console.log('Push subscription removed');
    }
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}
