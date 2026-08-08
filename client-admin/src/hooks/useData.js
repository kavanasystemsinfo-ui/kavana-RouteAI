// useData hook — carga y gestiona todos los datos del panel RouteAI.
import { useState, useEffect, useCallback } from 'react';
import { authFetch, getSessionId } from './useAuth.js';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : `http://${window.location.hostname}:5001/api`;

function dateRange(rangeMode) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (rangeMode === 'mes_actual') return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: '' };
  if (rangeMode === 'mes_anterior') {
    const prev = new Date(y, m - 1, 1);
    const py = prev.getFullYear(), pm = prev.getMonth();
    const lastDay = new Date(py, pm + 1, 0).getDate();
    return { from: `${py}-${String(pm + 1).padStart(2, '0')}-01`, to: `${py}-${String(pm + 1).padStart(2, '0')}-${lastDay}` };
  }
  if (rangeMode === 'semana') {
    const dow = now.getDay(), diff = now.getDate() - dow + (dow === 0 ? -6 : 1); // lunes
    const mon = new Date(now.setDate(diff));
    const fm = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
    return { from: fm, to: '' };
  }
  if (rangeMode === 'todo') return { from: '', to: '' };
  return { from: '', to: '' };
}

export function useData({ logged, from, to, rangeMode }) {
  const [drivers, setDrivers] = useState([]);
  const [stops, setStops] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [settings, setSettings] = useState({ cost_per_km: 0.3, cost_per_hour: 15, cost_per_km_diesel: 0.30, cost_per_km_gasolina: 0.35, cost_per_km_electrico: 0.15, cost_per_km_hibrido: 0.28 });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const range = dateRange(rangeMode);
      const f = from || range.from, t = to || range.to;
      const qs = new URLSearchParams();
      if (f) qs.set('from', f);
      if (t) qs.set('to', t);
      const q = qs.toString() ? `?${qs.toString()}` : '';
      const asArray = (x) => Array.isArray(x) ? x : [];
      const [d, s, i, set, sess] = await Promise.all([
        authFetch(`${API_BASE}/drivers`).then(r => r.json()),
        authFetch(`${API_BASE}/stops${q}`).then(r => r.json()),
        authFetch(`${API_BASE}/incidents${q}`).then(r => r.json()),
        authFetch(`${API_BASE}/settings`).then(r => r.json()),
        authFetch(`${API_BASE}/driver/sessions${q}`).then(r => r.json())
      ]);
      setDrivers(asArray(d)); setStops(asArray(s)); setIncidents(asArray(i));
      setSettings(typeof set === 'object' && set !== null ? set : {});
      setSessions(asArray(sess));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [from, to, rangeMode]);

  useEffect(() => {
    if (logged) loadAll();
  }, [logged, loadAll]);

  const refresh = () => loadAll();

  return { drivers, stops, incidents, settings, sessions, loading, refresh,
           setDrivers, setStops, setIncidents, setSessions, setSettings };
}
