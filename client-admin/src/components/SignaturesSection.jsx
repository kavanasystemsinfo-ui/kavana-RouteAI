import React, { useState, useEffect } from 'react';

export default function SignaturesSection({ C, STATUS, API_BASE, stops, drivers, driverName, filterDriver, setFilterDriver, from, setFrom, to, setTo, driversList, fmtNum }) {
  const delivered = stops.filter(s => s.status === 'delivered');
  const [visibleCount, setVisibleCount] = useState(100);
  useEffect(() => setVisibleCount(100), [filterDriver, from, to]);
  const visibleDelivered = delivered.slice(0, visibleCount);

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

  const Filters = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} style={{ padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }}>
        <option value="">Todos los repartidores</option>
        {driversList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }} />
      <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }} />
      {(filterDriver || from || to) && (
        <button onClick={() => { setFilterDriver(''); setFrom(''); setTo(''); }} style={{ padding: '8px 12px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>Limpiar</button>
      )}
    </div>
  );

  return (
    <div>
      <h2>Firmas de clientes</h2>
      <Filters />
      {delivered.length > 100 && (
        <p style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Mostrando {Math.min(visibleCount, delivered.length).toLocaleString('es-ES')} de {delivered.length.toLocaleString('es-ES')} firmas. Usa los filtros para acotar.</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
        {visibleDelivered.map(s => (
          <div key={s.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{s.receiver_name || 'Cliente'}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{driverName(s.driver_id)} · {(s.created_at || '').slice(0, 10)}</div>
            <PodFrame API_BASE={API_BASE} stopId={s.id} C={C} />
            <a href="#" onClick={(e) => { e.preventDefault(); downloadPod(s.id, `pod-${s.stop_number}.pdf`).catch(() => alert('Error descargando POD')); }} style={{ display: 'inline-block', marginTop: 8, color: C.accent, fontWeight: 700, fontSize: 12 }}>Descargar PDF</a>
          </div>
        ))}
        {delivered.length === 0 && <div style={{ color: C.muted }}>No hay firmas para este filtro.</div>}
      </div>
      {visibleCount < delivered.length && (
        <button onClick={() => setVisibleCount(c => c + 200)} style={{ marginTop: 16, padding: '10px 18px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Mostrar más firmas</button>
      )}
    </div>
  );
}

function PodFrame({ API_BASE, stopId, C }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = null;
    let cancelled = false;
    const authFetch = async (url, opts = {}) => {
      const res = await fetch(url, { ...opts, credentials: 'include', headers: { ...(opts.headers || {}) } });
      if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
      return res;
    };
    authFetch(`${API_BASE}/stops/${stopId}/pod`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [stopId, API_BASE]);

  const skeleton = { width: '100%', background: '#6662', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 };
  return src
    ? <iframe title={`pod-${stopId}`} src={src} style={{ width: '100%', height: 160, border: 'none', background: '#fff', borderRadius: 8 }} />
    : <div style={{ ...skeleton, height: 160 }}>Cargando POD…</div>;
}