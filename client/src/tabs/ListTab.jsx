import { useState, useEffect, useCallback } from 'react';
import { Navigation, Trash2, ClipboardList } from 'lucide-react';
import { API_BASE, driverAuthFetch } from '../services/api';
import { useDriverSession } from '../hooks/useDriverSession';

const styles = {
  stopLabel: {
    fontSize: '10px',
    fontWeight: '900',
    color: '#666',
    letterSpacing: '2px',
    marginBottom: '8px'
  },
  btnPrimary: {
    backgroundColor: '#f8cd00',
    color: '#000',
    width: '100%',
    padding: '20px',
    borderRadius: '16px',
    border: 'none',
    fontWeight: '900',
    fontSize: '14px',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    cursor: 'pointer',
    marginTop: '20px',
    boxShadow: '0 10px 20px rgba(255,107,0,0.2)'
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
  },
  navItem: {
    color: '#444',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px'
  }
};

export default function ListTab({ 
  stops, 
  driverId, 
  originText, 
  setOriginText, 
  optimizing, 
  setOptimizing,
  handleOptimize,
  handleDeleteStop,
  handleClearRoute,
  openOriginPicker,
  handleOriginChange
}) {
  const session = useDriverSession();
  const { driverName } = session;

  const handleNavigate = () => {
    const activeStop = stops.find(s => s.status === 'pending') || stops[0];
    if (!activeStop?.address) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeStop.address)}`, '_blank');
  };

  return (
    <div style={{ padding: '24px' }} className="animate-fade">
      {/* ORIGEN DE SALIDA + OPTIMIZAR */}
      <div style={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ ...styles.stopLabel, marginBottom: '10px' }}>ORIGEN DE SALIDA</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={originText}
            onChange={handleOriginChange}
            placeholder="Ej: Almacén Kavana, Valencia"
            style={{ flex: 1, padding: '12px 14px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: '700', outline: 'none' }}
          />
          <button
            onClick={openOriginPicker}
            title="Buscar en el mapa"
            style={{ backgroundColor: '#222', border: '1px solid #333', borderRadius: '10px', color: '#f8cd00', padding: '0 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Navigation size={18} />
          </button>
        </div>
        <button
          onClick={handleOptimize}
          disabled={optimizing}
          style={{ ...styles.btnPrimary, marginTop: '12px', backgroundColor: optimizing ? '#663300' : '#f8cd00', fontSize: '13px', padding: '14px' }}
        >
          {optimizing ? 'OPTIMIZANDO...' : 'OPTIMIZAR RUTA'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={styles.stopLabel}>LISTA DE PARADAS</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {stops.length > 0 && (
            <button
              onClick={handleClearRoute}
              style={{ backgroundColor: '#ff444420', color: '#ff4444', border: '1px solid #ff444444', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Trash2 size={12} /> BORRAR
            </button>
          )}
        </div>
      </div>
      {stops.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444' }}>
          <ClipboardList size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
          <div style={{ fontSize: '14px', fontWeight: '800' }}>No hay paradas cargadas</div>
          <div style={{ fontSize: '11px', marginTop: '8px' }}>Escanea un albarán para empezar</div>
        </div>
      ) : (
        stops.map(s => (
          <div key={s.id} style={{ ...styles.checkItem, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ color: '#f8cd00', fontWeight: '900', fontSize: '20px' }}>#{s.stop_number}</div>
              <div style={{ fontSize: '13px', fontWeight: '800' }}>{s.address}</div>
            </div>
            <button
              onClick={() => handleDeleteStop(s.id)}
              style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '5px' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}