// NEMESYS PWA Service Worker (sw.js)
const CACHE_NAME = 'nemesys-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.png',
  '/apple-touch-icon.png',
  '/favicon.svg'
];

// Install Event: Cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA Cache addAll non-critical blip:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-First for APIs, Cache-First for Static Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass non-GET requests or backend API calls
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for HTML navigation requests when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Push Event: Handle Background Web Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'NEMESYS Alarm System', body: 'Terjadi pembaruan status jaringan.' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message || 'Pemberitahuan baru dari NOC NEMESYS.',
    icon: '/pwa-icon.png',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: { url: data.link_url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'NEMESYS Notification', options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
