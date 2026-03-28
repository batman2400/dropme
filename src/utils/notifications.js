// ─── Notification Sound Generator ────────────────────────────
// Creates a loud, attention-grabbing notification chime using Web Audio API
// No external files needed — generated entirely in JavaScript

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
