import React from 'react';

export default function LoginView({ onLogin, pin, setPin, theme, API_BASE }) {
  const C = theme === 'clasico'
    ? { bg: '#f4f6f8', panel: '#ffffff', border: '#d9dee3', text: '#1a2230', muted: '#6b7682', accent: '#f8cd00' }
    : { bg: '#0f1115', panel: '#171a21', border: '#272c36', text: '#e6e9ef', muted: '#8b93a1', accent: '#f8cd00' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: C.text }}>
      <img src="/logo.png" alt="Kavana Route AI" style={{ height: 80, marginBottom: 16, objectFit: 'contain' }} />
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: 22, letterSpacing: '-1px', color: C.accent }}>KAVANA</h1>
        <p style={{ margin: '4px 0 0', fontSize: 10, color: C.muted, fontWeight: 900, letterSpacing: 3 }}>ROUTE AI</p>
      </div>
      <p style={{ color: C.muted, marginBottom: 24, fontSize: 13, fontWeight: 600 }}>Torre de Control · Oficina</p>
      <form onSubmit={onLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        <input value={pin} onChange={e => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="PIN de oficina" style={{ padding: 16, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 22, textAlign: 'center', letterSpacing: 6 }} />
        <button type="submit" style={{ padding: 14, background: C.accent, color: '#000', border: 'none', borderRadius: 10, fontWeight: 900, cursor: 'pointer' }}>ENTRAR</button>
      </form>
      <p style={{ color: C.muted, marginTop: 20, fontSize: 12, maxWidth: 340, textAlign: 'center', lineHeight: 1.5 }}>💬 ¿Quieres saber cómo funciona este proyecto? Prueba el <strong style={{ color: C.text }}>asistente técnico</strong> (botón abajo): responde con la documentación real de Route AI.</p>
      <AssistantWidget API_BASE={API_BASE} />
    </div>
  );
}

function AssistantWidget({ API_BASE }) {
  const [open, setOpen] = useState(false);
  const C = { accent: '#f8cd00', panel: '#171a21', border: '#272c36', text: '#e6e9ef', muted: '#8b93a1' };

  return (
    <>
      <button onClick={() => setOpen(!open)} style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1000, width: 60, height: 60, borderRadius: '50%', border: 'none', background: C.accent, color: '#000', fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.4)' }} title="Asistente técnico: pregunta sobre el código de Route AI">💬</button>
      {open && (
        <div style={{ position: 'fixed', right: 24, bottom: 96, zIndex: 1000, width: 380, maxWidth: 'calc(100vw - 48px)', maxHeight: '70vh', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>💬 Asistente técnico de Route AI</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Responde con la documentación, ADRs y decisiones reales del proyecto.</div>
          </div>
          <AssistantChat API_BASE={API_BASE} />
        </div>
      )}
    </>
  );
}

function AssistantChat({ API_BASE }) {
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const C = { accent: '#f8cd00', panel: '#171a21', panel2: '#1f232c', border: '#272c36', text: '#e6e9ef', muted: '#8b93a1' };

  const enviar = async (e, prompt) => {
    if (e?.preventDefault) e.preventDefault();
    const pregunta = (prompt || q).trim();
    if (!pregunta || loading) return;
    setMsgs((m) => [...m, { role: 'user', text: pregunta }]);
    setQ('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: pregunta }) });
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
    <>
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
    </>
  );
}