// Importa la SDK di Firebase, che deve essere disponibile nel Service Worker
// Assicurati che questo path sia corretto per la tua build
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Inserisci qui la tua configurazione di Firebase
// È cruciale che questi valori siano identici a quelli in firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyBR7PoPH287TPJSK368vrgI9T1HsKjcFP4",
  authDomain: "laboratorio-ea376.firebaseapp.com",
  projectId: "laboratorio-ea376",
  storageBucket: "laboratorio-ea376.firebasestorage.app",
  messagingSenderId: "649170330417",
  appId: "1:649170330417:web:c47d49525eb5d339030610",
  measurementId: "G-08972YZ7ZT"
};

// Inizializza l'app Firebase nel Service Worker
firebase.initializeApp(firebaseConfig);

// Inizializza Firebase Messaging e gestisci i messaggi in background
const messaging = firebase.messaging();

// Gestisci i messaggi ricevuti in background (quando l'app non è in primo piano)
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Messaggio in background ricevuto', payload);
    
    // Personalizza la notifica visualizzata
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/images/icon-192x192.png',
        badge: '/images/badge.png',
        vibrate: [200, 100, 200],
        data: payload.data,
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Aggiungi la gestione del click sulla notifica
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                let found = false;
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (!found) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});