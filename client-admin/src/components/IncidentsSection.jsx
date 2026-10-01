import React from 'react';

export default function IncidentsSection({ C, incidents, drivers }) {
  const th = { padding: '10px 8px', borderBottom: `1px solid ${C.border}` };
  const td = { padding: '10px 8px' };

  return (
    <div>
      <h2>Incidencias</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th style={th}>Parada</th><th style={th}>Repartidor</th><th style={th}>Tipo</th><th style={th}>Foto</th><th style={th}>Nota</th></tr></thead>
        <tbody>
          {incidents.map(inc => (
            <tr key={inc.id} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={td}>#{inc.stop_id}</td>
              <td style={td}>{inc.driver_name}</td>
              <td style={td}>{inc.type}</td>
              <td style={td}>
                {inc.photo_data && inc.photo_data.startsWith('data:') ? (
                  <a href={inc.photo_data} target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>📷 Ver</a>
                ) : inc.photo_data && inc.photo_data.startsWith('/') ? (
                  <a href={inc.photo_data} target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>📷 Ver</a>
                ) : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
              </td>
              <td style={td}>{inc.notes}</td>
            </tr>
          ))}
          {incidents.length === 0 && <tr><td style={{ ...td, color: C.muted }} colSpan={5}>Sin incidencias.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}