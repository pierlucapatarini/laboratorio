import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient'; // Importa il client condiviso

const menuItems = [
  { id: 1, label: 'Notifiche', route: '/notifiche' },
  { id: 2, label: 'Videochiamata', route: '/videocall' },
  { id: 3, label: 'Messaggi', route: '/messages' },
  { id: 4, label: 'Impostazioni', route: '/settings' },
  { id: 5, label: 'Statistiche', route: '/stats' },
  { id: 6, label: 'Gruppi', route: '/groups' },
  { id: 7, label: 'Contatti', route: 'contacts' },
  { id: 8, label: 'AI Funzioni', route: '/ai' },
];

const Pag0_menu = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Errore nel logout:', error);
    }
    // L'useEffect in App.jsx gestirà il reindirizzamento
  };

  return (
    <div className="main-layout">
      <header className="page-header">
        <h1>Laboratorio</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </header>
      
      <main className="menu-grid-container">
        {menuItems.map(item => (
          <Link key={item.id} to={item.route} className="menu-button">
            <span>{item.label}</span>
          </Link>
        ))}
      </main>
      
      <footer className="page-footer">
        <p>Progetto Laboratorio © 2024</p>
      </footer>
    </div>
  );
};

export default Pag0_menu;