// --- PURE NATIVE WEB PUSH (No Firebase Background SDK Required) ---

self.addEventListener('push', function(event) {
    let data = { title: 'Nexus Secure', body: 'New secure message', url: './index.html' };
    
    try {
        if (event.data) {
            const payload = event.data.json();
            if (payload.data) {
                data.title = payload.data.title || data.title;
                data.body = payload.data.body || data.body;
                data.url = payload.data.url || data.url;
            } else {
                data.title = payload.title || data.title;
                data.body = payload.body || data.body;
                data.url = payload.url || data.url;
            }
        }
    } catch (e) { 
        console.error('Push parsing error:', e); 
    }

    const options = {
        body: data.body,
        icon: './logo.svg',
        badge: './logo.svg',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'nexus-message',
        renotify: true,
        data: { url: data.url }
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data.url || './index.html');
        })
    );
});

// Cache bumped to v16.2 for automatic refresh
const CACHE_NAME = 'nexus-secure-v16.2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo.svg',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await Promise.allSettled(
                ASSETS_TO_CACHE.map(url => 
                    cache.add(url).catch(err => console.warn(`Cache pre-fetch skipped for ${url}:`, err))
                )
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== 'shared-media') {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Intercept OS File Sharing (PWA Web Share Target)
    if (event.request.method === 'POST' && event.request.url.includes('index.html')) {
        event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                const media = formData.get('media');
                const text = formData.get('text') || formData.get('title') || formData.get('url') || '';

                const cache = await caches.open('shared-media');
                
                if (media && media.size > 0) {
                    await cache.put('/shared-file', new Response(media, { 
                        headers: { 'Content-Type': media.type, 'X-Filename': media.name } 
                    }));
                } else { await cache.delete('/shared-file'); }
                
                if (text) { await cache.put('/shared-text', new Response(text)); } 
                else { await cache.delete('/shared-text'); }

                return Response.redirect('./index.html?shared=1', 303);
            } catch (error) {
                return Response.redirect('./index.html', 303);
            }
        })());
        return;
    }

    // Navigation (index.html) Network-First Strategy to ensure code updates deploy immediately
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put('./index.html', networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => caches.match('./index.html', { ignoreSearch: true }))
        );
        return;
    }

    // Static Assets Cache-First Strategy
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((response) => {
            return response || fetch(event.request);
        }).catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
});
