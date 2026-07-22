// --- PURE NATIVE WEB PUSH (No Firebase Background SDK Required) ---

self.addEventListener('push', function(event) {
    let data = { title: 'Nexus Secure', body: 'New secure message', url: './index.html' };
    
    try {
        if (event.data) {
            const payload = event.data.json();
            // FCM v1 nests data payloads inside a .data object
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
        renotify: true, // Forces phone to vibrate/alert even if a previous notification is unread
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

// Cache bumped to v12.0 to purge old client caches and load latest index.html features
const CACHE_NAME = 'nexus-secure-v12.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo.svg',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
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
    // 1. Intercept OS File Sharing (POST requests from Android Share Sheet)
    if (event.request.method === 'POST' && event.request.url.includes('index.html')) {
        event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                const media = formData.get('media');
                const text = formData.get('text') || formData.get('title') || formData.get('url') || '';

                const cache = await caches.open('shared-media');
                
                // Store the file and preserve its original name in the headers
                if (media && media.size > 0) {
                    await cache.put('/shared-file', new Response(media, { 
                        headers: { 'Content-Type': media.type, 'X-Filename': media.name } 
                    }));
                } else { await cache.delete('/shared-file'); }
                
                // Store accompanying text/URL
                if (text) { await cache.put('/shared-text', new Response(text)); } 
                else { await cache.delete('/shared-text'); }

                // Redirect to the app with trigger flag
                return Response.redirect('./index.html?shared=1', 303);
            } catch (error) {
                console.error('Share target failed:', error);
                return Response.redirect('./index.html', 303);
            }
        })());
        return;
    }

    // 2. Standard Offline Caching (GET requests)
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        }).catch(() => caches.match('./index.html'))
    );
});
