// Service Worker Básico para permitir a instalação do PWA
const CACHE_NAME = 'financas-pro-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                './index.html',
                './manifest.json',
                './icon.png',
                './favicon.png'
            ]);
        })
    );
});

// Intercepta as requisições para satisfazer o critério do PWA
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
