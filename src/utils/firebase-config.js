import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

// Configurazione Firebase - usa SOLO questa configurazione
const firebaseConfig = {
  apiKey: "AIzaSyBR7PoPH287TPJSK368vrgI9T1HsKjcFP4",
  authDomain: "laboratorio-ea376.firebaseapp.com",
  projectId: "laboratorio-ea376",
  storageBucket: "laboratorio-ea376.firebasestorage.app",
  messagingSenderId: "649170330417",
  appId: "1:649170330417:web:c47d49525eb5d339030610",
  measurementId: "G-08972YZ7ZT"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza Firebase Cloud Messaging
// IMPORTANTE: Non servono chiavi VAPID per FCM quando usi getToken() senza parametri
let messaging;
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.log('Messaging non disponibile:', error);
  messaging = null;
}

export { messaging };