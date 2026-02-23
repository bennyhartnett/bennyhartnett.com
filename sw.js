// Service Worker for SWU Calculator PWA
// Version must be updated when deploying new code to bust cache
const CACHE_VERSION = 'v101';
const CACHE_NAME = `swu-calculator-${CACHE_VERSION}`;

// Files to cache for offline use
// Note: Only include actual files, not SPA routes (like /chat which redirects)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/pages/home.html',
  '/nuclear',
  '/nuclear.html',
  '/nuclear/nuclear.js',
  '/nuclear/nuclear-math.js',
  '/assets/logos/centrus_icon.png',
  '/config/manifest.webmanifest',
  '/pages/chat.html',
  '/pages/meet.html',
  '/pages/tools.html',
  '/pages/clipboard.html',
  '/pages/search.html',
  '/assets/benny%20clear.png',
  // CSS files
  '/css/main.css',
  '/css/scrollbar.css',
  '/css/components.css',
  '/css/animations.css',
  // JS modules
  '/js/spa-router.js',
  '/js/meta-manager.js',
  '/js/analytics.js',
  '/js/wave-background.js',
  '/js/smooth-cursor.js',
  // Config files
  '/config/llms.txt',
  '/config/llms-full.txt',
  '/config/humans.txt'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Force the waiting service worker to become active
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('swu-calculator-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first strategy for JS/HTML/CSS, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Cache-first for known CDN resources (fonts, libraries) for faster repeat loads
  const cachedCdnOrigins = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net'
  ];
  if (url.origin !== self.location.origin) {
    if (cachedCdnOrigins.some(origin => url.hostname === origin)) {
      event.respondWith(
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          });
        })
      );
      return;
    }
    return;
  }

  // Network-first for HTML, JS, and CSS files (ensures fresh code)
  if (url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname === '/nuclear') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the fresh response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-first for other assets (images, etc.)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
