const CACHE_NAME = 'instareport-v2-1';

// Assets to cache for offline use
const assets = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install Event: Caches the assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching new assets');
      return cache.addAll(assets);
    })
  );
  self.skipWaiting();
});

// Activate Event: Deletes old caches (important for version updates)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('Service Worker: Clearing old cache', k);
          return caches.delete(k);
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event: Serves cached content when offline
self.addEventListener('fetch', (e) => {
  // Only intercept GET requests (don't interfere with POST uploads to GAS)
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});
