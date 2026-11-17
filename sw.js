// WOD → Balance Service Worker
const CACHE_NAME = 'wb-v3.4';
const SHARED_CACHE_NAME = 'shared-shots';

const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== SHARED_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Web Share Target: intercept POST to /share-target
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('shots');
          const cache = await caches.open(SHARED_CACHE_NAME);

          // Svuota cache precedente
          const keys = await cache.keys();
          for (const key of keys) {
            await cache.delete(key);
          }

          // Salva ogni file ricevuto
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileUrl = new URL(`shot-${i}`, self.registration.scope).href;
            await cache.put(
              fileUrl,
              new Response(file, {
                headers: {
                  'Content-Type': file.type || 'image/jpeg',
                  'X-Name': encodeURIComponent(file.name || `shot-${i}.jpg`)
                }
              })
            );
          }

          // Redirect 303 alla pagina con parametro shared
          const redirectUrl = new URL('./?shared=' + files.length, self.registration.scope).href;
          return Response.redirect(redirectUrl, 303);
        } catch (err) {
          return Response.redirect(new URL('./', self.registration.scope).href, 303);
        }
      })()
    );
    return;
  }

  // Non mettere in cache chiamate a origini diverse (ad es. AI providers)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Strategia: Network-First con fallback su Cache per avere sempre gli ultimi aggiornamenti
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline: fallback su cache
          return caches.match(event.request);
        })
    );
  }
});
