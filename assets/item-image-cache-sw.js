'use strict';
const CACHE_NAME = 'albion-item-renders-v1';
const RENDER_ORIGIN = 'https://render.albiononline.com';
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async()=>{
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('albion-item-renders-') && key !== CACHE_NAME).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== RENDER_ORIGIN || !url.pathname.startsWith('/v1/item/') || request.method !== 'GET') return;
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      try { await cache.put(request, response.clone()); } catch {}
    }
    return response;
  })());
});
