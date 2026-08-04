import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, AlertTriangle, CheckCircle, Clock, FileText, Download, 
  Settings, Save, DollarSign, Users, UserPlus, LogOut, Upload,
  Shield, UserX, UserCheck, Search
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : `https://routeai-api.onrender.com/api`;

// Auth fetch helper
function officeFetch(url, opts = {}) {
  const token = localStorage.getItem('routeai_office_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(url, { ...opts, headers });
}

const AdminDashboard = () => {
  // --- Auth state ---
  const [token, setToken] = useState(() => localStorage.getItem('routeai_office_token') || '');
  const [showLogin, setShowLogin] = useState(() => !localStorage.getItem('routeai_office_token'));

  // --- Data state ---
  const [data, setData] = useState({ stops: [], metrics: { total: 0, delivered: 0, incidents: 0 }, settings: {} });
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDrivers, setShowDrivers] = useState(false);
  const [formSettings, setFormSettings] = useState({ cost_per_km: 0.45, cost_per_hour: 15.00 });

  // --- Driver form ---
  const [newDriver, setNewDriver] = useState({ name: '', pin: '', email: '', phone: '' });
  const fileInputRef = useRef(null);

  // --- Login ---
  const handleLogin = async (pin) => {
    try {
      const res = await fetch(`${API_BASE}/office/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'PIN incorrecto');
        return;
      }
      const { token: newToken } = await res.json();
      localStorage.setItem('routeai_office_token', newToken);
      setToken(newToken);
      setShowLogin(false);
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('routeai_office_token');
    setToken('');
    setShowLogin(true);
  };

  // --- Data fetching ---
  const fetchAll = async () => {
    if (!token) return;
    try {
      const [stopsRes, settingsRes, driversRes] = await Promise.all([
        officeFetch(`${API_BASE}/stops?driver_id=${selectedDriver !== 'all' ? selectedDriver : ''}`),
        officeFetch(`${API_BASE}/settings`),
        officeFetch(`${API_BASE}/drivers`)
      ]);
      const stops = stopsRes.ok ? await stopsRes.json() : [];
      const settings = settingsRes.ok ? await settingsRes.json() : { cost_per_km: 0.45, cost_per_hour: 15.00 };
      const drvs = driversRes.ok ? await driversRes.json() : [];
      const delivered = stops.filter(s => s.status === 'delivered').length;
      const pending = stops.filter(s => s.status === 'pending').length;
      const incidents = stops.filter(s => s.status === 'incident').length;
      setData({ stops, metrics: { total: stops.length, delivered, pending, incidents }, settings });
      setDrivers(drvs);
      setFormSettings(settings || { cost_per_km: 0.45, cost_per_hour: 15.00 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [token, selectedDriver]);

  // --- Settings ---
  const saveSettings = async () => {
    await officeFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formSettings)
    });
    setShowSettings(false);
    fetchAll();
  };

  // --- Driver CRUD ---
  const addDriver = async (e) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.pin) {
      alert('Nombre y PIN son obligatorios');
      return;
    }
    const res = await officeFetch(`${API_BASE}/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDriver)
    });
    if (res.ok) {
      setNewDriver({ name: '', pin: '', email: '', phone: '' });
      fetchAll();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Error al crear repartidor');
    }
  };

  const toggleDriverActive = async (id, active) => {
    await officeFetch(`${API_BASE}/drivers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active })
    });
    fetchAll();
  };

  // --- Upload albaran for driver ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (selectedDriver === 'all') {
      alert('Selecciona un repartidor primero antes de subir un albarán');
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    formData.append('driver_id', selectedDriver);
    try {
      const res = await officeFetch(`${API_BASE}/ocr`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.addresses?.length > 0) {
        // Create stops in bulk for the selected driver
        const bulkRes = await officeFetch(`${API_BASE}/stops/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: data.addresses, driver_id: Number(selectedDriver) })
        });
        if (bulkRes.ok) {
          alert(`Ruta cargada: ${data.addresses.length} paradas asignadas`);
          fetchAll();
        }
      } else {
        alert('No se detectaron direcciones en el archivo');
      }
    } catch (err) {
      alert('Error al procesar el archivo');
    }
    e.target.value = '';
  };

  // --- Helpers ---
  const parseDistance = (distStr) => {
    if (!distStr) return 0;
    const match = distStr.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    let hours = 0;
    const hMatch = timeStr.match(/(\d+)\s*(hora|h|hour)/i);
    if (hMatch) hours += parseInt(hMatch[1]);
    const mMatch = timeStr.match(/(\d+)\s*(min|m)/i);
    if (mMatch) hours += parseInt(mMatch[1]) / 60;
    return hours;
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'delivered': return <span style={{backgroundColor: '#22c55e20', color: '#22c55e', padding: '6px 12px', borderRadius: '20px', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content'}}><CheckCircle size={14}/> ENTREGADO</span>;
      case 'incident': return <span style={{backgroundColor: '#ef444420', color: '#ef4444', padding: '6px 12px', borderRadius: '20px', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content'}}><AlertTriangle size={14}/> INCIDENCIA</span>;
      default: return <span style={{backgroundColor: '#f59e0b20', color: '#f59e0b', padding: '6px 12px', borderRadius: '20px', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content'}}><Clock size={14}/> PENDIENTE</span>;
    }
  };

  // --- Login screen ---
  if (showLogin) {
    return (
      <div style={{position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 20000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Inter', sans-serif"}}>
        <img src="logo.png" alt="Kavana Route AI" style={{height: '60px', marginBottom: '32px'}} />
        <h2 style={{color: '#FF3D00', fontSize: '16px', fontWeight: '900', letterSpacing: '1px', marginBottom: '8px'}}>TORRE DE CONTROL</h2>
        <p style={{color: '#666', fontSize: '12px', marginBottom: '24px', textAlign: 'center'}}>PIN de oficina</p>
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(e.target.pin.value); }} style={{display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px'}}>
          <input name="pin" type="password" inputMode="numeric" autoFocus placeholder="••••" style={{padding: '18px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '12px', color: '#fff', fontSize: '24px', textAlign: 'center', letterSpacing: '8px', fontWeight: '900', outline: 'none'}} />
          <button type="submit" style={{padding: '18px', backgroundColor: '#FF3D00', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer'}}>ENTRAR</button>
        </form>
      </div>
    );
  }

  if (loading) return <div style={{backgroundColor: '#000', color: '#FF3D00', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: "'Inter', sans-serif", fontWeight: '900'}}>INICIANDO TORRE DE CONTROL...</div>;

  // Cálculos Financieros
  const totalDistance = data.stops.reduce((acc, s) => acc + parseDistance(s.distance), 0);
  const totalHours = data.stops.reduce((acc, s) => acc + parseTime(s.estimated_time), 0);
  const costPerKm = data.settings?.cost_per_km || 0.45;
  const costPerHour = data.settings?.cost_per_hour || 15.00;
  const currentOpex = ((totalDistance * costPerKm) + (totalHours * costPerHour)).toFixed(2);

  return (
    <div style={{backgroundColor: '#050505', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif", padding: '40px'}}>
      
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <img src="logo.png" alt="Kavana Logo" style={{height: '60px', width: 'auto'}} />
          <div>
            <h1 style={{margin: 0, fontSize: '32px', fontWeight: '900', color: '#FF3D00', letterSpacing: '-1px'}}>KAVANA ROUTE AI</h1>
            <h2 style={{margin: 0, fontSize: '14px', color: '#666', fontWeight: '800', letterSpacing: '2px'}}>TORRE DE CONTROL DE DESPACHO</h2>
          </div>
        </div>
        <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
          <button onClick={() => setShowSettings(!showSettings)} style={{backgroundColor: '#222', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer'}}>
            <Settings size={20} />
          </button>
          <button onClick={() => setShowDrivers(!showDrivers)} style={{backgroundColor: '#222', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer'}}>
            <Users size={20} />
          </button>
          <div style={{backgroundColor: '#111', padding: '12px 24px', borderRadius: '12px', border: '1px solid #333', display: 'flex', gap: '10px', alignItems: 'center'}}>
            <div style={{width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e'}}></div>
            <span style={{fontSize: '12px', fontWeight: '800', letterSpacing: '1px'}}>SISTEMA EN DIRECTO</span>
          </div>
          <button onClick={handleLogout} style={{backgroundColor: '#222', border: '1px solid #333', color: '#FF3D00', padding: '12px', borderRadius: '12px', cursor: 'pointer'}}>
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{backgroundColor: '#111', border: '1px solid #333', borderRadius: '16px', padding: '24px', marginBottom: '40px', display: 'flex', gap: '20px', alignItems: 'flex-end'}}>
          <div style={{flex: 1}}>
            <label style={{fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: '8px'}}>COSTE DE TRANSPORTE (€ / Km)</label>
            <input type="number" step="0.01" value={formSettings.cost_per_km} onChange={e => setFormSettings({...formSettings, cost_per_km: e.target.value})} style={{width: '100%', padding: '16px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: '800', outline: 'none'}} />
          </div>
          <div style={{flex: 1}}>
            <label style={{fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: '8px'}}>SUELDO OPERARIO (€ / Hora)</label>
            <input type="number" step="0.01" value={formSettings.cost_per_hour} onChange={e => setFormSettings({...formSettings, cost_per_hour: e.target.value})} style={{width: '100%', padding: '16px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: '800', outline: 'none'}} />
          </div>
          <button onClick={saveSettings} style={{backgroundColor: '#FF3D00', color: '#000', padding: '16px 32px', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', height: 'fit-content'}}>
            <Save size={18} /> ACTUALIZAR
          </button>
        </div>
      )}

      {/* Drivers Panel */}
      {showDrivers && (
        <div style={{backgroundColor: '#111', border: '1px solid #333', borderRadius: '16px', padding: '24px', marginBottom: '40px'}}>
          <h3 style={{fontSize: '14px', fontWeight: '900', color: '#FF3D00', letterSpacing: '1px', marginBottom: '20px'}}>
            <Users size={18} style={{display: 'inline', marginRight: '8px', verticalAlign: 'middle'}} />
            GESTIÓN DE REPARTIDORES
          </h3>

          {/* Add driver form */}
          <form onSubmit={addDriver} style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '12px', marginBottom: '24px', alignItems: 'end'}}>
            <div>
              <label style={{fontSize: '10px', fontWeight: '900', color: '#666', display: 'block', marginBottom: '6px'}}>NOMBRE</label>
              <input value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Nombre" style={{width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', outline: 'none'}} />
            </div>
            <div>
              <label style={{fontSize: '10px', fontWeight: '900', color: '#666', display: 'block', marginBottom: '6px'}}>PIN</label>
              <input value={newDriver.pin} onChange={e => setNewDriver({...newDriver, pin: e.target.value})} type="password" inputMode="numeric" placeholder="0000" maxLength={6} style={{width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', outline: 'none', letterSpacing: '4px'}} />
            </div>
            <div>
              <label style={{fontSize: '10px', fontWeight: '900', color: '#666', display: 'block', marginBottom: '6px'}}>EMAIL (opcional)</label>
              <input value={newDriver.email} onChange={e => setNewDriver({...newDriver, email: e.target.value})} placeholder="repartidor@empresa.com" style={{width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', outline: 'none'}} />
            </div>
            <div>
              <label style={{fontSize: '10px', fontWeight: '900', color: '#666', display: 'block', marginBottom: '6px'}}>TELÉFONO</label>
              <input value={newDriver.phone} onChange={e => setNewDriver({...newDriver, phone: e.target.value})} placeholder="600123456" style={{width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', outline: 'none'}} />
            </div>
            <button type="submit" style={{backgroundColor: '#FF3D00', color: '#000', border: 'none', borderRadius: '8px', padding: '12px 20px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <UserPlus size={16} /> AÑADIR
            </button>
          </form>

          {/* Drivers list */}
          <div style={{maxHeight: '300px', overflowY: 'auto'}}>
            {drivers.length === 0 ? (
              <p style={{color: '#444', textAlign: 'center', padding: '20px'}}>No hay repartidores registrados</p>
            ) : (
              drivers.map(d => (
                <div key={d.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #222', backgroundColor: '#0a0a0a', marginBottom: '4px', borderRadius: '8px'}}>
                  <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
                    <div style={{width: '40px', height: '40px', borderRadius: '50%', backgroundColor: d.active ? '#FF3D0020' : '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${d.active ? '#FF3D00' : '#666'}`}}>
                      <Truck size={20} color={d.active ? '#FF3D00' : '#666'} />
                    </div>
                    <div>
                      <div style={{fontWeight: '800', fontSize: '14px'}}>
                        {d.name}
                        {!d.active && <span style={{color: '#666', marginLeft: '8px', fontSize: '11px'}}>(DESACTIVADO)</span>}
                      </div>
                      <div style={{color: '#666', fontSize: '11px'}}>PIN: {d.pin} {d.email ? `· ${d.email}` : ''} {d.phone ? `· ${d.phone}` : ''}</div>
                    </div>
                  </div>
                  <button onClick={() => toggleDriverActive(d.id, d.active)} style={{
                    backgroundColor: d.active ? '#ef444420' : '#22c55e20',
                    color: d.active ? '#ef4444' : '#22c55e',
                    border: `1px solid ${d.active ? '#ef444450' : '#22c55e50'}`,
                    padding: '8px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '11px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {d.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    {d.active ? 'DESACTIVAR' : 'ACTIVAR'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Driver filter + upload bar */}
      <div style={{display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center'}}>
        <div style={{flex: 1, display: 'flex', gap: '12px', alignItems: 'center'}}>
          <select 
            value={selectedDriver} 
            onChange={e => setSelectedDriver(e.target.value)}
            style={{
              padding: '12px 16px', backgroundColor: '#111', border: '1px solid #333', 
              borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: '700', outline: 'none',
              minWidth: '200px'
            }}
          >
            <option value="all">Todos los repartidores</option>
            {drivers.filter(d => d.active).map(d => (
              <option key={d.id} value={d.id}>{d.name} (PIN: {d.pin})</option>
            ))}
          </select>
        </div>
        {selectedDriver !== 'all' && (
          <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.csv,application/pdf,text/csv"
              onChange={handleFileUpload}
              style={{display: 'none'}}
            />
            <button onClick={() => fileInputRef.current?.click()} style={{
              backgroundColor: '#111', color: '#FF3D00', border: '1px solid #FF3D0040',
              padding: '12px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <Upload size={16} /> ENVIAR RUTA A REPARTIDOR
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px'}}>
        {[
          { label: 'COSTE TOTAL RUTA (OPEX)', value: `${currentOpex} €`, icon: <DollarSign size={24} color="#FF3D00" /> },
          { label: 'TOTAL PARADAS', value: data.metrics.total, icon: <Truck size={24} color="#666" /> },
          { label: 'ENTREGADOS', value: data.metrics.delivered, icon: <CheckCircle size={24} color="#22c55e" /> },
          { label: 'INCIDENCIAS', value: data.metrics.incidents, icon: <AlertTriangle size={24} color="#ef4444" /> }
        ].map((kpi, idx) => (
          <div key={idx} style={{backgroundColor: '#111', border: '1px solid #222', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <div style={{fontSize: '10px', color: '#666', fontWeight: '900', letterSpacing: '1px', marginBottom: '8px'}}>{kpi.label}</div>
              <div style={{fontSize: '36px', fontWeight: '900', color: idx === 0 ? '#FF3D00' : '#fff'}}>{kpi.value}</div>
            </div>
            <div style={{backgroundColor: '#1a1a1a', padding: '16px', borderRadius: '12px'}}>
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Stops Table */}
      <div style={{backgroundColor: '#111', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{backgroundColor: '#0a0a0a', borderBottom: '1px solid #222'}}>
            <tr>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>Nº PARADA</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>REPARTIDOR</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>DIRECCIÓN</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>DIST. / TIEMPO</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>ESTADO</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', textAlign: 'right'}}>DOCUMENTOS</th>
            </tr>
          </thead>
          <tbody>
            {data.stops.length === 0 ? (
              <tr>
                <td colSpan={6} style={{padding: '60px', textAlign: 'center', color: '#444'}}>
                  <Truck size={48} style={{marginBottom: '16px', opacity: 0.2}} />
                  <div style={{fontSize: '14px', fontWeight: '800'}}>No hay paradas cargadas</div>
                  <div style={{fontSize: '11px', marginTop: '8px'}}>Sube un albarán desde la app del repartidor o desde aquí</div>
                </td>
              </tr>
            ) : (
              data.stops.map((stop, idx) => {
                const driver = drivers.find(d => d.id === stop.driver_id);
                return (
                  <tr key={idx} style={{borderBottom: '1px solid #222', backgroundColor: idx % 2 === 0 ? '#111' : '#141414'}}>
                    <td style={{padding: '20px', fontWeight: '900', color: '#FF3D00'}}>#{stop.stop_number}</td>
                    <td style={{padding: '20px', fontWeight: '600', fontSize: '13px'}}>
                      {driver ? driver.name : (stop.driver_id ? `ID ${stop.driver_id}` : '—')}
                    </td>
                    <td style={{padding: '20px', fontWeight: '600', fontSize: '14px'}}>{stop.address}</td>
                    <td style={{padding: '20px', fontWeight: '600', fontSize: '14px', color: '#888'}}>
                      {stop.distance || '0 km'} <br/>
                      <span style={{fontSize: '12px', color: '#555'}}>{stop.estimated_time || '0 min'}</span>
                    </td>
                    <td style={{padding: '20px'}}>{getStatusBadge(stop.status)}</td>
                    <td style={{padding: '20px', textAlign: 'right'}}>
                      {stop.pod_url && (
                        <a href={stop.pod_url.startsWith('/') ? API_BASE + stop.pod_url : stop.pod_url} target="_blank" rel="noreferrer" style={{
                          backgroundColor: '#222', color: '#fff', textDecoration: 'none', padding: '8px 16px', 
                          borderRadius: '8px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '8px',
                          border: '1px solid #333'
                        }}>
                          <Download size={14} /> DESCARGAR POD
                        </a>
                      )}
                      {(!stop.pod_url) && (
                        <span style={{color: '#444', fontSize: '12px', fontWeight: '800'}}>- N/A -</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
