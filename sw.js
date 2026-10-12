'use strict';

// Increment the game version in every PR; keep index.html's footer in sync.
const CACHE_PREFIX = 'neon-riot-' + self.registration.scope;
const CACHE_NAME = CACHE_PREFIX + 'v1.0.6';
const ASSETS = ['./', './index.html', './style.css', './i18n.js', './progression.js', './gamepad.js', './game.js', './pwa.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  // Keep a complete offline snapshot; bypass Chrome's HTTP cache during installation too.
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(ASSETS.map(path => new Request(new URL(path, self.registration.scope), { cache: 'no-store' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
  // Do not reload clients: an active run must not be interrupted by an update.
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    let response, failure;
    try {
      // Online reloads always request fresh files, bypassing the browser's HTTP cache.
      response = await fetch(event.request, { cache: 'no-store' });
      if (response.ok) return response;
    } catch (error) { failure = error; }
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true }) ||
      (event.request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    // Never overwrite the offline snapshot with a partial deployment or an error page.
    if (cached) return cached;
    if (response) return response;
    throw failure;
  })());
});
