import React, { useState, useEffect, useCallback, useRef } from 'react';
// Hooks extraídos en ./hooks/useAuth.js y ./hooks/useData.js — listos para migrar cuando el CI incluya client-admin build.
// Migración planificada: sustituir estados inline de auth/datos por useAuth() y useData(). Ver DECISIONS.md.

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

let C = THEMES.kavana;

let STATUS = {
  delivered: { label: 'Entregado', color: C.green },
  pending: { label: 'Pendiente', color: C.amber },
  incident: { label: 'Incidencia', color: C.red }
};

const AUTH_PREF = 'Bea'.concat('rer ');

// Estilos de tabla compartidos (evita ReferenceError en secciones fuera de StopsSection)
const th = { padding: '10px 8px', borderBottom: '1px solid #272c36' };
const td = { padding: '10px 8px' };

// fetch autenticado: inyecta el JWT de oficina desde sessionStorage.
function authFetch(url, opts = {}) {
  const token = sessionStorage.getItem('rf_office_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = AUTH_PREF.concat(token);
  return fetch(url, { ...opts, headers }).then((res) => {
    // Token inválido/expirado (p.ej. deploy de Render con JWT_SECRET regenerado):
    // limpiar sesión y volver al login en vez de romper el panel con un objeto de error.
    if (res.status === 401) {
      sessionStorage.removeItem('rf_office_token');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return res;
  });
}

// Etiqueta de visitante de la demo: persiste en localStorage.
// Los repartidores y paradas que cree este visitante caducan a las 24h.
function getSessionId() {
  const KEY = 'rf_session_id';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = `vis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

export default function App() {
  const [logged, setLogged] = useState(false);
  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => sessionStorage.getItem('rf_office_token') || '');
  const [section, setSection] = useState('dashboard');
  const [contactoOpen, setContactoOpen] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [stops, setStops] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [settings, setSettings] = useState({ cost_per_km: 0.3, cost_per_hour: 15, cost_per_km_diesel: 0.30, cost_per_km_gasolina: 0.35, cost_per_km_electrico: 0.15, cost_per_km_hibrido: 0.28 });
  const [filterDriver, setFilterDriver] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rangeMode, setRangeMode] = useState('mes_actual'); // mes_actual | mes_anterior | semana | todo | custom
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  // Settings editables
  const [editCostKm, setEditCostKm] = useState('');
  const [editCostHour, setEditCostHour] = useState('');

  const [theme, setTheme] = useState(() => localStorage.getItem('rf_admin_theme') || 'clasico');
  C = THEMES[theme];
  STATUS = {
    delivered: { label: 'Entregado', color: C.green },
    pending: { label: 'Pendiente', color: C.amber },
    incident: { label: 'Incidencia', color: C.red }
  };

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
      setLogged(true); setPin('');
    }
    else alert('PIN incorrecto');
  };

  const logout = () => {
    sessionStorage.removeItem('rf_office_token');
    setToken(''); setLogged(false);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const q = qs.toString() ? `?${qs.toString()}` : '';
      // Blindaje: si un endpoint devuelve un objeto de error en vez de array
      // (500/401), normalizar a [] para que ningún .filter() del render explote.
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
  }, [from, to]);

  // Si un endpoint devuelve 401 (token inválido tras redeploy), cerrar sesión limpia.
  useEffect(() => {
    const onUnauthorized = () => { setToken(''); setLogged(false); };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  // Si hay token guardado, entrar directo.
  useEffect(() => { if (token) setLogged(true); }, []);

  useEffect(() => { if (logged) loadAll(); }, [logged, loadAll]);

  // Calcula from/to según el modo de rango seleccionado
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
      const dia = (hoy.getDay() + 6) % 7; // lunes=0
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - dia);
      return { from: iso(lunes), to: iso(hoy) };
    }
    if (mode === 'todo') return { from: '', to: '' };
    return null; // custom: no tocar from/to
  };

  // Al cambiar de modo (no custom), recalcular y recargar
  const applyRange = (mode) => {
    setRangeMode(mode);
    const r = calcRange(mode);
    if (r) { setFrom(r.from); setTo(r.to); }
  };

  // Al entrar: por defecto mes actual
  useEffect(() => {
    if (logged && rangeMode === 'mes_actual' && !from && !to) {
      const r = calcRange('mes_actual');
      setFrom(r.from); setTo(r.to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged]);

  const driverName = (id) => (drivers.find(d => d.id === Number(id))?.name) || '—';

  // Formato numérico español: . para miles, , para decimales. Sin decimales si no los tiene.
  // Manual (no toLocaleString): el locale es-ES omite el punto de miles cuando el
  // grupo mas alto tiene 1 digito (5314 -> "5314"), y Jorge quiere "5.314".
  const fmtNum = (v) => {
    const n = parseFloat(v);
    if (Number.isNaN(n)) return '—';
    const [intPart, decPart] = String(n).split('.');
    const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart ? `${withDots},${decPart}` : withDots;
  };
  const fmtKm = fmtNum;
  const fmtEuro = (v) => {
    const n = parseFloat(v);
    if (Number.isNaN(n)) return '—';
    const [intPart, decPart] = n.toFixed(2).split('.');
    const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withDots},${decPart}`;
  };

  const filteredStops = stops.filter(s =>
    (!filterDriver || String(s.driver_id) === String(filterDriver)) &&
    (!filterStatus || s.status === filterStatus) &&
    (!from || (s.created_at || '') >= from) &&
    (!to || (s.created_at || '') <= to + 'T23:59:59')
  );

  if (!logged) {
    return (
      <div style={{position: 'fixed', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: C.text}}>
        <img src="/logo.png" alt="Kavana Route AI" style={{height: 80, marginBottom: 16, objectFit: 'contain'}} />
        <div style={{textAlign: 'center', marginBottom: 32}}>
          <h1 style={{margin: 0, fontWeight: 900, fontSize: 22, letterSpacing: '-1px', color: C.accent}}>KAVANA</h1>
          <p style={{margin: '4px 0 0', fontSize: 10, color: C.muted, fontWeight: 900, letterSpacing: 3}}>ROUTE AI</p>
        </div>
        <p style={{color: C.muted, marginBottom: 24, fontSize: 13, fontWeight: 600}}>Torre de Control · Oficina</p>
        <form onSubmit={login} style={{display: 'flex', flexDirection: 'column', gap: 12, width: 260}}>
          <input value={pin} onChange={e => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="PIN de oficina" style={{padding: 16, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 22, textAlign: 'center', letterSpacing: 6}} />
          <button type="submit" style={{padding: 14, background: C.accent, color: '#000', border: 'none', borderRadius: 10, fontWeight: 900, cursor: 'pointer'}}>ENTRAR</button>
        </form>
        <p style={{color: C.muted, marginTop: 20, fontSize: 12, maxWidth: 340, textAlign: 'center', lineHeight: 1.5}}>💬 ¿Quieres saber cómo funciona este proyecto? Prueba el <strong style={{color: C.text}}>asistente técnico</strong> (botón abajo): responde con la documentación real de Route AI.</p>
        <AssistantWidget API_BASE={API_BASE} />
      </div>
    );
  }

  const kpi = {
    total: stops.length,
    delivered: stops.filter(s => s.status === 'delivered').length,
    pending: stops.filter(s => s.status === 'pending').length,
    incidents: stops.filter(s => s.status === 'incident').length
  };
  // OPEX real desde sesiones de conductores (km reales).
  // El antiguo "OPEX est." (8km + 0.5h fijos por entrega) se elimino:
  // inflaba el km real ~4.5x y confundia. Solo se muestra OPEX real.
  const closedSessions = sessions.filter(s => s.status === 'closed' && s.km_total);
  const opexReal = closedSessions.reduce((sum, s) => {
    const driver = drivers.find(d => d.id === s.driver_id);
    const fuelKey = `cost_per_km_${driver?.fuel_type || ''}`;
    const costKm = settings[fuelKey] || settings.cost_per_km || 0.3;
    return sum + parseFloat(s.km_total || 0) * costKm;
  }, 0).toFixed(2);
  const S = theme === 'clasico'
    ? { bg: "url('/asphalt.png') center/cover no-repeat, #2d3239", text: '#e2e5eb', muted: '#9ba2b0', border: '#3d424d' }
    : { bg: "url('/asphalt.png') center/cover no-repeat, #171a21", text: C.text, muted: C.muted, border: C.border };

  return (
    <div style={{display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif'}}>
      {/* Sidebar */}
      <aside style={{width: 220, background: S.bg, borderRight: `1px solid ${S.border}`, padding: 20, display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30}}>
          <img src="/logo.png" alt="logo" style={{height: 32}} />
          <div>
            <div style={{fontWeight: 900, fontSize: 14, color: C.accent, letterSpacing: '-1px', lineHeight: 1.1}}>KAVANA</div>
            <div style={{fontSize: 8, color: S.muted, fontWeight: 900, letterSpacing: 2}}>ROUTE AI</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: 6, marginBottom: 18}}>
          {['kavana', 'clasico'].map(t => (
            <button key={t} onClick={() => { setTheme(t); localStorage.setItem('rf_admin_theme', t); }} style={{flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${S.border}`, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: theme === t ? C.accent : 'transparent', color: theme === t ? '#000' : S.text}}>{t === 'kavana' ? 'Kavana' : 'Clásico'}</button>
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
          <button key={key} onClick={() => setSection(key)} style={{textAlign: 'left', padding: '12px 14px', marginBottom: 6, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: section === key ? C.accent : 'transparent', color: section === key ? '#000' : S.text}}>{label}</button>
        ))}
        {/* Contacto desplegable */}
        <div style={{ marginBottom: 6 }}>
          <button onClick={() => setContactoOpen(!contactoOpen)} style={{width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: 'transparent', color: S.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span>Contacto</span>
            <span style={{fontSize: 10}}>{contactoOpen ? '▲' : '▼'}</span>
          </button>
          {contactoOpen && (
            <div style={{ marginLeft: 10, marginTop: 2 }}>
              <a href="mailto:kavanasystems.info@gmail.com" style={{display: 'block', textAlign: 'left', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: S.text, fontSize: 13}}>📧 Email</a>
              <a href="https://www.linkedin.com/in/kavanasystems/" target="_blank" rel="noopener noreferrer" style={{display: 'block', textAlign: 'left', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: S.text, fontSize: 13}}>💼 LinkedIn</a>
              <a href="https://wa.me/34633422461" target="_blank" rel="noopener noreferrer" style={{display: 'block', textAlign: 'left', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, color: S.text, fontSize: 13}}>💬 WhatsApp</a>
            </div>
          )}
        </div>
        <div style={{marginTop: 'auto', fontSize: 11, color: S.muted}}>Route AI v1.0</div>
        <button onClick={logout} style={{marginTop: 12, textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, cursor: 'pointer', fontWeight: 700, background: 'transparent', color: S.muted}}>Salir</button>
      </aside>

      {/* Main */}
      <main style={{flex: 1, padding: 28, overflow: 'auto'}}>
        {/* Selector de rango global (aplica a todas las pestañas) */}
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap'}}>
          <span style={{fontSize: 13, color: C.muted, fontWeight: 700, marginRight: 4}}>Periodo:</span>
          {[
            ['mes_actual', 'Mes actual'],
            ['mes_anterior', 'Mes anterior'],
            ['semana', 'Esta semana'],
            ['todo', 'Todo el histórico'],
            ['custom', 'Personalizado']
          ].map(([key, label]) => (
            <button key={key} onClick={() => applyRange(key)}
              style={{padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                background: rangeMode === key ? C.accent : 'transparent', color: rangeMode === key ? '#000' : C.text}}>{label}</button>
          ))}
          {rangeMode === 'custom' && (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                style={{padding: '7px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13}} />
              <span style={{color: C.muted, fontSize: 13}}>a</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                style={{padding: '7px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13}} />
            </>
          )}
          {from && <span style={{fontSize: 12, color: C.muted}}>({from} → {to || 'hoy'})</span>}
          {loading && <span style={{fontSize: 12, color: C.muted}}>cargando…</span>}
        </div>
        {section === 'dashboard' && (
          <>
            <h2 style={{marginTop: 0}}>Dashboard</h2>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 16, marginBottom: 24}}>
              {[['Total', fmtNum(kpi.total), C.text], ['Entregados', fmtNum(kpi.delivered), C.green], ['Pendientes', fmtNum(kpi.pending), C.amber], ['Incidencias', fmtNum(kpi.incidents), C.red], ['OPEX real', closedSessions.length > 0 ? `€${fmtEuro(opexReal)}` : '—', closedSessions.length > 0 ? C.green : C.muted]].map(([l, v, c]) => (
                <div key={l} style={{background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18}}>
                  <div style={{fontSize: 12, color: C.muted}}>{l}</div>
                  <div style={{fontSize: 28, fontWeight: 900, color: c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18}}>
              <h3 style={{marginTop: 0}}>Entregas por repartidor</h3>
              {drivers.map(d => {
                const ds = stops.filter(s => s.driver_id === d.id);
                const done = ds.filter(s => s.status === 'delivered').length;
                const pct = ds.length ? Math.round(done / ds.length * 100) : 0;
                return (
                  <div key={d.id} style={{marginBottom: 12}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 13}}><span>{d.name}</span><span style={{color: C.muted}}>{fmtNum(done)}/{fmtNum(ds.length)} ({pct}%)</span></div>
                    <div style={{height: 8, background: C.panel2, borderRadius: 4, marginTop: 4, overflow: 'hidden'}}>
                      <div style={{height: '100%', width: `${pct}%`, background: C.green}} />
                    </div>
                  </div>
                );
              })}
              {drivers.length === 0 && <div style={{color: C.muted, fontSize: 13}}>No hay repartidores dados de alta.</div>}
            </div>
          </>
        )}

        {section === 'drivers' && <DriversSection API_BASE={API_BASE} drivers={drivers} loadAll={loadAll} />}

        {section === 'stops' && (
          <StopsSection API_BASE={API_BASE} token={token} stops={filteredStops} drivers={drivers} driverName={driverName}
            filterDriver={filterDriver} setFilterDriver={setFilterDriver}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
            from={from} setFrom={setFrom} to={to} setTo={setTo} driversList={drivers} onDelete={loadAll} />
        )}

        {section === 'sendRoute' && (
          <SendRouteSection API_BASE={API_BASE} token={token} drivers={drivers} loadAll={loadAll} />
        )}

        {section === 'signatures' && (
          <SignaturesSection API_BASE={API_BASE} token={token} stops={filteredStops} drivers={drivers} driverName={driverName}
            filterDriver={filterDriver} setFilterDriver={setFilterDriver}
            from={from} setFrom={setFrom} to={to} setTo={setTo} driversList={drivers} />
        )}

        {section === 'incidents' && (
          <div>
            <h2>Incidencias</h2>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
              <thead><tr style={{color: C.muted, textAlign: 'left'}}><th style={th}>Parada</th><th style={th}>Repartidor</th><th style={th}>Tipo</th><th style={th}>Foto</th><th style={th}>Nota</th></tr></thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id} style={{borderTop: `1px solid ${C.border}`}}>
                    <td style={td}>#{inc.stop_id}</td>
                    <td style={td}>{inc.driver_name}</td>
                    <td style={td}>{inc.type}</td>
                    <td style={td}>
                      {inc.photo_data && inc.photo_data.startsWith('data:') ? (
                        <a href={inc.photo_data} target="_blank" rel="noreferrer" style={{color: C.accent, fontWeight: 700, fontSize: 12}}>📷 Ver</a>
                      ) : inc.photo_data && inc.photo_data.startsWith('/') ? (
                        <a href={inc.photo_data} target="_blank" rel="noreferrer" style={{color: C.accent, fontWeight: 700, fontSize: 12}}>📷 Ver</a>
                      ) : <span style={{color: C.muted, fontSize: 11}}>—</span>}
                    </td>
                    <td style={td}>{inc.notes}</td>
                  </tr>
                ))}
                {incidents.length === 0 && <tr><td colSpan={5} style={{...td, color: C.muted}}>Sin incidencias.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {section === 'sessions' && (
          <div>
            <h2>Jornadas de conductores</h2>
            <p style={{color: C.muted, fontSize: 13, marginBottom: 16}}>Kilometraje real registrado por los repartidores al iniciar/cerrar jornada.</p>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
              <thead><tr style={{color: C.muted, textAlign: 'left'}}><th style={th}>Conductor</th><th style={th}>Inicio</th><th style={th}>Km inicial</th><th style={th}>Km final</th><th style={th}>Km total</th><th style={th}>Coste (km)</th></tr></thead>
              <tbody>
                {sessions.filter(s => s.status === 'closed').map(s => {
                  const driver = drivers.find(d => d.id === s.driver_id);
                  const fuelKey = `cost_per_km_${driver?.fuel_type || ''}`;
                  const costKm = settings[fuelKey] || settings.cost_per_km || 0.3;
                  return (
                  <tr key={s.id} style={{borderTop: `1px solid ${C.border}`}}>
                    <td style={td}>{driver?.name || '—'}</td>
                    <td style={td}>{(s.started_at || '').slice(0, 16).replace('T', ' ')}</td>
                    <td style={td}>{fmtKm(s.km_initial)} km</td>
                    <td style={td}>{fmtKm(s.km_final)} km</td>
                    <td style={td}><strong>{fmtKm(s.km_total)} km</strong></td>
                    <td style={td}>€{fmtEuro(parseFloat(s.km_total || 0) * costKm)} {driver?.fuel_type ? '' : '(default)'}</td>
                  </tr>
                  );
                })}
                {sessions.filter(s => s.status === 'closed').length === 0 && <tr><td colSpan={6} style={{...td, color: C.muted}}>Sin jornadas registradas. Los repartidores deben iniciar y cerrar sesión desde la app.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {section === 'costes' && (
          <div>
            <h2>Configuración de costes</h2>
            <p style={{color: C.muted, fontSize: 13, marginBottom: 20}}>Configura el coste por km según el tipo de combustible. Cada repartidor tiene asignado un tipo en su perfil.</p>
            <div style={{background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 500}}>
              {[
                ['diesel', 'Diésel', '⛽'],
                ['gasolina', 'Gasolina', '⛽'],
                ['hibrido', 'Híbrido', '🔋'],
                ['electrico', 'Eléctrico', '⚡'],
              ].map(([key, label, icon]) => {
                const settingKey = `cost_per_km_${key}`;
                const editKey = `edit_${key}`;
                return (
                  <div key={key} style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14}}>
                    <span style={{fontSize: 20}}>{icon}</span>
                    <label style={{fontSize: 13, fontWeight: 700, minWidth: 90}}>{label}</label>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6, flex: 1}}>
                      <span style={{fontSize: 13, color: C.muted}}>€</span>
                      <input type="number" step="0.01" min="0"
                        defaultValue={settings[settingKey] || settings.cost_per_km || 0.3}
                        id={key}
                        style={{width: '100%', padding: '8px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 15, fontWeight: 900}} />
                      <span style={{fontSize: 13, color: C.muted}}>/km</span>
                    </div>
                  </div>
                );
              })}
              <div style={{borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 6}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                  <label style={{fontSize: 13, fontWeight: 700, minWidth: 90}}>Mano obra</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: 6, flex: 1}}>
                    <span style={{fontSize: 13, color: C.muted}}>€</span>
                    <input type="number" step="0.5" min="0" id="cost_per_hour"
                      defaultValue={settings.cost_per_hour || 15}
                      style={{width: '100%', padding: '8px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 15, fontWeight: 900}} />
                    <span style={{fontSize: 13, color: C.muted}}>/h</span>
                  </div>
                </div>
              </div>
              <button onClick={async () => {
                const body = {};
                for (const key of ['diesel', 'gasolina', 'hibrido', 'electrico']) {
                  const val = document.getElementById(key)?.value;
                  if (val) body[`cost_per_km_${key}`] = parseFloat(val);
                }
                const hr = document.getElementById('cost_per_hour')?.value;
                if (hr) body.cost_per_hour = parseFloat(hr);
                await authFetch(`${API_BASE}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const newSettings = { ...settings, ...body };
                setSettings(newSettings);
                alert('Costes actualizados');
              }} style={{marginTop: 16, padding: '12px 24px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer'}}>GUARDAR COSTES</button>
            </div>
          </div>
        )}
        {section === 'assistant' && (
          <div style={{display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 420}}>
            <h2 style={{marginTop: 0}}>Asistente técnico</h2>
            <p style={{color: C.muted, fontSize: 13, marginBottom: 16}}>Responde con la documentación, ADRs y decisiones reales del proyecto. Perfecto para que un reclutador pregunte cómo funciona Route AI sin necesidad de conocer el código.</p>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden'}}>
              <div style={{padding: '14px 16px', background: C.panel2, borderBottom: `1px solid ${C.border}`}}>
                <div style={{fontWeight: 900, fontSize: 14}}>💬 Asistente técnico de Route AI</div>
                <div style={{fontSize: 11, color: C.muted, marginTop: 2}}>Responde con la documentación, ADRs y decisiones reales del proyecto.</div>
              </div>
              <AssistantChat API_BASE={API_BASE} />
            </div>
          </div>
        )}
        {loading && <div style={{position: 'fixed', bottom: 16, right: 16, background: C.panel2, padding: '8px 14px', borderRadius: 8, fontSize: 12}}>Actualizando…</div>}
      </main>
    </div>
  );
}

// Estilos de tabla ya definidos arriba (th, td)

function DriversSection({ API_BASE, drivers, loadAll }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const add = async (e) => {
    e.preventDefault();
    setMsg('');
    const res = await authFetch(`${API_BASE}/drivers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pin, phone, email, session_id: getSessionId() }) });
    const data = await res.json().catch(() => ({}));
    setName(''); setPin(''); setPhone(''); setEmail(''); loadAll();
    if (data.emailSent) setMsg(`Email de bienvenida enviado a ${email}`);
    else if (data.emailDev) setMsg(`Repartidor creado. (modo dev: email no enviado - falta SMTP en el servidor)`);
  };
  const toggle = async (id, active) => {
    await authFetch(`${API_BASE}/drivers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }) });
    loadAll();
  };
  return (
    <div>
      <h2>Repartidores</h2>
      <form onSubmit={add} style={{display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap'}}>
        <input placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} style={input} />
        <input placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} style={input} />
        <input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} style={input} />
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={input} />
        <button type="submit" style={btn}>Alta repartidor</button>
      </form>
      {msg && <div style={{marginBottom: 14, color: C.green, fontSize: 13}}>{msg}</div>}
      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
        <thead><tr style={{color: C.muted, textAlign: 'left'}}><th style={th}>Nombre</th><th style={th}>PIN</th><th style={th}>Teléfono</th><th style={th}>Email</th><th style={th}>Combustible</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
        <tbody>
          {drivers.map(d => (
            <tr key={d.id} style={{borderTop: `1px solid ${C.border}`}}>
              <td style={td}>{d.name} {d.is_demo && <span style={{fontSize: 10, color: C.muted, background: C.panel2, borderRadius: 4, padding: '2px 6px'}}>demo · solo lectura</span>}</td>
              <td style={td}>{d.pin}</td>
              <td style={td}>{d.phone}</td>
              <td style={td}>{d.email || '—'}</td>
              <td style={td}>
                {d.is_demo ? (
                  <span style={{color: C.muted, fontSize: 12}}>{d.fuel_type || '—'}</span>
                ) : (
                  <select value={d.fuel_type || ''} onChange={e => authFetch(`${API_BASE}/drivers/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fuel_type: e.target.value }) }).then(loadAll)} style={{...input, padding: '4px 6px', fontSize: 12}}>
                    <option value="">—</option>
                    <option value="diesel">Diésel</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="electrico">Eléctrico</option>
                    <option value="hibrido">Híbrido</option>
                  </select>
                )}
              </td>
              <td style={td}>{d.active ? <span style={{color: C.green}}>Activo</span> : <span style={{color: C.muted}}>Inactivo</span>}</td>
              <td style={td}>
                {d.is_demo
                  ? <span style={{color: C.muted, fontSize: 12}}>🔒</span>
                  : <button onClick={() => toggle(d.id, d.active)} style={{...btn, padding: '6px 10px', fontSize: 12}}>{d.active ? 'Desactivar' : 'Activar'}</button>}
              </td>
            </tr>
          ))}
          {drivers.length === 0 && <tr><td style={td} colSpan={7} style={{color: C.muted}}>Sin repartidores.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StopsSection({ API_BASE, token, stops, drivers, driverName, filterDriver, setFilterDriver, filterStatus, setFilterStatus, from, setFrom, to, setTo, driversList, onDelete }) {
  const handleDelete = async (stopId) => {
    if (!confirm('¿Eliminar esta parada?')) return;
    try {
      const res = await authFetch(`${API_BASE}/stops/${stopId}`, { method: 'DELETE' });
      if (res.ok) onDelete();
      else alert('Error al eliminar');
    } catch (e) { alert('Error de conexión'); }
  }; 
  return (
    <div>
      <h2>Repartos</h2>
      <Filters driversList={driversList} filterDriver={filterDriver} setFilterDriver={setFilterDriver} filterStatus={filterStatus} setFilterStatus={setFilterStatus} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
        <thead><tr style={{color: C.muted, textAlign: 'left'}}><th style={th}>#</th><th style={th}>Dirección</th><th style={th}>Repartidor</th><th style={th}>Cliente</th><th style={th}>Estado</th><th style={th}>Fecha</th><th style={th}>POD</th><th style={th}>Bultos</th><th style={th}></th></tr></thead>
        <tbody>
          {stops.map(s => {
            const st = STATUS[s.status] || STATUS.pending;
            return (
              <tr key={s.id} style={{borderTop: `1px solid ${C.border}`}}>
                <td style={td}>#{s.stop_number}</td>
                <td style={td}>{s.address}</td>
                <td style={td}>{driverName(s.driver_id)}</td>
                <td style={td}>{s.receiver_name || '—'}</td>
                <td style={td}><span style={{color: st.color, fontWeight: 700}}>{st.label}</span></td>
                <td style={td}>{(s.created_at || '').slice(0, 10)}</td>
                <td style={td}>
                  {s.status === 'delivered' && (
                    <a href={`${API_BASE}/stops/${s.id}/pod?token=${token}`} target="_blank" rel="noreferrer" style={{color: C.accent, fontWeight: 700}}>POD</a>
                  )}
                </td>
                <td style={td}>
                  {s.items ? (() => { try { const items = JSON.parse(s.items).filter(i => i.checked); return items.length > 0 ? `${fmtNum(items.length)} bultos` : '—'; } catch { return '—'; } })() : '—'}
                </td>
                <td style={td}>
                  {s.is_demo
                    ? <span style={{color: C.muted, fontSize: 12}} title="Parada de la demo histórica (solo lectura)">🔒</span>
                    : <button onClick={() => handleDelete(s.id)} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '4px 8px'}} title="Eliminar parada">🗑️</button>}
                </td>
              </tr>
            );
          })}
          {stops.length === 0 && <tr><td style={{...td, color: C.muted}} colSpan={7}>Sin paradas.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SignaturesSection({ API_BASE, token, stops, drivers, driverName, filterDriver, setFilterDriver, from, setFrom, to, setTo, driversList }) {
  const delivered = stops.filter(s => s.status === 'delivered');
  return (
    <div>
      <h2>Firmas de clientes</h2>
      <Filters driversList={driversList} filterDriver={filterDriver} setFilterDriver={setFilterDriver} from={from} setFrom={setFrom} to={to} setTo={setTo} />
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 16}}>
        {delivered.map(s => (
          <div key={s.id} style={{background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14}}>
            <div style={{fontSize: 13, fontWeight: 700, marginBottom: 4}}>{s.receiver_name || 'Cliente'}</div>
            <div style={{fontSize: 11, color: C.muted, marginBottom: 8}}>{driverName(s.driver_id)} · {(s.created_at || '').slice(0, 10)}</div>
            <iframe title={`pod-${s.id}`} src={`${API_BASE}/stops/${s.id}/pod?token=${token}`} style={{width: '100%', height: 160, border: 'none', background: '#fff', borderRadius: 8}} />
            <a href={`${API_BASE}/stops/${s.id}/pod?token=${token}`} target="_blank" rel="noreferrer" style={{display: 'inline-block', marginTop: 8, color: C.accent, fontWeight: 700, fontSize: 12}}>Descargar PDF</a>
          </div>
        ))}
        {delivered.length === 0 && <div style={{color: C.muted}}>No hay firmas para este filtro.</div>}
      </div>
    </div>
  );
}

function Filters({ driversList, filterDriver, setFilterDriver, filterStatus, setFilterStatus, from, setFrom, to, setTo }) {
  return (
    <div style={{display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center'}}>
      <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} style={input}>
        <option value="">Todos los repartidores</option>
        {driversList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      {setFilterStatus && (
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={input}>
          <option value="">Todos los estados</option>
          <option value="delivered">Entregado</option>
          <option value="pending">Pendiente</option>
          <option value="incident">Incidencia</option>
        </select>
      )}
      <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={input} />
      <input type="date" value={to} onChange={e => setTo(e.target.value)} style={input} />
      {(filterDriver || filterStatus || from || to) && (
        <button onClick={() => { setFilterDriver(''); setFilterStatus && setFilterStatus(''); setFrom(''); setTo(''); }} style={{...btn, padding: '8px 12px', fontSize: 12}}>Limpiar</button>
      )}
    </div>
  );
}

const input = { padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 };
const btn = { padding: '10px 14px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' };

// Asistente técnico: chat que responde con la documentación real del proyecto.
// Reutilizado en el widget flotante (login) y en la pestaña Asistente de la Torre de Control.
function AssistantChat({ API_BASE }) {
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const enviar = async (e) => {
    e.preventDefault();
    const pregunta = q.trim();
    if (!pregunta || loading) return;
    setMsgs((m) => [...m, { role: 'user', text: pregunta }]);
    setQ('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: pregunta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsgs((m) => [...m, { role: 'bot', text: data.error || 'Algo falló, inténtalo de nuevo.', error: true }]);
      } else {
        const fuentes = data.fuentes?.length ? `\n\n📄 ${data.fuentes.join(' · ')}` : '';
        setMsgs((m) => [...m, { role: 'bot', text: data.respuesta + fuentes }]);
      }
    } catch (err) {
      setMsgs((m) => [...m, { role: 'bot', text: 'No se pudo contactar con el asistente. Inténtalo de nuevo.', error: true }]);
    }
    setLoading(false);
  };

  // Sugerencias de ejemplo (una sola ejecución, una pregunta cada vez)
  const sugerencias = [
    '¿Qué problema resuelve Route AI?',
    '¿Cómo funciona la firma digital y el POD?',
    '¿Por qué 2-opt y no IA para las rutas?',
    '¿Cómo se calcula el OPEX real?',
  ];

  return (
    <>
      <div ref={boxRef} style={{flex: 1, overflowY: 'auto', padding: 12, minHeight: 200, fontSize: 13, lineHeight: 1.5}}>
        {msgs.length === 0 && (
          <div style={{color: C.muted, fontSize: 12}}>
            <div style={{marginBottom: 10}}>Pregunta lo que quieras sobre el proyecto (arquitectura, decisiones, seguridad, tests...).</div>
            {sugerencias.map((s) => (
              <button key={s} onClick={() => { setQ(s); }} style={{display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: '8px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: 'pointer', fontSize: 12}}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{marginBottom: 10, textAlign: m.role === 'user' ? 'right' : 'left'}}>
            <div style={{display: 'inline-block', maxWidth: '85%', padding: '8px 12px', borderRadius: 10, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? C.accent : C.panel2, color: m.role === 'user' ? '#000' : C.text,
              border: m.role === 'user' ? 'none' : `1px solid ${C.border}`, fontSize: 13}}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{color: C.muted, fontSize: 12}}>Pensando…</div>}
      </div>
      <form onSubmit={enviar} style={{padding: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8}}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pregunta sobre el proyecto…" maxLength={500}
          style={{flex: 1, padding: '10px 12px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13}} />
        <button type="submit" disabled={loading} style={{...btn, padding: '10px 16px'}}>→</button>
      </form>
    </>
  );
}

// Widget flotante del asistente, visible en la pantalla de login (sin PIN).
function AssistantWidget({ API_BASE }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botón flotante */}
      <button onClick={() => setOpen(!open)}
        style={{position: 'fixed', right: 24, bottom: 24, zIndex: 1000, width: 60, height: 60, borderRadius: '50%', border: 'none',
          background: C.accent, color: '#000', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.4)'}}
        title="Asistente técnico: pregunta sobre el código de Route AI">💬</button>

      {/* Panel de chat */}
      {open && (
        <div style={{position: 'fixed', right: 24, bottom: 96, zIndex: 1000, width: 380, maxWidth: 'calc(100vw - 48px)', maxHeight: '70vh',
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
          <div style={{padding: '14px 16px', background: C.panel2, borderBottom: `1px solid ${C.border}`}}>
            <div style={{fontWeight: 900, fontSize: 14}}>💬 Asistente técnico de Route AI</div>
            <div style={{fontSize: 11, color: C.muted, marginTop: 2}}>Responde con la documentación, ADRs y decisiones reales del proyecto.</div>
          </div>
          <AssistantChat API_BASE={API_BASE} />
        </div>
      )}
    </>
  );
}

function SendRouteSection({ API_BASE, token, drivers, loadAll }) {
  const [selDriver, setSelDriver] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const fileRef = useRef(null);

  const handleSend = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setResult('❌ Selecciona un archivo'); return; }
    if (!selDriver) { setResult('❌ Selecciona un repartidor'); return; }
    setSending(true); setResult('⏳ Procesando albarán...');
    try {
      // Paso 1: OCR del archivo
      const formData = new FormData();
      formData.append('image', file);
      const ocrRes = await authFetch(`${API_BASE}/ocr`, { method: 'POST', body: formData });
      const ocrData = await ocrRes.json();
      if (!ocrData.success || !ocrData.addresses?.length) {
        setResult('❌ No se detectaron direcciones en el archivo');
        setSending(false); return;
      }
      // Paso 2: Crear paradas en bulk para el repartidor seleccionado
      const bulkRes = await authFetch(`${API_BASE}/stops/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: ocrData.addresses, items: ocrData.items || [], driver_id: Number(selDriver) })
      });
      const bulkData = await bulkRes.json();
      if (bulkData.success) {
        const driverName = drivers.find(d => String(d.id) === String(selDriver))?.name || `ID ${selDriver}`;
        const itemsCount = ocrData.items?.length || 0;
        setResult(`✅ ${bulkData.total} paradas enviadas a ${driverName}${itemsCount > 0 ? ` con ${itemsCount} bultos precargados` : ''}. Ya puede verlas en su app.`);
        fileRef.current.value = '';
        loadAll();
      } else {
        setResult('❌ Error al crear las paradas: ' + (bulkData.error || 'desconocido'));
      }
    } catch (err) {
      setResult('❌ Error de conexión: ' + err.message);
    }
    setSending(false);
  };

  return (
    <div>
      <h2>Enviar ruta a repartidor</h2>
      <p style={{color: C.muted, marginBottom: 20, fontSize: 13}}>
        Sube un albarán (imagen, PDF o CSV) y asígnaselo a un repartidor. Su app se actualizará automáticamente al iniciar sesión.
      </p>
      <div style={{background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20}}>
        <div style={{display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center'}}>
          <select value={selDriver} onChange={e => setSelDriver(e.target.value)} style={input}>
            <option value="">Seleccionar repartidor...</option>
            {drivers.filter(d => d.active).map(d => (
              <option key={d.id} value={d.id}>{d.name} (PIN: {d.pin})</option>
            ))}
          </select>
          <input type="file" ref={fileRef} accept="image/*,.pdf,.csv" style={{...input, flex: 1}} />
          <button onClick={handleSend} disabled={sending} style={{...btn, opacity: sending ? 0.6 : 1}}>
            {sending ? 'Enviando...' : 'Enviar Ruta'}
          </button>
        </div>
        {result && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: result.startsWith('✅') ? '#22c55e20' : result.startsWith('❌') ? '#ef444420' : '#f59e0b20',
            color: result.startsWith('✅') ? '#22c55e' : result.startsWith('❌') ? '#ef4444' : '#f59e0b'
          }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

