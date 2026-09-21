import { useState, useMemo } from 'react';
import { CheckCircle2, Check, Clock } from 'lucide-react';
import { API_BASE, driverAuthFetch } from '../services/api';

const styles = {
  stopLabel: {
    fontSize: '10px',
    fontWeight: '900',
    color: '#666',
    letterSpacing: '1px',
    marginBottom: '8px'
  },
  checkIcon: {
    backgroundColor: '#f8cd00',
    borderRadius: '4px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkItem: {
    backgroundColor: '#111',
    padding: '16px',
    borderRadius: '16px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1px solid #1a1a1a'
  }
};

export default function HistoryTab({ stops }) {
  const deliveredStops = useMemo(() =>
    stops.filter(s => s.status === 'delivered')
      .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')),
    [stops]
  );

  return (
    <div style={{ padding: '24px' }} className="animate-fade">
      <div style={{ ...styles.stopLabel, marginBottom: '16px' }}>ENTREGAS COMPLETADAS</div>
      {deliveredStops.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444' }}>
          <CheckCircle2 size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
          <div style={{ fontSize: '14px', fontWeight: '800' }}>Sin entregas completadas</div>
          <div style={{ fontSize: '11px', marginTop: '8px' }}>Las entregas realizadas aparecerán aquí</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', border: '1px solid #222', borderRadius: 12, padding: '14px 16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 900, letterSpacing: '1px' }}>COMPLETADAS</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e' }}>{deliveredStops.length}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 900, letterSpacing: '1px' }}>TOTAL</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#fff' }}>{stops.length}</div>
            </div>
          </div>
          {deliveredStops.map(s => (
            <div key={s.id} style={{ ...styles.checkItem, opacity: 0.7 }}>
              <div style={{ ...styles.checkIcon, backgroundColor: '#22c55e' }}>
                <Check size={14} style={{ color: '#000' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>{s.address}</div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                  {s.receiver_name ? `Recibido por: ${s.receiver_name}` : 'Sin nombre'}
                  {(s.updated_at || s.created_at) && ` · ${(s.updated_at || s.created_at).slice(0, 10)}`}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}