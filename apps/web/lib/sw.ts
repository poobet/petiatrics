/// <reference lib="webworker" />
/**
 * Petiatrics Service Worker
 * Provides offline caching for pet profiles and recent health records.
 * Registered from apps/web/app/layout.tsx or via next-pwa / custom registration.
 */

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'petiatrics-v1';

// Assets to pre-cache on install (app shell)
const PRECACHE_URLS: string[] = [
  '/my',
  '/my/appointments',
  '/my/invoices',
];

// API routes to cache at runtime (network-first, fall back to cache)
const CACHEABLE_API_PATTERNS: RegExp[] = [
  /\/api\/v1\/owner\/pets/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isApiCacheable = CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url.pathname));

  if (isApiCacheable) {
    // Network-first for API data
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r ?? new Response('', { status: 503 }))),
    );
    return;
  }

  // Cache-first for app shell assets
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r ?? caches.match('/my')).then((r) => r!),
      ),
    );
    return;
  }
});

export {};
