/* APAM service worker — v2
   ⚠️ Ce fichier sert AUSSI de worker OneSignal (serviceWorkerPath:"sw.js").
   La ligne importScripts ci-dessous gère les notifications push — NE PAS la retirer.
   HTML/navigation : réseau d'abord (toujours la dernière version quand il y a du réseau,
   repli sur le cache hors-ligne). Autres ressources : cache d'abord + maj en arrière-plan. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");

const CACHE = 'apam-cache-v3';

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('message', function(e){
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function(keys){ keys.forEach(function(k){ caches.delete(k); }); });
  }
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  /* On ne met en cache que le même origine ; on laisse passer l'API (Apps Script),
     Firebase/Firestore, les tuiles, OneSignal, etc. directement au réseau. */
  if (url.origin !== self.location.origin) return;

  /* HTML / navigation → RÉSEAU D'ABORD : toujours la dernière version en ligne,
     repli sur le cache si hors-ligne. */
  var isDoc = req.mode === 'navigate' ||
              (req.headers.get('accept') || '').indexOf('text/html') !== -1 ||
              url.pathname.endsWith('.html');
  if (isDoc) {
    e.respondWith(
      fetch(req).then(function(res){
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return caches.open(CACHE).then(function(cache){ return cache.match(req); });
      })
    );
    return;
  }

  /* Autres ressources (images, polices, JS) → cache d'abord + maj arrière-plan. */
  e.respondWith(
    caches.open(CACHE).then(function(cache){
      return cache.match(req).then(function(cached){
        var network = fetch(req).then(function(res){
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function(){ return cached; });
        return cached || network;
      });
    })
  );
});
