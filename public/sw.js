// ─── dropme. Service Worker ──────────────────────────────────
// Handles push notifications and background sync

const CACHE_NAME = 'dropme-v1';

// Install event — cache shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push notification received
self.addEventListener('push', (event) => {
  let data = {
    title: 'dropme.',
    body: 'You have a new notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'dropme-notification',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'dropme-notification',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/dashboard',
      rideId: data.rideId,
    },
    actions: data.rideId
      ? [
          { action: 'view', title: 'View Request' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.rideId
    ? `/active-ride/${event.notification.data.rideId}`
    : event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // Otherwise, open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});
