import React, { useState, useRef } from 'react';

export default function SendRouteSection({ C, API_BASE, drivers, refresh, getSessionId }) {
  const [selDriver, setSelDriver] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const fileRef = useRef(null);

  const authFetch = async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, credentials: 'include', headers: { ...(opts.headers || {}) } });
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    return res;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setResult('❌ Selecciona un archivo'); return; }
    if (!selDriver) { setResult('❌ Selecciona un repartidor'); return; }
    setSending(true); setResult('⏳ Procesando albarán...');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const ocrRes = await authFetch(`${API_BASE}/ocr`, { method: 'POST', body: formData });
      const ocrData = await ocrRes.json();
      if (!ocrData.success || !ocrData.addresses?.length) {
        setResult('❌ No se detectaron direcciones en el archivo');
        setSending(false); return;
      }
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
        refresh();
      } else {
        setResult('❌ Error al crear las paradas: ' + (bulkData.error || 'desconocido'));
      }
    } catch (err) {
      setResult('❌ Error de conexión: ' + err.message);
    }
    setSending(false);
  };

  const input = { padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 };
  const btn = { padding: '10px 14px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' };

  return (
    <div>
      <h2>Enviar ruta a repartidor</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>
        Sube un albarán (imagen, PDF o CSV) y asígnaselo a un repartidor. Su app se actualizará automáticamente al iniciar sesión.
      </p>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selDriver} onChange={e => setSelDriver(e.target.value)} style={input}>
            <option value="">Seleccionar repartidor...</option>
            {drivers.filter(d => d.active).map(d => (
              <option key={d.id} value={d.id}>{d.name} (PIN: {d.pin})</option>
            ))}
          </select>
          <input type="file" ref={fileRef} accept="image/*,.pdf,.csv" style={{ ...input, flex: 1 }} />
          <button onClick={handleSend} disabled={sending} style={{ ...btn, opacity: sending ? 0.6 : 1 }}>
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