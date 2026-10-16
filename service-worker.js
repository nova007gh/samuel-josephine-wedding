
const CACHE = 'sj-wedding-v203-unified-tab-buttons';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './assets/seal-logo.png',
  './app-views.css',
  './app-polish.css',
  './guest-checkin.css',
  './app-forms.css',
  './app-social.css',
  './gifts.css',
  './competitions.css',
  './reception-program.css',
  './reception-program.js',
  './bridal-train.js',
  './bridal-train.css',
  './bridal-train-reference.css',
  './assets/bridal-gold-sprig.svg',
  './live-broadcast.css',
  './live-broadcast-reference.css',
  './live-broadcast.js',
  './broadcast-calendar.js',
  './competitions.js',
  './competition-notices.js',
  './assets/gift-floral.svg',
  './app.js',
  './app-data.js',
  './app-social.js',
  './admin-dashboard.js',
  './api-data.js',
  './manifest.webmanifest',
  './assets/welcome-bg.jpg',
  './assets/landing-invite.jpg',
  './assets/attend-bg.jpg',
  './assets/seal-pressed-320.png',
  './assets/seal-transparent-320.png',
  './assets/seal-embossed.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/photo-placeholder.svg',
  './assets/leaf-sprig.png',
  './assets/story/sam-childhood.jpg',
  './assets/story/jossy-childhood.jpg',
  './assets/story/sam-adult.jpg',
  './assets/story/jossy-adult.jpg',
  './assets/story/facetime.jpg',
  './assets/story/proposal.jpg',
  './assets/story/now.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache:'reload'})))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sj-wedding-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Leave every other origin to the browser
  if (url.origin !== self.location.origin) return;
  // API calls and uploaded media must never be cached
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Network-first for HTML, JS, and CSS so users always get the latest code
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname === '/' ||
      url.pathname === './'){
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(response => {
        if (response.ok){
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {}));
        }
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(event.request, {ignoreSearch:true});
        if (cached) return cached;
        if (event.request.mode === 'navigate') return await cache.match('./index.html') || Response.error();
        return new Response('Asset unavailable offline', {status:503,headers:{'Content-Type':'text/plain'}});
      })
    );
    return;
  }

  // Cache-first for images, fonts, and other static assets
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok){
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {}));
      }
      return response;
    }))
  );
});

/* ---------- push notifications ---------- */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sam & Jossy', {
      body: data.body || 'Something new was shared',
      icon: data.icon || '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) if ('focus' in client) return client.focus();
      return clients.openWindow(url);
    })
  );
});
