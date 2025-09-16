// Service Worker per gestire le notifiche push

self.addEventListener('push', function(event) {
  console.log('Push event ricevuto:', event);
  
  let data = {
    title: 'Notifica',
    body: 'Hai ricevuto un nuovo messaggio.',
    url: '/'
  };
  
  if (event.data) {
    try {
      const parsedData = event.data.json();
      data = { ...data, ...parsedData };
      console.log('Dati push ricevuti:', data);
    } catch (err) {
      console.error('Errore nel parsing dei dati push:', err);
      // Fallback: usa il testo grezzo
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/images/icon-192x192.png',
    badge: '/images/badge.png',
    vibrate: [200, 100, 200],
    tag: 'notification', // Evita duplicati
    requireInteraction: false, // La notifica sparisce automaticamente
    actions: [
      {
        action: 'open',
        title: 'Apri',
        icon: '/images/open-icon.png'
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: '/images/close-icon.png'
      }
    ],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    }
  };

  console.log('Mostrando notifica:', data.title, options);

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notifica cliccata:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Controlla se c'è già una finestra aperta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Porta la finestra esistente in primo piano
          return client.focus().then(() => {
            // Naviga alla URL desiderata se possibile
            if ('navigate' in client) {
              return client.navigate(urlToOpen);
            }
          });
        }
      }
      // Se non c'è una finestra aperta, aprine una nuova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('Notifica chiusa:', event);
  // Qui puoi aggiungere logica per tracciare le notifiche chiuse
});

// Gestione degli errori del service worker
self.addEventListener('error', function(event) {
  console.error('Errore nel service worker:', event.error);
});

// Gestione delle promesse non gestite
self.addEventListener('unhandledrejection', function(event) {
  console.error('Promise rejection non gestita nel service worker:', event.reason);
});

// Log quando il service worker viene installato
self.addEventListener('install', function(event) {
  console.log('Service Worker installato');
  self.skipWaiting(); // Forza l'attivazione immediata
});

// Log quando il service worker viene attivato
self.addEventListener('activate', function(event) {
  console.log('Service Worker attivato');
  event.waitUntil(clients.claim()); // Prendi il controllo di tutti i client
});