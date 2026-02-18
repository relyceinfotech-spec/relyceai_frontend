const CACHE_NAME = 'relyce-ai-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Add error handling
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.warn('Failed to cache static assets:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
            return null;
          }).filter(Boolean)
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategy with better error handling
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) return;

  // Skip service worker for API requests to reduce load
  if (url.pathname.startsWith('/api/') || url.pathname.includes('ws')) {
    return;
  }

  // Retry fetch helper with exponential backoff
  const fetchWithRetry = async (request, maxRetries = 3) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          return response;
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      // Wait before retrying (exponential backoff: 100ms, 200ms, 400ms)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }
    throw lastError;
  };

  // Strategy: Cache First for static assets with retry for images
  if (request.destination === 'script' ||
    request.destination === 'style' ||
    request.url.includes('.js') ||
    request.url.includes('.css')) {

    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              // Only cache successful responses
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                }).catch(() => {
                  // Ignore cache errors
                });
              return response;
            })
            .catch(() => {
              // Return cache even if offline
              return caches.match(request);
            });
        })
        .catch(() => {
          // Network fallback
          return fetch(request).catch(() => {
            // If both fail, we're offline
          });
        })
    );
    return;
  }

  // Strategy: Retry mechanism for images
  if (request.destination === 'image' ||
    request.url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)(\?.*)?$/i)) {

    event.respondWith(
      caches.match(request)
        .then(async (cachedResponse) => {
          // Try to get fresh image with retry
          try {
            const freshResponse = await fetchWithRetry(request, 3);
            // Cache the successful response
            if (freshResponse && freshResponse.status === 200) {
              const responseClone = freshResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                }).catch(() => { });
            }
            return freshResponse;
          } catch {
            // If fetch fails, return cached version
            if (cachedResponse) {
              return cachedResponse;
            }
            // No cache and fetch failed - return transparent pixel as fallback
            console.warn('Image failed to load after retries:', request.url);
            return new Response(
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
              {
                headers: { 'Content-Type': 'image/gif' },
                status: 200
              }
            );
          }
        })
    );
    return;
  }

  // Strategy: Network First for dynamic content with better error handling
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            }).catch(() => {
              // Ignore cache errors
            });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(request);
      })
  );
});

// Handle cache updates
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      })
      .catch((error) => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, error: error.message });
        }
      });
  }
});
