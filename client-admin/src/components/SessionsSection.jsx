import React, { useMemo } from 'react';

export default function SessionsSection({ C, sessions, drivers, settings, fmtNum, fmtEuro, fmtKm }) {
  const closedSessions = useMemo(() => sessions.filter(s => s.status === 'closed' && s.km_total), [sessions]);

  return (
    <div>
      <h2>Jornadas de conductores</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Kilometraje real registrado por los repartidores al iniciar/cerrar jornada.</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Conductor</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Inicio</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Km inicial</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Km final</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Km total</th><th style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}` }}>Coste (km)</th></tr></thead>
        <tbody>
          {closedSessions.map(s => {
            const driver = drivers.find(d => d.id === s.driver_id);
            const fuelKey = `cost_per_km_${driver?.fuel_type || ''}`;
            const costKm = settings[fuelKey] || settings.cost_per_km || 0.3;
            return (
              <tr key={s.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '10px 8px' }}>{driver?.name || '—'}</td>
                <td style={{ padding: '10px 8px' }}>{(s.started_at || '').slice(0, 16).replace('T', ' ')}</td>
                <td style={{ padding: '10px 8px' }}>{fmtKm(s.km_initial)} km</td>
                <td style={{ padding: '10px 8px' }}>{fmtKm(s.km_final)} km</td>
                <td style={{ padding: '10px 8px' }}><strong>{fmtKm(s.km_total)} km</strong></td>
                <td style={{ padding: '10px 8px' }}>€{fmtEuro(parseFloat(s.km_total || 0) * costKm)} {driver?.fuel_type ? '' : '(default)'}</td>
              </tr>
            );
          })}
          {closedSessions.length === 0 && <tr><td style={{ padding: '10px 8px', color: C.muted }} colSpan={6}>Sin jornadas registradas. Los repartidores deben iniciar y cerrar sesión desde la app.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}