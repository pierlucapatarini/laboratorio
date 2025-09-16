self.addEventListener('push', function(event) {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json(); // Prova a fare il parse JSON
    } catch (err) {
      data = { body: event.data.text() }; // Se non è JSON, usa come testo
    }
  }

  const title = data.title || 'Notifica';
  const options = {
    body: data.body || 'Hai ricevuto un nuovo messaggio.',
    icon: '/images/icon-192x192.png',
    badge: '/images/badge.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
