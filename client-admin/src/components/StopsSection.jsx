import React, { useState, useEffect } from 'react';

export default function StopsSection({ C, STATUS, API_BASE, stops, drivers, driverName, filterDriver, setFilterDriver, filterStatus, setFilterStatus, from, setFrom, to, setTo, driversList, onDelete, fmtNum }) {
  const [visibleCount, setVisibleCount] = useState(200);
  useEffect(() => setVisibleCount(200), [filterDriver, filterStatus, from, to]);
  const visibleStops = stops.slice(0, visibleCount);

  const authFetch = async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, credentials: 'include', headers: { ...(opts.headers || {}) } });
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    return res;
  };

  const downloadPod = async (stopId, filename = 'pod.pdf') => {
    const res = await authFetch(`${API_BASE}/stops/${stopId}/pod`);
    if (!res.ok) throw new Error(`Error descargando POD (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleDelete = async (stopId) => {
    if (!confirm('¿Eliminar esta parada?')) return;
    try {
      const res = await authFetch(`${API_BASE}/stops/${stopId}`, { method: 'DELETE' });
      if (res.ok) onDelete(); else alert('Error al eliminar');
    } catch { alert('Error de conexión'); }
  };

  const Filters = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} style={{ padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }}>
        <option value="">Todos los repartidores</option>
        {driversList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }}>
        <option value="">Todos los estados</option>
        <option value="delivered">Entregado</option>
        <option value="pending">Pendiente</option>
        <option value="incident">Incidencia</option>
      </select>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }} />
      <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }} />
      {(filterDriver || filterStatus || from || to) && (
        <button onClick={() => { setFilterDriver(''); setFilterStatus(''); setFrom(''); setTo(''); }} style={{ padding: '8px 12px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>Limpiar</button>
      )}
    </div>
  );

  return (
    <div>
      <h2>Repartos</h2>
      <Filters />
      {stops.length > 200 && (
        <p style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Mostrando {Math.min(visibleCount, stops.length).toLocaleString('es-ES')} de {stops.length.toLocaleString('es-ES')} paradas. Usa los filtros para acotar.</p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>#</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Dirección</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Repartidor</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Cliente</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Estado</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Fecha</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>POD</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Bultos</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}></th></tr></thead>
        <tbody>
          {visibleStops.map(s => {
            const st = STATUS[s.status] || STATUS.pending;
            return (
              <tr key={s.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 8px' }}>#{s.stop_number}</td>
                <td style={{ padding: '10px 8px' }}>{s.address}</td>
                <td style={{ padding: '10px 8px' }}>{driverName(s.driver_id)}</td>
                <td style={{ padding: '10px 8px' }}>{s.receiver_name || '—'}</td>
                <td style={{ padding: '10px 8px' }}><span style={{ color: st.color, fontWeight: 700 }}>{st.label}</span></td>
                <td style={{ padding: '10px 8px' }}>{(s.created_at || '').slice(0, 10)}</td>
                <td style={{ padding: '10px 8px' }}>
                  {s.status === 'delivered' && (
                    <a href="#" onClick={(e) => { e.preventDefault(); downloadPod(s.id, `pod-${s.stop_number}.pdf`).catch(() => alert('Error descargando POD')); }} style={{ color: C.accent, fontWeight: 700 }}>POD</a>
                  )}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  {s.items ? (() => { try { const items = JSON.parse(s.items).filter(i => i.checked); return items.length > 0 ? `${fmtNum(items.length)} bultos` : '—'; } catch { return '—'; } })() : '—'}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  {s.is_demo ? <span style={{ color: C.muted, fontSize: 12 }} title="Parada de la demo histórica (solo lectura)">🔒</span> : <button onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '4px 8px' }} title="Eliminar parada">🗑️</button>}
                </td>
              </tr>
            );
          })}
          {visibleStops.length === 0 && <tr><td style={{ padding: '10px 8px', color: C.muted }} colSpan={7}>Sin paradas.</td></tr>}
        </tbody>
      </table>
      {visibleCount < stops.length && (
        <button onClick={() => setVisibleCount(c => c + 500)} style={{ marginTop: 12, padding: '10px 18px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Mostrar más paradas</button>
      )}
    </div>
  );
}