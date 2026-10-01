import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useData } from './hooks/useData.js';
import Dashboard from './components/Dashboard.jsx';
import DriversSection from './components/DriversSection.jsx';
import StopsSection from './components/StopsSection.jsx';
import SendRouteSection from './components/SendRouteSection.jsx';
import SignaturesSection from './components/SignaturesSection.jsx';
import IncidentsSection from './components/IncidentsSection.jsx';
import SessionsSection from './components/SessionsSection.jsx';
import CostesSection from './components/CostesSection.jsx';
import AssistantSection from './components/AssistantSection.jsx';
import LoginView from './components/LoginView.jsx';

const API_BASE = (import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : `http://${window.location.hostname}:5001/api`;

const THEMES = {
  kavana: {
    bg: '#0f1115', panel: '#171a21', panel2: '#1f232c', border: '#272c36',
    text: '#e6e9ef', muted: '#8b93a1', accent: '#f8cd00',
    green: '#22c55e', red: '#ef4444', amber: '#f59e0b'
  },
  clasico: {
    bg: '#f4f6f8', panel: '#ffffff', panel2: '#eef1f4', border: '#d9dee3',
    text: '#1a2230', muted: '#6b7682', accent: '#f8cd00',
    green: '#16a34a', red: '#dc2626', amber: '#d97706'
  }
};

function getSessionId() {
  const KEY = 'rf_session_id';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = `vis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

function fmtNum(v) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return '—';
  const [intPart, decPart] = String(n).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${withDots},${decPart}` : withDots;
}

function fmtEuro(v) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return '—';
  const [intPart, decPart] = n.toFixed(2).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots},${decPart}`;
}

const STATUS = {
  delivered: { label: 'Entregado', color: '#22c55e' },
  pending: { label: 'Pendiente', color: '#f59e0b' },
  incident: { label: 'Incidencia', color: '#ef4444' }
};

export default function App() {
  const { logged, pin, setPin, login, logout } = useAuth();
  const [section, setSection] = useState('dashboard');
  const [contactoOpen, setContactoOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('rf_admin_theme') || 'clasico');
  const [filterDriver, setFilterDriver] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rangeMode, setRangeMode] = useState('mes_actual');

  const C = THEMES[theme];

  const { drivers, stops, incidents, settings, sessions, loading, refresh } = useData({
    logged, from, to, rangeMode
  });

  // Filtros memoizados
  const filteredStops = useMemo(() => stops.filter(s =>
    (!filterDriver || String(s.driver_id) === String(filterDriver)) &&
    (!filterStatus || s.status === filterStatus) &&
    (!from || (s.created_at || '') >= from) &&
    (!to || (s.created_at || '') <= to + 'T23:59:59')
  ), [stops, filterDriver, filterStatus, from, to]);

  const kpi = useMemo(() => ({
    total: stops.length,
    delivered: stops.filter(s => s.status === 'delivered').length,
    pending: stops.filter(s => s.status === 'pending').length,
    incidents: stops.filter(s => s.status === 'incident').length
  }), [stops]);

  const closedSessions = useMemo(() => sessions.filter(s => s.status === 'closed' && s.km_total), [sessions]);
  const opexReal = closedSessions.reduce((sum, s) => {
    const driver = drivers.find(d => d.id === s.driver_id);
    const fuelKey = `cost_per_km_${driver?.fuel_type || ''}`;
    const costKm = settings[fuelKey] || settings.cost_per_km || 0.3;
    return sum + parseFloat(s.km_total || 0) * costKm;
  }, 0).toFixed(2);

  const perDriverStats = useMemo(() => {
    const stats = new Map();
    for (const s of stops) {
      const cur = stats.get(s.driver_id) || { total: 0, done: 0 };
      cur.total += 1;
      if (s.status === 'delivered') cur.done += 1;
      stats.set(s.driver_id, cur);
    }
    return stats;
  }, [stops]);

  const driverName = (id) => (drivers.find(d => d.id === Number(id))?.name) || '—';

  const calcRange = (mode) => {
    const hoy = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    if (mode === 'mes_actual') {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { from: iso(primero), to: iso(hoy) };
    }
    if (mode === 'mes_anterior') {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { from: iso(primero), to: iso(ultimo) };
    }
    if (mode === 'semana') {
      const dia = (hoy.getDay() + 6) % 7;
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - dia);
      return { from: iso(lunes), to: iso(hoy) };
    }
    if (mode === 'todo') return { from: '', to: '' };
    return null;
  };

  const applyRange = (mode) => {
    setRangeMode(mode);
    const r = calcRange(mode);
    if (r) { setFrom(r.from); setTo(r.to); }
  };

  useEffect(() => {
    if (logged && rangeMode === 'mes_actual' && !from && !to) {
      const r = calcRange('mes_actual');
      setFrom(r.from); setTo(r.to);
    }
  }, [logged]);

  if (!logged) {
    return <LoginView onLogin={login} pin={pin} setPin={setPin} theme={theme} API_BASE={API_BASE} />;
  }

  const S = theme === 'clasico'
    ? { bg: "url('/asphalt.png') center/cover no-repeat, #2d3239", text: '#e2e5eb', muted: '#9ba2b0', border: '#3d424d' }
    : { bg: "url('/asphalt.png') center/cover no-repeat, #171a21", text: C.text, muted: C.muted, border: C.border };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: S.bg, borderRight: `1px solid ${S.border}`, padding: 20, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30 }}>
          <img src="/logo.png" alt="logo" style={{ height: 32 }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: C.accent, letterSpacing: '-1px', lineHeight: 1.1 }}>KAVANA</div>
            <div style={{ fontSize: 8, color: S.muted, fontWeight: 900, letterSpacing: 2 }}>ROUTE AI</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['kavana', 'clasico'].map(t => (
            <button key={t} onClick={() => { setTheme(t); localStorage.setItem('rf_admin_theme', t); }} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${S.border}`, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: theme === t ? C.accent : 'transparent', color: theme === t ? '#000' : S.text }}>{t === 'kavana' ? 'Kavana' : 'Clásico'}</button>
          ))}
        </div>
        {[
          ['dashboard', 'Dashboard'],
          ['drivers', 'Repartidores'],
          ['stops', 'Repartos'],
          ['sendRoute', 'Enviar Ruta'],
          ['signatures', 'Firmas'],
          ['incidents', 'Incidencias'],
          ['sessions', 'Jornadas'],
          ['costes', 'Costes'],
          ['assistant', 'Asistente técnico']
        ].map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} style={{ textAlign: 'left', padding: '12px 14px', marginBottom: 6, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: section === key ? C.accent : 'transparent', color: section === key ? '#000' : S.text }}>{label}</button>
        ))}
        <div style={{ marginBottom: 6 }}>
          <button onClick={() => setContactoOpen(!contactoOpen)} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: 'transparent', color: S.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Contacto</span>
            <span style={{ fontSize: 10 }}>{contactoOpen ? '▲' : '▼'}</span>
          </button>
          {contactoOpen && (
            <div style={{ marginLeft: 10, marginTop: 2 }}>
              <a href="mailto:kavanasystems.info@gmail.com" style={{ display: 'block', textAlign: 'left', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: S.text, fontSize: 13 }}>📧 Email</a>
              <a href="https://www.linkedin.com/in/kavanasystems/" target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'left', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: S.text, fontSize: 13 }}>💼 LinkedIn</a>
              <a href="https://wa.me/34633422461" target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'left', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: S.text, fontSize: 13 }}>💬 WhatsApp</a>
            </div>
          )}
        </div>
        <div style={{ marginTop: 'auto', fontSize: 11, color: S.muted }}>Route AI v1.0</div>
        <button onClick={logout} style={{ marginTop: 12, textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, cursor: 'pointer', fontWeight: 700, background: 'transparent', color: S.muted }}>Salir</button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 28, overflow: 'auto' }}>
        {/* Selector de rango global */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginRight: 4 }}>Periodo:</span>
          {[
            ['mes_actual', 'Mes actual'],
            ['mes_anterior', 'Mes anterior'],
            ['semana', 'Esta semana'],
            ['todo', 'Todo el histórico'],
            ['custom', 'Personalizado']
          ].map(([key, label]) => (
            <button key={key} onClick={() => applyRange(key)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: rangeMode === key ? C.accent : 'transparent', color: rangeMode === key ? '#000' : C.text }}>{label}</button>
          ))}
          {rangeMode === 'custom' && (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '7px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }} />
              <span style={{ color: C.muted, fontSize: 13 }}>a</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '7px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }} />
            </>
          )}
          {from && <span style={{ fontSize: 12, color: C.muted }}>({from} → {to || 'hoy'})</span>}
          {loading && <span style={{ fontSize: 12, color: C.muted }}>cargando…</span>}
        </div>

        {section === 'dashboard' && <Dashboard C={C} kpi={kpi} closedSessions={closedSessions} opexReal={opexReal} fmtNum={fmtNum} fmtEuro={fmtEuro} drivers={drivers} perDriverStats={perDriverStats} />}
        {section === 'drivers' && <DriversSection C={C} API_BASE={API_BASE} drivers={drivers} refresh={refresh} getSessionId={getSessionId} />}
        {section === 'stops' && <StopsSection C={C} STATUS={STATUS} API_BASE={API_BASE} stops={filteredStops} drivers={drivers} driverName={driverName} filterDriver={filterDriver} setFilterDriver={setFilterDriver} filterStatus={filterStatus} setFilterStatus={setFilterStatus} from={from} setFrom={setFrom} to={to} setTo={setTo} driversList={drivers} onDelete={refresh} fmtNum={fmtNum} />}
        {section === 'sendRoute' && <SendRouteSection C={C} API_BASE={API_BASE} drivers={drivers} refresh={refresh} getSessionId={getSessionId} />}
        {section === 'signatures' && <SignaturesSection C={C} STATUS={STATUS} API_BASE={API_BASE} stops={filteredStops} drivers={drivers} driverName={driverName} filterDriver={filterDriver} setFilterDriver={setFilterDriver} from={from} setFrom={setFrom} to={to} setTo={setTo} driversList={drivers} fmtNum={fmtNum} />}
        {section === 'incidents' && <IncidentsSection C={C} incidents={incidents} drivers={drivers} />}
        {section === 'sessions' && <SessionsSection C={C} sessions={sessions} drivers={drivers} settings={settings} fmtNum={fmtNum} fmtEuro={fmtEuro} fmtKm={fmtNum} />}
        {section === 'costes' && <CostesSection C={C} API_BASE={API_BASE} settings={settings} fmtEuro={fmtEuro} />}
        {section === 'assistant' && <AssistantSection C={C} API_BASE={API_BASE} />}
      </main>
    </div>
  );
}