// Hook de sesión del repartidor — Deuda 2 (auditoría 2026-08-24).
// Extrae de App.jsx la lógica pura de autenticación y jornada: login por PIN,
// logout con cierre de km, arranque/fin de sesión. App consume el objeto y se
// queda solo con la vista.
import { useState } from 'react';
import { API_BASE } from '../services/api';

export function useDriverSession() {
  const [driverId, setDriverId] = useState(() => localStorage.getItem('routeai_driver_id') || null);
  const [driverName, setDriverName] = useState(() => localStorage.getItem('routeai_driver_name') || '');
  const [showDriverGate, setShowDriverGate] = useState(() => !localStorage.getItem('routeai_driver_id'));
  const [showKmInitial, setShowKmInitial] = useState(false);
  const [showKmEnd, setShowKmEnd] = useState(false);
  const [sessionKmInitial, setSessionKmInitial] = useState(() => localStorage.getItem('routeai_km_initial') || '');
  const [sessionKmFinal, setSessionKmFinal] = useState('');
  const [sessionKmTotal, setSessionKmTotal] = useState('');
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('routeai_session_id') || '');

  const clearStorage = () => {
    localStorage.removeItem('routeai_driver_id');
    localStorage.removeItem('routeai_driver_name');
    localStorage.removeItem('routeai_driver_token');
    localStorage.removeItem('routeai_km_initial');
    localStorage.removeItem('routeai_session_id');
  };

  const handleDriverLogin = async (pin) => {
    try {
      const res = await fetch(`${API_BASE}/drivers/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        alert(msg.error || 'PIN incorrecto. Pide el PIN a tu oficina.');
        setShowDriverGate(true);
        return;
      }
      const { token, driver } = await res.json();
      localStorage.setItem('routeai_driver_id', driver.id);
      localStorage.setItem('routeai_driver_name', driver.name);
      localStorage.setItem('routeai_driver_token', token);
      setDriverId(driver.id);
      setDriverName(driver.name);
      setShowDriverGate(false);
      // Mostrar pantalla de km iniciales
      setShowKmInitial(true);
    } catch (error) {
      console.error(error);
      alert('Error de conexión con el servidor. Inténtalo de nuevo.');
      setShowDriverGate(true);
    }
  };

  const handleDriverLogout = () => {
    // Mostrar pantalla de km finales antes de cerrar
    setSessionKmFinal('');
    setSessionKmTotal('');
    setShowKmEnd(true);
  };

  const confirmKmInitial = async (km) => {
    try {
      const res = await fetch(`${API_BASE}/driver/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bea'.concat('rer ', localStorage.getItem('routeai_driver_token') || '') },
        body: JSON.stringify({ km_initial: km })
      });
      if (!res.ok) { alert('Error al guardar km iniciales'); return; }
      const data = await res.json();
      localStorage.setItem('routeai_km_initial', km);
      localStorage.setItem('routeai_session_id', String(data.session_id));
      setSessionKmInitial(km);
      setSessionId(String(data.session_id));
      setShowKmInitial(false);
    } catch (e) { alert('Error de conexión: ' + e.message); }
  };

  const confirmKmFinal = async (km) => {
    try {
      const res = await fetch(`${API_BASE}/driver/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bea'.concat('rer ', localStorage.getItem('routeai_driver_token') || '') },
        body: JSON.stringify({ km_final: km })
      });
      if (!res.ok) { alert('Error al guardar km finales'); return; }
      const data = await res.json();
      setSessionKmTotal(data.km_total);
      setSessionKmFinal(km);
      // Mostrar resumen un momento, luego cerrar sesión
      setTimeout(() => {
        clearStorage();
        setDriverId(null);
        setDriverName('');
        setSessionKmInitial('');
        setSessionId('');
        setShowKmEnd(false);
        setShowDriverGate(true);
      }, 4000);
    } catch (e) { alert('Error de conexión: ' + e.message); }
  };

  return {
    driverId, driverName, showDriverGate,
    showKmInitial, showKmEnd,
    sessionKmInitial, sessionKmFinal, sessionKmTotal, sessionId,
    handleDriverLogin, handleDriverLogout, confirmKmInitial, confirmKmFinal,
  };
}
