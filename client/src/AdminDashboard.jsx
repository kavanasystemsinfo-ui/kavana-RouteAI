import React, { useState, useEffect } from 'react';
import { Truck, AlertTriangle, CheckCircle, Clock, FileText, Download, Settings, Save, DollarSign } from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:5001/api`;

const AdminDashboard = () => {
  const [data, setData] = useState({ stops: [], metrics: { total: 0, delivered: 0, incidents: 0 }, settings: {} });
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [formSettings, setFormSettings] = useState({ cost_per_km: 0.45, cost_per_hour: 15.00 });

  const fetchData = async () => {
    try {
      const [stopsRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/stops`),
        fetch(`${API_BASE}/settings`)
      ]);
      
      if (!stopsRes.ok || !settingsRes.ok) throw new Error('Fallo en la respuesta del servidor');

      const stops = await stopsRes.json();
      const settings = await settingsRes.json();
      
      const metrics = {
        total: stops.length,
        delivered: stops.filter(s => s.status === 'delivered').length,
        incidents: stops.filter(s => s.status === 'incident').length
      };

      setData({ stops, metrics, settings: settings || { cost_per_km: 0.45, cost_per_hour: 15.00 } });
      setFormSettings(settings || { cost_per_km: 0.45, cost_per_hour: 15.00 });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const saveSettings = async () => {
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSettings)
      });
      setShowSettings(false);
      fetchData(); // Refrescar costes
    } catch(err) { console.error(err); }
  };

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

  if (loading) return <div style={{backgroundColor: '#000', color: '#FF3D00', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: "'Inter', sans-serif", fontWeight: '900'}}>INICIANDO TORRE DE CONTROL...</div>;

  // Cálculos Financieros Logísticos (Modelo Vehículo + Tiempo)
  const totalDistance = data.stops.reduce((acc, s) => acc + parseDistance(s.distance), 0);
  const totalHours = data.stops.reduce((acc, s) => acc + parseTime(s.estimated_time), 0);
  
  const costPerKm = data.settings?.cost_per_km || 0.45;
  const costPerHour = data.settings?.cost_per_hour || 15.00;
  
  // Coste Total = (Distancia * €/km) + (Horas * €/hora)
  const currentOpex = ((totalDistance * costPerKm) + (totalHours * costPerHour)).toFixed(2);

  return (
    <div style={{backgroundColor: '#050505', minHeight: '100vh', color: '#fff', fontFamily: "'Inter', sans-serif", padding: '40px'}}>
      
      {/* Header Corporativo */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <img src="/logo.png" alt="Kavana Logo" style={{height: '60px', width: 'auto'}} />
          <div>
            <h1 style={{margin: 0, fontSize: '32px', fontWeight: '900', color: '#FF3D00', letterSpacing: '-1px'}}>KAVANA LOGISTICS</h1>
            <h2 style={{margin: 0, fontSize: '14px', color: '#666', fontWeight: '800', letterSpacing: '2px'}}>TORRE DE CONTROL DE DESPACHO</h2>
          </div>
        </div>
        <div style={{display: 'flex', gap: '16px'}}>
          <button onClick={() => setShowSettings(!showSettings)} style={{backgroundColor: '#222', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s'}}>
            <Settings size={20} />
          </button>
          <div style={{backgroundColor: '#111', padding: '12px 24px', borderRadius: '12px', border: '1px solid #333', display: 'flex', gap: '10px', alignItems: 'center'}}>
            <div style={{width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e'}}></div>
            <span style={{fontSize: '12px', fontWeight: '800', letterSpacing: '1px'}}>SISTEMA EN DIRECTO</span>
          </div>
        </div>
      </div>

      {/* Panel de Ajustes (Toggle) */}
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
            <Save size={18} /> ACTUALIZAR MODELO DE COSTE
          </button>
        </div>
      )}

      {/* KPIs (Métricas) */}
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

      {/* Tabla de Paradas */}
      <div style={{backgroundColor: '#111', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{backgroundColor: '#0a0a0a', borderBottom: '1px solid #222'}}>
            <tr>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>Nº PARADA</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>DIRECCIÓN</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>DISTANCIA / TIEMPO</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px'}}>ESTADO</th>
              <th style={{padding: '20px', fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', textAlign: 'right'}}>DOCUMENTOS</th>
            </tr>
          </thead>
          <tbody>
            {data.stops.map((stop, idx) => (
              <tr key={idx} style={{borderBottom: '1px solid #222', backgroundColor: idx % 2 === 0 ? '#111' : '#141414'}}>
                <td style={{padding: '20px', fontWeight: '900', color: '#FF3D00'}}>#{stop.stop_number}</td>
                <td style={{padding: '20px', fontWeight: '600', fontSize: '14px'}}>{stop.address}</td>
                <td style={{padding: '20px', fontWeight: '600', fontSize: '14px', color: '#888'}}>
                  {stop.distance || '0 km'} <br/>
                  <span style={{fontSize: '12px', color: '#555'}}>{stop.estimated_time || '0 min'}</span>
                </td>
                <td style={{padding: '20px'}}>{getStatusBadge(stop.status)}</td>
                <td style={{padding: '20px', textAlign: 'right'}}>
                  {stop.pod_url && (
                    <a href={stop.pod_url} target="_blank" rel="noreferrer" style={{
                      backgroundColor: '#222', color: '#fff', textDecoration: 'none', padding: '8px 16px', 
                      borderRadius: '8px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '8px',
                      transition: 'background 0.2s', border: '1px solid #333'
                    }}>
                      <Download size={14} /> DESCARGAR POD
                    </a>
                  )}
                  {stop.incidents && stop.incidents.length > 0 && (
                    <button style={{
                      backgroundColor: '#ef444420', color: '#ef4444', border: '1px solid #ef444450',
                      padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '8px',
                      marginLeft: '10px', cursor: 'pointer'
                    }}>
                      <FileText size={14} /> VER INCIDENCIA
                    </button>
                  )}
                  {(!stop.pod_url && (!stop.incidents || stop.incidents.length === 0)) && (
                    <span style={{color: '#444', fontSize: '12px', fontWeight: '800'}}>- N/A -</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default AdminDashboard;
