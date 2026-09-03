const SW_VERSION = '1.9.3-media-v4.2';
const STATIC_CACHE = `central-static-${SW_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.json',
  './app.js',
  './assets/js/media-core.js',
  './assets/css/media-core.css',
  './vendor/supabase-js-2.57.4.min.js',
  './vendor/xlsx-0.20.3.full.min.js',
  './assets/icons/icon-64.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-256.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('central-static-') && key !== STATIC_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação e código funcional crítico usam network-first.
  // Assim uma atualização de app.js/media-core não fica presa ao shell antigo.
  const criticalCode = [
    '/app.js',
    '/assets/js/media-core.js',
    '/assets/css/media-core.css',
  ].some(path => url.pathname.endsWith(path));
  if (request.mode === 'navigate' || url.pathname.endsWith('/version.json') || criticalCode) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  // Bibliotecas locais, manifest e ícones: cache-first, com atualização em segundo plano.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      fetch(request).then(async response => {
        if (response && response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, response.clone());
        }
      }).catch(() => {});
      return cached;
    }
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Central de Manutenção';
  const options = {
    body: data.body || 'Há uma nova atualização na Central de Manutenção.',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    tag: data.tag || `central-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || './',
      notificationId: data.notificationId || null,
      reportId: data.reportId || null,
      eventType: data.eventType || null,
      version: SW_VERSION,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url || './';
  const targetUrl = new URL(rawUrl, self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      try {
        const current = new URL(client.url);
        const target = new URL(targetUrl);
        if (current.origin === target.origin && current.pathname.startsWith(new URL(self.registration.scope).pathname)) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      } catch { /* ignore */ }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
