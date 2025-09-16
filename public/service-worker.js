// service-worker.js

self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Notifica';
    const options = {
        body: data.body || 'Hai ricevuto un nuovo messaggio.',
        icon: '/images/icon-192x192.png', // Sostituisci con il percorso della tua icona
        badge: '/images/badge.png', // opzionale, per Android
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/' // URL da aprire quando si clicca sulla notifica
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});