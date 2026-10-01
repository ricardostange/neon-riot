'use strict';

// Bump this version whenever the cached game files change.
const CACHE_PREFIX = 'neon-riot-' + self.registration.scope;
const CACHE_NAME = CACHE_PREFIX + 'v7';
const ASSETS = ['./', './index.html', './style.css', './progression.js', './game.js', './pwa.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

// Allow an active run to finish before a new worker takes over.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    // Keep each game version's assets together; new deployments use a new cache.
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch (error) {
      if (event.request.mode === 'navigate') return cache.match('./index.html');
      throw error;
    }
  }));
});
