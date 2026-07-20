const CACHE_NAME = 'nexus-secure-v7.5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo.svg',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'
];

// Install Event: Cache all critical files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch Event: Serve from cache if offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached version or fetch from network
            return response || fetch(event.request);
        }).catch(() => {
            // Fallback for offline UI if network fails
            return caches.match('./index.html');
        })
    );
});

// Activate Event: Clean up old caches if version changes
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});
