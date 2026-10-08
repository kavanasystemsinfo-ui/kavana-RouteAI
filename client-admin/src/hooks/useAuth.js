// useAuth hook — gestiona login/logout/token de oficina para el panel de RouteAI.
import { useState, useEffect } from 'react';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\\/$/, '')}/api`
  : `http://${window.location.hostname}:5001/api`;

const TOKEN_KEY = 'rf_token_memory';

// fetch autenticado: usa header Authorization Bearer (más fiable cross-site que cookies).
export function authFetch(url, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  // DEBUG
  console.log('[authFetch] token from storage:', token ? 'present' : 'null');
  const headers = {
    ...(opts.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
  // DEBUG
  console.log('[authFetch] headers:', headers);
  return fetch(url, {
    ...opts,
    headers,
  }).then((res) => {
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
    const onUnauthorized = () => { setLogged(false); localStorage.removeItem(TOKEN_KEY); };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const login = async (e) => {
    e.preventDefault();
    console.log('[login] attempting login with pin:', pin);
    const res = await fetch(`${API_BASE}/office/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    console.log('[login] response status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('[login] data:', data);
      if (data.token) {
        console.log('[login] storing token');
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      setLogged(true);
      setPin('');
    } else alert('PIN incorrecto');
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_KEY);
    await fetch(`${API_BASE}/logout`, { method: 'POST' });
    setLogged(false);
  };

  return { logged, pin, setPin, login, logout };
}
