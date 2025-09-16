import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Manteniamo questo per gli stili di base
import './graphics/styles.css'; // <-- Importa il file di stile globale
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);