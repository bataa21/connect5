{
  "name": "Connect 5",
  "short_name": "Connect5",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#f5f7fa",
  "theme_color": "#4361ee",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
const CACHE_NAME = 'connect5-v2'; // bump version
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './move-sound.mp3',
  './win-sound.mp3',
  './draw-sound.mp3',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',

  // Icons & favicons
  './icons/icon-512.png',
  './icons/icon-384.png',
  './icons/icon-256.png',
  './icons/icon-192.png',
  './icons/icon-180.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './icons/favicon.ico',

  // iOS splash (portrait)
  './splash/iphone-1290x2796.png',
  './splash/iphone-1179x2556.png',
  './splash/iphone-1170x2532.png',
  './splash/iphone-1125x2436.png',
  './splash/iphone-1242x2688.png',
  './splash/iphone-828x1792.png',
  './splash/iphone-750x1334.png',
  './splash/iphone-640x1136.png',
  './splash/ipad-2048x2732.png',
  './splash/ipad-1668x2388.png',
  './splash/ipad-1620x2160.png',
  './splash/ipad-1536x2048.png'
];


self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Cache-first for same-origin; network with cache fallback for cross-origin
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        // update cache async
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
