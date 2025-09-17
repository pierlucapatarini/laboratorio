import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Manteniamo questo per gli stili di base
import './graphics/styles.css'; // <-- Importa il file di stile globale
import App from './App';

// Registra il Service Worker di Firebase
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Firebase Service Worker registrato con successo:', registration);
    })
    .catch((error) => {
      console.error('Errore registrazione Service Worker:', error);
    });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);