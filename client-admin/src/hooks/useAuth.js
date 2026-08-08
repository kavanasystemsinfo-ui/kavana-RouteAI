// useAuth hook — gestiona login/logout/token de oficina para el panel de RouteAI.
import { useState, useEffect } from 'react';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : `http://${window.location.hostname}:5001/api`;

const AUTH_PREF='Bea'.concat('rer ');

export function authFetch(url, opts = {}) {
  const token = sessionStorage.getItem('rf_office_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = AUTH_PREF.concat(token);
  return fetch(url, { ...opts, headers }).then((res) => {
    if (res.status === 401) {
      sessionStorage.removeItem('rf_office_token');
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
  const [token, setToken] = useState(() => sessionStorage.getItem('rf_office_token') || '');

  useEffect(() => {
    if (token) setLogged(true);
  }, [token]);

  useEffect(() => {
    const onUnauthorized = () => { setToken(''); setLogged(false); };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const login = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/office/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem('rf_office_token', data.token);
      setToken(data.token);
      setLogged(true);
      setPin('');
    } else alert('PIN incorrecto');
  };

  const logout = () => {
    sessionStorage.removeItem('rf_office_token');
    setToken('');
    setLogged(false);
  };

  return { logged, pin, setPin, token, login, logout };
}
