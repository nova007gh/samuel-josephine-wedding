
const CACHE = 'sj-wedding-v56-clean-welcome-admin';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app-views.css',
  './app-forms.css',
  './app-social.css',
  './app.js',
  './app-data.js',
  './app-social.js',
  './firebase-config.js',
  './firebase-data.js',
  './manifest.webmanifest',
  './assets/official-landing-page.jpg',
  './assets/seal-burst.jpg',
  './assets/seal-pressed-320.png',
  './assets/seal-transparent-320.png',
  './assets/seal-embossed.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/couple-home.jpg',
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
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Network-first for HTML so users always get the latest UI
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === './'){
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (CSS, JS, images, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
