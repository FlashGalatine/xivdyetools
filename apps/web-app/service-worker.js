// XIV Dye Tools Service Worker
// Provides offline support and intelligent caching for all tools

const CACHE_NAME = 'xiv-dye-tools-v3.0.0';
const RUNTIME_CACHE = 'xiv-dye-tools-runtime';
const IMAGE_CACHE = 'xiv-dye-tools-images';

// Files to cache on installation (core application files)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/colormatcher_stable.html',
  '/colorexplorer_stable.html',
  '/coloraccessibility_stable.html',
  '/dyecomparison_stable.html',
  '/dye-mixer_stable.html',
  '/assets/css/shared-styles.css',
  '/assets/js/shared-components.js',
  '/assets/json/colors_xiv.json',
  '/assets/json/data-centers.json',
  '/assets/json/worlds.json',
  '/components/nav.html',
  '/components/nav-experimental.html',
  '/components/footer.html',
  '/components/mobile-bottom-nav.html',
  '/components/market-prices.html',
  '/manifest.json'
];

// Install event: Cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('XIV Dye Tools: Precaching essential files');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('XIV Dye Tools: Precache failed', error);
        // Don't throw - service worker should still activate
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old versions of our caches
            if (cacheName.startsWith('xiv-dye-tools-') && cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== IMAGE_CACHE) {
              console.log('XIV Dye Tools: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event: Implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Strategy 1: HTML files - Network first, fallback to cache
  if (request.destination === 'document' || request.url.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache when offline
          return caches.match(request)
            .then((response) => {
              if (response) {
                return response;
              }
              // If no cache and offline, return offline page
              return new Response('Offline - page not available in cache', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
        })
    );
    return;
  }

  // Strategy 2: CSS/JS files - Cache first, network fallback
  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              if (!response || response.status !== 200) {
                return response;
              }
              const responseToCache = response.clone();
              caches.open(RUNTIME_CACHE)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
              return response;
            })
            .catch(() => {
              // Return empty response if offline and not cached
              return new Response('', { status: 503 });
            });
        })
    );
    return;
  }

  // Strategy 3: JSON files (color database, etc) - Cache first with network update
  if (request.url.includes('/assets/json/')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                const responseToCache = response.clone();
                caches.open(RUNTIME_CACHE)
                  .then((cache) => {
                    cache.put(request, responseToCache);
                  });
              }
              return response;
            });

          // Return cache if available, otherwise wait for fetch
          return response || fetchPromise;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Strategy 4: Images - Cache with network update
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE)
        .then((cache) => {
          return cache.match(request)
            .then((response) => {
              const fetchPromise = fetch(request)
                .then((response) => {
                  if (response.ok) {
                    cache.put(request, response.clone());
                  }
                  return response;
                })
                .catch(() => {
                  // Return placeholder if offline and not cached
                  return response || new Response('', { status: 404 });
                });

              return response || fetchPromise;
            });
        })
    );
    return;
  }

  // Strategy 5: API/other requests - Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response.ok && (request.method === 'GET')) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Try cache as fallback
        return caches.match(request)
          .catch(() => {
            // Return offline response
            return new Response('Offline - request failed', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Handle background sync for future use
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-prices') {
    event.waitUntil(
      // Future: Implement price sync when back online
      Promise.resolve()
    );
  }
});

// Message handler for cache clearing
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('xiv-dye-tools-')) {
              return caches.delete(cacheName);
            }
          })
        );
      });
  }
});

console.log('XIV Dye Tools Service Worker loaded');
