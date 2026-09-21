// useAuth hook — gestiona login/logout/token de oficina para el panel de RouteAI.
import { useState, useEffect } from 'react';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : `http://${window.location.hostname}:5001/api`;

// fetch autenticado: usa cookie httpOnly (credenciales incluidas automáticamente).
export function authFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    credentials: 'include', // envía cookie httpOnly automáticamente
    headers: {
      ...(opts.headers || {}),
    },
  }).then((res) => {
    // Token inválido/expirado (p.ej. deploy con JWT_SECRET regenerado):
    // limpiar sesión y volver al login en vez de romper el panel con un objeto de error.
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return res;
  });
}

export function getSessionId() {
  const KEY = 'rf_session_id';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = `vis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

export function useAuth() {
  const [logged, setLogged] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => {
    // Verificar si hay sesión válida al cargar
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await authFetch(`${API_BASE}/drivers`);
      if (res.ok) setLogged(true);
      else setLogged(false);
    } catch {
      setLogged(false);
    }
  };

  useEffect(() => {
    const onUnauthorized = () => { setLogged(false); };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const login = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/office/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (res.ok) {
      setLogged(true);
      setPin('');
    } else alert('PIN incorrecto');
  };

  const logout = async () => {
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
    setLogged(false);
  };

  return { logged, pin, setPin, login, logout };
}
