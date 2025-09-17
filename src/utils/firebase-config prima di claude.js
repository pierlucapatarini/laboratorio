import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

// La configurazione di Firebase del tuo progetto
// Puoi trovare questi valori nella console di Firebase
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
const messaging = getMessaging(app);

export { messaging };