// service-worker.js
const CACHE_NAME = 'connect5-v5'; // bump when assets change
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './move-sound.mp3',
  './win-sound.mp3',
  './draw-sound.mp3',

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

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Cache-first for same-origin; network-first with cache-fallback for cross-origin
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
  } else {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
  }
});



