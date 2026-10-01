import React from 'react';

export default function CostesSection({ C, API_BASE, settings, fmtEuro }) {
  const authFetch = async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, credentials: 'include', headers: { ...(opts.headers || {}) } });
    if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
    return res;
  };

  const inputStyle = { width: '100%', padding: '8px 10px', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 15, fontWeight: 900 };
  const btnStyle = { marginTop: 16, padding: '12px 24px', background: C.accent, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' };

  return (
    <div>
      <h2>Configuración de costes</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Configura el coste por km según el tipo de combustible. Cada repartidor tiene asignado un tipo en su perfil.</p>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 500 }}>
        {[
          ['diesel', 'Diésel', '⛽'],
          ['gasolina', 'Gasolina', '⛽'],
          ['hibrido', 'Híbrido', '🔋'],
          ['electrico', 'Eléctrico', '⚡'],
        ].map(([key, label, icon]) => {
          const settingKey = `cost_per_km_${key}`;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <label style={{ fontSize: 13, fontWeight: 700, minWidth: 90 }}>{label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 13, color: C.muted }}>€</span>
                <input type="number" step="0.01" min="0"
                  defaultValue={settings[settingKey] || settings.cost_per_km || 0.3}
                  id={key}
                  style={inputStyle} />
                <span style={{ fontSize: 13, color: C.muted }}>/km</span>
              </div>
            </div>
          );
        })}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, minWidth: 90 }}>Mano obra</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <span style={{ fontSize: 13, color: C.muted }}>€</span>
              <input type="number" step="0.5" min="0" id="cost_per_hour"
                defaultValue={settings.cost_per_hour || 15}
                style={inputStyle} />
              <span style={{ fontSize: 13, color: C.muted }}> /h</span>
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
          alert('Costes actualizados');
        }} style={btnStyle}>GUARDAR COSTES</button>
      </div>
    </div>
  );
}