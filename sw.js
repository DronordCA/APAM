importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
// ============================================================
//  APAM Service Worker – v1
// ============================================================
const CACHE     = 'apam-v2';
const CACHE_NET = 'apam-net-v2';

const SHELL = [
  '/mon-compte.html',
  '/connexion-membres-password.html',
  '/assets/images/apam-logo2.png',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700;1,900&family=Jost:wght@300;400;500;600;700&display=swap',
];

// Install — cache le shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate — nettoie les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== CACHE_NET).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Message — permet à la page de forcer la mise à jour
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch — network first pour l'API, cache first pour les assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API Google Apps Script → network only
  if (url.hostname.includes('script.google.com')) return;

  // APIs météo → network only
  if (url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('aviationweather.gov') ||
      url.hostname.includes('corsproxy.io')) return;

  // Google Fonts → cache first
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // Pages HTML → network first, fallback cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Assets → cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }))
  );
});
