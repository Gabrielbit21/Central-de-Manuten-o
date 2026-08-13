const SW_VERSION = '1.6.1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

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
