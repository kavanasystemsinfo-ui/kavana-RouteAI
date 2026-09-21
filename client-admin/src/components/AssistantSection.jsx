import React, { useState, useRef } from 'react';

export default function AssistantSection({ C, API_BASE }) {
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const authFetch = async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, credentials: 'include', headers: { ...(opts.headers || {}) } });
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    return res;
  };

  const enviar = async (e, prompt) => {
    if (e?.preventDefault) e.preventDefault();
    const pregunta = (prompt || q).trim();
    if (!pregunta || loading) return;
    setMsgs((m) => [...m, { role: 'user', text: pregunta }]);
    setQ('');
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: pregunta })
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

  const sugerencias = [
    '¿Qué problema resuelve Route AI y para quién?',
    '¿Cuántos tests tiene el proyecto y qué cubren?',
    '¿Cómo está desplegado el sistema?',
    '¿Por qué 2-opt y no IA para las rutas?',
    '¿Cómo se gestiona la seguridad y los permisos?',
    '¿Cómo funciona la firma digital del cliente (POD)?',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 420 }}>
      <h2 style={{ marginTop: 0 }}>Asistente técnico</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Responde con la documentación, ADRs y decisiones reales del proyecto. Perfecto para que un reclutador pregunte cómo funciona Route AI sin necesidad de conocer el código.</p>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>💬 Asistente técnico de Route AI</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Responde con la documentación, ADRs y decisiones reales del proyecto.</div>
        </div>
        <div ref={boxRef} style={{ flex: 1, overflowY: 'auto', padding: 12, minHeight: 200, fontSize: 13, lineHeight: 1.5 }}>
          {msgs.length === 0 && (
            <div style={{ color: C.muted, fontSize: 12 }}>
              <div style={{ marginBottom: 10 }}>Pregunta lo que quieras sobre el proyecto (arquitectura, decisiones, seguridad, tests...).</div>
              {sugerencias.map((s) => (
                <button key={s} onClick={() => enviar(undefined, s)} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: '8px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: 'pointer', fontSize: 12 }}>{s}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} style={{ marginBottom: 10, textAlign: m.role === 'user' ? 'right' : 'left' }}>
              <div style={{ display: 'inline-block', maxWidth: '85%', padding: '8px 12px', borderRadius: 10, whiteSpace: 'pre-wrap', background: m.role === 'user' ? C.accent : C.panel2, color: m.role === 'user' ? '#000' : C.text, border: m.role === 'user' ? 'none' : `1px solid ${C.border}`, fontSize: 13 }}>{m.text}</div>
            </div>
          ))}
          {loading && <div style={{ color: C.muted, fontSize: 12 }}>Pensando…</div>}
        </div>
        <form onSubmit={enviar} style={{ padding: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pregunta sobre el proyecto…" maxLength={500} style={{ flex: 1, padding: '10px 12px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 }} />
          <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>→</button>
        </form>
      </div>
    </div>
  );
}