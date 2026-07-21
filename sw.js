importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBwkYX1R5KQ6wOiXzwShO_NLs18p70-fBg",
    authDomain: "nexus-chat-307be.firebaseapp.com",
    projectId: "nexus-chat-307be",
    storageBucket: "nexus-chat-307be.firebasestorage.app",
    messagingSenderId: "847360273462",
    appId: "1:847360273462:web:7ecd3aab0f2b5bbf4dbc97"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log("Background push received:", payload);
    const notificationTitle = payload.data?.title || payload.notification?.title || 'Nexus Secure';
    const notificationOptions = {
        body: payload.data?.body || payload.notification?.body || 'You have a new secure message',
        icon: './logo.svg',
        badge: './logo.svg',
        data: { url: './index.html' }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Cache bumped to 11.1 to ensure GBoard changes take effect immediately
const CACHE_NAME = 'nexus-secure-v11.1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './logo.svg',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'
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
    // 1. Intercept OS File Sharing (POST requests)
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

                // Redirect to the app with a trigger flag
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

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data.url);
        })
    );
});
