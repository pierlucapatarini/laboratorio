import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

const Pag_auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        navigate('/');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);

    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-form-card">
        <h1>{isLogin ? 'Login' : 'Registrati'}</h1>
        <form onSubmit={handleAuth}>
          <input
            type="email"
            placeholder="La tua email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field"
          />
          <input
            type="password"
            placeholder="La tua password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-field"
          />
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Caricamento...' : (isLogin ? 'Accedi' : 'Crea Account')}
          </button>
        </form>
        <button className="toggle-auth-button" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  );
};

export default Pag_auth;