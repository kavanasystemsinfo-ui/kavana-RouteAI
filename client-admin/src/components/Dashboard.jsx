import React from 'react';

export default function Dashboard({ C, kpi, closedSessions, opexReal, fmtNum, fmtEuro, drivers, perDriverStats }) {
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 16, marginBottom: 24 }}>
        {[['Total', fmtNum(kpi.total), C.text], ['Entregados', fmtNum(kpi.delivered), C.green], ['Pendientes', fmtNum(kpi.pending), C.amber], ['Incidencias', fmtNum(kpi.incidents), C.red], ['OPEX real', closedSessions.length > 0 ? `€${fmtEuro(opexReal)}` : '—', closedSessions.length > 0 ? C.green : C.muted]].map(([l, v, c]) => (
          <div key={l} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12, color: C.muted }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>Entregas por repartidor</h3>
        {drivers.map(d => {
          const ds = perDriverStats.get(d.id) || { total: 0, done: 0 };
          const done = ds.done;
          const pct = ds.total ? Math.round(done / ds.total * 100) : 0;
          return (
            <div key={d.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{d.name}</span><span style={{ color: C.muted }}>{fmtNum(done)}/{fmtNum(ds.total)} ({pct}%)</span></div>
              <div style={{ height: 8, background: C.panel2, borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: C.green }} />
              </div>
            </div>
          );
        })}
        {drivers.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No hay repartidores dados de alta.</div>}
      </div>
    </>
  );
}