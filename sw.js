const CACHE_NAME = 'financas-pro-v7';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './main.js',
  './firebase-context.js',
  './app-utils.js',
  './app-dialogs.js',
  './app-modals.js',
  './app-forms.js',
  './app-navigation.js',
  './app-cards.js',
  './app-accounts.js',
  './app-admin.js',
  './app-reports.js',
  './app-auth.js',
  './app-ui-fixes.js',
  './icon.svg',
  './icon.png',
  './favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
