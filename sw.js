const CACHE_NAME = 'instareport-v3-7';

// Static app-shell assets only. NOTE: cdn.tailwindcss.com removed — index.html
// v3.7+ embeds a compiled static CSS bundle directly, no external Tailwind
// script is loaded anymore, so caching it here would just be dead weight
// (and previously could have blocked install entirely if that CDN was ever
// briefly unreachable, since cache.addAll() fails all-or-nothing).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install Event: caches the app shell. Each asset is cached individually
// (not via cache.addAll) so one failing/slow third-party resource doesn't
// block the whole install.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching app shell (v3.7)');
      return Promise.all(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => console.warn('Service Worker: failed to cache', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate Event: deletes old caches (important for version updates)
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

// Requests to the Apps Script backend (SCRIPT_URL in index.html) — this is
// live, constantly-changing data: submissions, date-range searches, PDFs.
// FIX (v3.7): these must always go to the network. Previously everything
// was cache-first, which meant the supervisor dashboard could keep showing
// stale submission data indefinitely once a response got cached. If the
// network request fails, let it fail naturally so index.html's own
// timeout/error handling can inform the user, rather than silently serving
// old cached JSON as if it were current.
function isBackendRequest(url) {
  return url.hostname === 'script.google.com';
}

// Fetch Event
self.addEventListener('fetch', (e) => {
  // Never intercept POST (report submissions / uploads to Apps Script)
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (isBackendRequest(url)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // App shell / static assets: stale-while-revalidate — serve the cached
  // version instantly if we have one (fast, works offline), while updating
  // the cache in the background so the next load has the freshest shell.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request)
        .then(networkRes => {
          if (networkRes && networkRes.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, networkRes.clone()));
          }
          return networkRes;
        })
        .catch(() => cached); // offline and nothing cached yet -> this will reject, same as before

      return cached || networkFetch;
    })
  );
});
