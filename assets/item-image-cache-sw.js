'use strict';

// Cache durable des rendus Albion et des PNG du catalogue local.
// Une image déjà mise en cache est servie immédiatement entre les visites.
const CACHE_NAME = 'albion-images-permanent-v2';
const RENDER_ORIGIN = 'https://render.albiononline.com';

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isAlbionRender = url.origin === RENDER_ORIGIN && url.pathname.startsWith('/v1/item/');
  const isLocalAsset = url.origin === self.location.origin &&
    (url.pathname.includes('/assets/items/') ||
     (url.pathname.includes('/assets/data/') && url.pathname.endsWith('.json')));

  if (!isAlbionRender && !isLocalAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        try { await cache.put(request, response.clone()); } catch {}
      }
      return response;
    } catch (error) {
      const fallback = await cache.match(request);
      if (fallback) return fallback;
      throw error;
    }
  })());
});
