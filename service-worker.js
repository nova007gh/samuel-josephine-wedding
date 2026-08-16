
const CACHE = 'sj-wedding-v21-welcome-flow';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app-views.css',
  './app-forms.css',
  './app.js',
  './app-data.js',
  './manifest.webmanifest',
  './assets/official-landing-page.jpg',
  './assets/official-landing-4k.webp',
  './assets/seal-pressed-320.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/couple-home.jpg',
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
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
