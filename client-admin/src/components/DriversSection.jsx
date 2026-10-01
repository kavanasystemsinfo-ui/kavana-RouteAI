import React, { useState, useEffect } from 'react';

export default function DriversSection({ C, API_BASE, drivers, refresh, getSessionId }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  const authFetch = async (url, opts = {}) => {
    const res = await fetch(url, {
      ...opts,
      credentials: 'include',
      headers: { ...(opts.headers || {}) }
    });
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    return res;
  };

  const add = async (e) => {
    e.preventDefault();
    setMsg('');
    const res = await authFetch(`${API_BASE}/drivers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, pin, phone, email, session_id: getSessionId() }) });
    const data = await res.json().catch(() => ({}));
    setName(''); setPin(''); setPhone(''); setEmail(''); refresh();
    if (data.emailSent) setMsg(`Email de bienvenida enviado a ${email}`);
    else if (data.emailDev) setMsg(`Repartidor creado. (modo dev: email no enviado - falta SMTP en el servidor)`);
  };

  const toggle = async (id, active) => {
    await authFetch(`${API_BASE}/drivers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }) });
    refresh();
  };

  const input = { padding: '8px 10px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13 };
  const btn = { padding: '10px 14px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' };

  return (
    <div>
      <h2>Repartidores</h2>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} style={input} />
        <input placeholder="PIN" value={pin} onChange={e => setPin(e.target.value)} style={input} />
        <input placeholder="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} style={input} />
        <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={input} />
        <button type="submit" style={btn}>Alta repartidor</button>
      </form>
      {msg && <div style={{ marginBottom: 14, color: C.green, fontSize: 13 }}>{msg}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Nombre</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>PIN</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Teléfono</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Email</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Combustible</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Estado</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}></th></tr></thead>
        <tbody>
          {drivers.map(d => (
            <tr key={d.id} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ padding: '10px 8px' }}>{d.name} {d.is_demo && <span style={{ fontSize: 10, color: C.muted, background: C.panel2, borderRadius: 4, padding: '2px 6px' }}>demo · solo lectura</span>}</td>
              <td style={{ padding: '10px 8px' }}>{d.pin}</td>
              <td style={{ padding: '10px 8px' }}>{d.phone}</td>
              <td style={{ padding: '10px 8px' }}>{d.email || '—'}</td>
              <td style={{ padding: '10px 8px' }}>
                {d.is_demo ? (
                  <span style={{ color: C.muted, fontSize: 12 }}>{d.fuel_type || '—'}</span>
                ) : (
                  <select value={d.fuel_type || ''} onChange={e => authFetch(`${API_BASE}/drivers/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fuel_type: e.target.value }) }).then(refresh)} style={{ ...input, padding: '4px 6px', fontSize: 12 }}>
                    <option value="">—</option>
                    <option value="diesel">Diésel</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="electrico">Eléctrico</option>
                    <option value="hibrido">Híbrido</option>
                  </select>
                )}
              </td>
              <td style={{ padding: '10px 8px' }}>{d.active ? <span style={{ color: C.green }}>Activo</span> : <span style={{ color: C.muted }}>Inactivo</span>}</td>
              <td style={{ padding: '10px 8px' }}>
                {d.is_demo ? <span style={{ color: C.muted, fontSize: 12 }}>🔒</span> : <button onClick={() => toggle(d.id, d.active)} style={{ ...btn, padding: '6px 10px', fontSize: 12 }}>{d.active ? 'Desactivar' : 'Activar'}</button>}
              </td>
            </tr>
          ))}
          {drivers.length === 0 && <tr><td style={{ padding: '10px 8px', color: C.muted }} colSpan={7}>Sin repartidores.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}