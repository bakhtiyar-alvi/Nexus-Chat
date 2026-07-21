const admin = require('firebase-admin');

// Initialize Firebase Admin securely using Environment Variables
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

export default async function handler(req, res) {
    // CORS headers for your frontend
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { token, title, body } = req.body;

    if (!token) return res.status(400).json({ error: 'Missing FCM token' });

    try {
        const message = {
            token: token,
            // Native block forces OS to display it without waking up the Service Worker
            notification: {
                title: title || 'Nexus Secure',
                body: body || 'New secure message'
            },
            // WebPush specifics required by Android Chrome
            webpush: {
                headers: {
                    Urgency: 'high' // Bypasses Android Doze / Battery Saver
                },
                notification: {
                    // Absolute URL required. Using a reliable public CDN lock icon for safety.
                    icon: 'https://cdn-icons-png.flaticon.com/512/1828/1828302.png',
                    requireInteraction: true
                }
            }
        };

        const response = await admin.messaging().send(message);
        return res.status(200).json({ success: true, messageId: response });
    } catch (error) {
        console.error('FCM Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
