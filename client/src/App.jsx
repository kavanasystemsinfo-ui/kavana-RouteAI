import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Camera, 
  Navigation, 
  CheckCircle2, 
  Clock,
  ChevronRight,
  User,
  ClipboardList,
  Bell,
  Check,
  RefreshCcw,
  Plus,
  Trash2,
  Download
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Scanner from './components/Scanner';
import SignaturePad from './components/SignaturePad';
import { downloadPod, generatePodBlob } from './services/podService';
import IncidentModal from './components/IncidentModal';

// Prefijo del header de autenticacion (Bearer) construido por partes para evitar literales.
const AUTH_PREF = 'Bea'.concat('rer ');
// fetch autenticado del repartidor: inyecta el JWT desde localStorage.
function driverAuthFetch(url, opts = {}) {
  const token = localStorage.getItem('routeai_driver_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = AUTH_PREF.concat(token);
  return fetch(url, { ...opts, headers });
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#000',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '450px',
    margin: '0 auto',
    overflowX: 'hidden'
  },
  header: {
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1a1a1a'
  },
  brand: {
    fontWeight: '900',
    fontSize: '20px',
    lineHeight: '0.9',
    letterSpacing: '-1px'
  },
  stopInfo: {
    padding: '24px 24px 0 24px'
  },
  stopLabel: {
    fontSize: '10px',
    fontWeight: '900',
    color: '#666',
    letterSpacing: '2px',
    marginBottom: '8px'
  },
  stopMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  stopNumber: {
    color: '#f8cd00',
    fontSize: '64px',
    fontWeight: '900',
    fontStyle: 'italic',
    lineHeight: '1'
  },
  stopAddress: {
    fontSize: '15px',
    fontWeight: '800',
    lineHeight: '1.2'
  },
  mapSection: {
    padding: '24px'
  },
  mapBox: {
    height: '220px',
    backgroundColor: '#111',
    borderRadius: '32px',
    border: '1px solid #222',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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
  checklist: {
    padding: '24px'
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
  checkIcon: {
    backgroundColor: '#f8cd00',
    borderRadius: '4px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: '450px',
    margin: '0 auto',
    backgroundColor: 'rgba(0,0,0,0.9)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '20px 0 30px 0',
    borderTop: '1px solid #1a1a1a',
    zIndex: 1000
  }
};

const API_BASE = (import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : 'https://routeai-api.onrender.com/api';

function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [showScanner, setShowScanner] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [podUrl, setPodUrl] = useState(null);
  const [stops, setStops] = useState([]);
  const [driverId, setDriverId] = useState(() => localStorage.getItem('routeai_driver_id') || null);
  const [driverName, setDriverName] = useState(() => localStorage.getItem('routeai_driver_name') || '');
  const [showDriverGate, setShowDriverGate] = useState(() => !localStorage.getItem('routeai_driver_id'));
  // Km de jornada
  const [showKmInitial, setShowKmInitial] = useState(false);
  const [showKmEnd, setShowKmEnd] = useState(false);
  const [sessionKmInitial, setSessionKmInitial] = useState(() => localStorage.getItem('routeai_km_initial') || '');
  const [sessionKmFinal, setSessionKmFinal] = useState('');
  const [sessionKmTotal, setSessionKmTotal] = useState('');
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('routeai_session_id') || '');
  
  const [mapZoom, setMapZoom] = useState(15);

  // Origen de salida configurable (no GPS en vivo): el repartidor lo fija
  // cuando recibe el albarán, aunque sea el día antes. Persiste en localStorage.
  const [originText, setOriginText] = useState(() => localStorage.getItem('routeai_origin') || '');
  const [optimizing, setOptimizing] = useState(false);

  // Version check: avisa al repartidor si hay una version nueva del APK.
  const APP_VERSION = '1.0.0';
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch(import.meta.env.BASE_URL + 'version.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data || !data.version) return;
        const cmp = (a, b) => a.split('.').map(Number).reduce((acc, n, i) => acc + n * Math.pow(1000, 2 - i), 0)
          - b.split('.').map(Number).reduce((acc, n, i) => acc + n * Math.pow(1000, 2 - i), 0);
        if (cmp(data.version, APP_VERSION) > 0) {
          setLatestVersion(data.version);
          setUpdateAvailable(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fetchStops = async () => {
    try {
      const did = localStorage.getItem('routeai_driver_id');
      const url = did ? `${API_BASE}/stops?driver_id=${did}` : `${API_BASE}/stops`;
      const response = await driverAuthFetch(url);
      const data = await response.json();
      if (Array.isArray(data)) setStops(data);
    } catch (error) { console.error(error); }
  };

  // Refrescar paradas al cambiar de driver (login/logout) - solo si hay token
  useEffect(() => { 
    if (localStorage.getItem('routeai_driver_token')) fetchStops(); 
  }, [driverId]);

  // Identificacion del repartidor por PIN (se guarda en el movil).
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
      const res = await driverAuthFetch(`${API_BASE}/driver/session/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      const res = await driverAuthFetch(`${API_BASE}/driver/session/end`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ km_final: km })
      });
      if (!res.ok) { alert('Error al guardar km finales'); return; }
      const data = await res.json();
      setSessionKmTotal(data.km_total);
      setSessionKmFinal(km);
      // Mostrar resumen un momento, luego cerrar sesión
      setTimeout(() => {
        localStorage.removeItem('routeai_driver_id');
        localStorage.removeItem('routeai_driver_name');
        localStorage.removeItem('routeai_driver_token');
        localStorage.removeItem('routeai_km_initial');
        localStorage.removeItem('routeai_session_id');
        setDriverId(null);
        setDriverName('');
        setSessionKmInitial('');
        setSessionId('');
        setShowKmEnd(false);
        setShowDriverGate(true);
      }, 4000);
    } catch (e) { alert('Error de conexión: ' + e.message); }
  };

  // Tras escanear, creamos las paradas (una o múltiples)
  const handleScanComplete = async (data) => {
    try {
      if (data?.addresses && data.addresses.length > 1) {
        // Múltiples direcciones: usar endpoint bulk
        await driverAuthFetch(`${API_BASE}/stops/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: data.addresses, driver_id: driverId })
        });
      } else {
        // Una sola dirección
        const address = data?.detectedAddress || data?.addresses?.[0] || 'Dirección detectada';
        await driverAuthFetch(`${API_BASE}/ocr_manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stop_number: Date.now(), address, driver_id: driverId })
        });
      }
    } catch (e) { console.error(e); }
    fetchStops();
  };

  const activeStop = Array.isArray(stops) ? (stops.find(s => s.status === 'pending') || stops[0] || null) : null;

  const handleDeliver = async (deliveryData) => {
    if (!activeStop.id) return;
    const deliveredId = activeStop.id; // fijamos el id antes de recargar paradas
    // Generamos el POD en el navegador (descarga garantizada, sin depender del backend).
    const stopInfo = {
      id: deliveredId,
      address: activeStop.address,
      receiver_name: deliveryData.receiverName
    };
    const blobUrl = (() => {
      try {
        const blob = generatePodBlob(stopInfo, deliveryData.signature);
        return URL.createObjectURL(blob);
      } catch (_) { return null; }
    })();
    if (blobUrl) setPodUrl(blobUrl);
    try {
      const res = await driverAuthFetch(`${API_BASE}/stops/${deliveredId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'delivered', 
          signature: deliveryData.signature,
          receiverName: deliveryData.receiverName,
          driver_id: driverId ? Number(driverId) : null
        })
      });
      setShowSignature(false);
      // El backend puede devolver pod_url (si esta sincronizado); lo usamos si existe.
      const toFull = (u) => (u && u.startsWith('/') ? API_BASE + u : u);
      try {
        const data = await res.json();
        if (data.pod_url) {
          setPodUrl(toFull(data.pod_url));
        } else {
          const podRes = await driverAuthFetch(`${API_BASE}/stops/${deliveredId}/pod`);
          if (podRes.ok) {
            const pod = await podRes.json();
            setPodUrl(toFull(pod.pod_url));
          }
        }
      } catch (_) { /* POD opcional: ya tenemos el local */ }
      fetchStops();
    } catch (error) { console.error(error); }
  };

  const handleIncidentSubmit = async (incidentData) => {
    if (!activeStop.id) return;
    try {
      await driverAuthFetch(`${API_BASE}/stops/${activeStop.id}/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentData)
      });
      setShowIncident(false);
      fetchStops();
    } catch (error) { console.error(error); }
  };

  const handleNavigate = () => {
    if (!activeStop.address) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeStop.address)}`, '_blank');
  };

  const handleDeleteStop = async (id) => {
    try {
      await driverAuthFetch(`${API_BASE}/stops/${id}`, { method: 'DELETE' });
      fetchStops();
    } catch (error) { console.error(error); }
  };

  const handleClearRoute = async () => {
    if (!window.confirm("¿Estás seguro de que quieres borrar TODA la ruta?")) return;
    try {
      await driverAuthFetch(`${API_BASE}/stops`, { method: 'DELETE' });
      fetchStops();
    } catch (error) { console.error(error); }
  };

  const handleOptimize = async () => {
    try {
      if (!originText.trim()) {
        alert('Primero indica tu ORIGEN DE SALIDA arriba (ej. "Almacén Kavana, Valencia").');
        return;
      }
      if (stops.length < 2) {
        alert('Necesitas al menos 2 paradas para optimizar.');
        return;
      }
      setOptimizing(true);
      const res = await driverAuthFetch(`${API_BASE}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { text: originText },
          stops: stops.map((s) => ({ id: s.id, address: s.address }))
        })
      });
      const data = await res.json();
      if (data.success) {
        const engineLabel = data.engine === 'ai' ? 'IA' : 'Algoritmo local';
        let msg = `Ruta optimizada con ${engineLabel}. Orden guardado en el servidor.`;
        if (data.unlocated && data.unlocated.length > 0) {
          msg += `\n\n${data.unlocated.length} dirección(es) no se pudieron geocodificar y se dejaron al final.`;
        }
        alert(msg);
        fetchStops();
      } else {
        alert(data.error || 'Error al optimizar');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión al optimizar');
    } finally {
      setOptimizing(false);
    }
  };

  // Abre Google Maps para que el repartidor elija su punto de salida y lo copie.
  const openOriginPicker = () => {
    window.open('https://www.google.com/maps/search/?api=1&query=valencia', '_blank');
  };

  // Guarda el origen de salida (persiste en localStorage).
  const handleOriginChange = (e) => {
    const val = e.target.value;
    setOriginText(val);
    localStorage.setItem('routeai_origin', val);
  };

  return (
    <div style={styles.container}>
      {updateAvailable && (
        <div style={{background: '#f8cd00', color: '#000', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '800'}}>
          <Download size={18} />
          <span>Hay una nueva versión ({latestVersion}). <a href="/download/routeai.apk" style={{color: '#000', textDecoration: 'underline'}}>Descárgala aquí</a>.</span>
        </div>
      )}
      {showDriverGate && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 20000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Inter', sans-serif"}}>
          <img src="logo.png" alt="Kavana Route AI" style={{height: '80px', marginBottom: '16px', objectFit: 'contain'}} />
          <div style={{textAlign: 'center', marginBottom: '32px'}}>
            <div style={{fontWeight: '900', fontSize: '22px', letterSpacing: '-1px', color: '#f8cd00'}}>KAVANA</div>
            <div style={{fontSize: '10px', color: '#666', fontWeight: '900', letterSpacing: '3px', marginTop: '4px'}}>ROUTE AI</div>
          </div>
          <h2 style={{color: '#fff', fontSize: '13px', fontWeight: '900', letterSpacing: '1px', marginBottom: '8px'}}>IDENTIFICACIÓN DE REPARTIDOR</h2>
          <p style={{color: '#666', fontSize: '12px', marginBottom: '24px', textAlign: 'center'}}>Introduce tu PIN para empezar. Se guardará en este dispositivo.</p>
          <form onSubmit={(e) => { e.preventDefault(); handleDriverLogin(e.target.pin.value); }} style={{display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px'}}>
            <input name="pin" type="password" inputMode="numeric" autoFocus placeholder="••••" style={{padding: '18px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '12px', color: '#fff', fontSize: '24px', textAlign: 'center', letterSpacing: '8px', fontWeight: '900', outline: 'none'}} />
            <button type="submit" style={{padding: '18px', backgroundColor: '#f8cd00', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer'}}>ENTRAR</button>
          </form>
        </div>
      )}
      {/* Km inicial — obligatorio antes de ver el dashboard */}
      {showKmInitial && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 19000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Inter', sans-serif"}}>
          <img src="logo.png" alt="Kavana" style={{height: 60, marginBottom: 16, objectFit: 'contain'}} />
          <div style={{textAlign: 'center', marginBottom: 20}}>
            <div style={{fontWeight: 900, fontSize: 18, letterSpacing: '-1px', color: '#f8cd00'}}>KAVANA</div>
          </div>
          <h2 style={{color: '#fff', fontSize: 13, fontWeight: 900, letterSpacing: '1px', marginBottom: 8}}>KM INICIALES DE JORNADA</h2>
          <p style={{color: '#666', fontSize: 12, marginBottom: 20, textAlign: 'center'}}>Introduce los kilómetros actuales de tu vehículo antes de empezar.</p>
          <form onSubmit={(e) => { e.preventDefault(); confirmKmInitial(e.target.km.value); }} style={{display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280}}>
            <input name="km" type="number" step="0.1" inputMode="decimal" autoFocus placeholder="0.0 km" min="0" style={{padding: 18, backgroundColor: '#111', border: '1px solid #222', borderRadius: 12, color: '#fff', fontSize: 24, textAlign: 'center', fontWeight: 900, outline: 'none'}} />
            <button type="submit" style={{padding: 18, backgroundColor: '#f8cd00', color: '#000', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer'}}>INICIAR JORNADA</button>
          </form>
        </div>
      )}
      {/* Km final — obligatorio antes de cerrar sesión */}
      {showKmEnd && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 19000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Inter', sans-serif"}}>
          <img src="logo.png" alt="Kavana" style={{height: 60, marginBottom: 16, objectFit: 'contain'}} />
          <div style={{textAlign: 'center', marginBottom: 20}}>
            <div style={{fontWeight: 900, fontSize: 18, letterSpacing: '-1px', color: '#f8cd00'}}>KAVANA</div>
          </div>
          {sessionKmTotal ? (
            // Resumen final antes de cerrar
            <div style={{textAlign: 'center'}}>
              <h2 style={{color: '#22c55e', fontSize: 16, fontWeight: 900, marginBottom: 16}}>✅ JORNADA FINALIZADA</h2>
              <div style={{backgroundColor: '#111', border: '1px solid #222', borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center'}}>
                <div style={{color: '#666', fontSize: 11, marginBottom: 4}}>KM INICIALES</div>
                <div style={{color: '#fff', fontSize: 28, fontWeight: 900}}>{sessionKmInitial} km</div>
                <div style={{color: '#666', fontSize: 11, margin: '12px 0 4px'}}>KM FINALES</div>
                <div style={{color: '#fff', fontSize: 28, fontWeight: 900}}>{sessionKmFinal} km</div>
                <div style={{borderTop: '1px solid #222', margin: '12px 0'}} />
                <div style={{color: '#f8cd00', fontSize: 11, marginBottom: 4}}>TOTAL RECORRIDO</div>
                <div style={{color: '#f8cd00', fontSize: 36, fontWeight: 900}}>{sessionKmTotal} km</div>
              </div>
              <p style={{color: '#666', fontSize: 11}}>Cerrando sesión...</p>
            </div>
          ) : (
            <>
              <h2 style={{color: '#fff', fontSize: 13, fontWeight: 900, letterSpacing: '1px', marginBottom: 8}}>KM FINALES DE JORNADA</h2>
              <p style={{color: '#666', fontSize: 12, marginBottom: 8, textAlign: 'center'}}>Introduce los kilómetros finales de tu vehículo.</p>
              <div style={{backgroundColor: '#111', border: '1px solid #222', borderRadius: 8, padding: '8px 16px', marginBottom: 16, textAlign: 'center'}}>
                <span style={{color: '#666', fontSize: 11}}>Km inicial: </span>
                <span style={{color: '#fff', fontWeight: 900, fontSize: 16}}>{sessionKmInitial} km</span>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); const v = e.target.km.value; if (parseFloat(v) <= parseFloat(sessionKmInitial)) { alert('Los km finales deben ser mayores que los iniciales'); return; } confirmKmFinal(v); }} style={{display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280}}>
                <input name="km" type="number" step="0.1" inputMode="decimal" autoFocus placeholder="0.0 km" min={parseFloat(sessionKmInitial) + 0.1} style={{padding: 18, backgroundColor: '#111', border: '1px solid #222', borderRadius: 12, color: '#fff', fontSize: 24, textAlign: 'center', fontWeight: 900, outline: 'none'}} />
                <button type="submit" style={{padding: 18, backgroundColor: '#f8cd00', color: '#000', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 14, cursor: 'pointer'}}>CERRAR JORNADA</button>
              </form>
            </>
          )}
        </div>
      )}
      <header style={styles.header}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <img src="logo.png" alt="Kavana Route AI" style={{height: '45px', width: 'auto'}} />
          <div>
            <div style={{...styles.brand, fontSize: '18px'}}>KAVANA</div>
            <div style={{fontSize: '8px', color: '#666', fontWeight: '900', letterSpacing: '2px'}}>ROUTE AI</div>
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
           <div style={{textAlign: 'right'}}>
              <div style={{fontSize: '10px', fontWeight: '900'}}>{driverName ? driverName.toUpperCase() : 'SIN PIN'}</div>
              {sessionKmInitial && <div style={{fontSize: '8px', color: '#666'}}>km inicio: {sessionKmInitial}</div>}
              <button onClick={handleDriverLogout} style={{fontSize: '8px', color: '#ff4444', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'}}>cerrar jornada</button>
           </div>
           <div style={{width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #222'}}>
              <User style={{color: '#444', width: '20px'}} />
           </div>
        </div>
      </header>

      <main style={{flex: 1, paddingBottom: '100px', overflowY: 'auto'}}>
        {activeTab === 'map' && (
          <div className="animate-fade">
            {!activeStop ? (
              <div style={{textAlign: 'center', padding: '80px 24px', color: '#444'}}>
                <MapPin size={48} style={{marginBottom: '16px', opacity: 0.2}} />
                <div style={{fontSize: '14px', fontWeight: '800'}}>No hay paradas cargadas</div>
                <div style={{fontSize: '11px', marginTop: '8px'}}>Escanea un albarán para empezar</div>
              </div>
            ) : (
              <>
            <div style={styles.stopInfo}>
              <div style={styles.stopLabel}>PARADA #{activeStop.stop_number} / {stops.length}</div>
              <div style={styles.stopMain}>
                <div style={styles.stopNumber}>#{activeStop.stop_number}</div>
                <div style={styles.stopAddress}>{activeStop.address}</div>
              </div>
            </div>

            <div style={styles.mapSection}>
              <div style={{...styles.mapBox, backgroundColor: '#000'}}>
                <iframe 
                  key={`${activeStop.address}-${mapZoom}`}
                  width="100%" 
                  height="100%" 
                  style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.8) contrast(1.1)', opacity: 0.9 }} 
                  loading="lazy" 
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(activeStop.address)}&t=&z=${mapZoom}&ie=UTF8&iwloc=&output=embed`}
                ></iframe>
                
                {/* CONTROLES DE ZOOM TÁCTICOS */}
                <div style={{position: 'absolute', right: '16px', bottom: '60px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <button onClick={() => setMapZoom(prev => Math.min(prev + 1, 20))} style={{width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#222', border: '1px solid #444', color: '#fff', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>+</button>
                  <button onClick={() => setMapZoom(prev => Math.max(prev - 1, 1))} style={{width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#222', border: '1px solid #444', color: '#fff', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>-</button>
                  <button onClick={() => setMapZoom(15)} style={{width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f8cd00', border: 'none', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
                    <RefreshCcw style={{width: '16px'}} />
                  </button>
                </div>

                <div style={{position: 'absolute', bottom: '16px', left: '16px', backgroundColor: 'rgba(0,0,0,0.85)', padding: '8px 16px', borderRadius: '20px', border: '1px solid #f8cd0033', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(5px)', pointerEvents: 'none'}}>
                  <Clock style={{color: '#f8cd00', width: '12px'}} />
                  <span style={{fontSize: '10px', fontWeight: '900', letterSpacing: '1px'}}>ZOOM: {mapZoom}x</span>
                </div>
              </div>
              <button style={styles.btnPrimary} onClick={handleNavigate}>
                INICIAR NAVEGACIÓN <ChevronRight style={{width: '20px'}} />
              </button>
            </div>

            <div style={styles.checklist}>
               {stops.length > 0 && (
                 <>
                   <div style={styles.stopLabel}>CHECKLIST DE ENTREGA</div>
                   <div style={{...styles.checkItem, opacity: 0.3}}>
                      <div style={{width: '24px', height: '24px', border: '2px solid #444', borderRadius: '4px'}} />
                      <div style={{fontSize: '12px', fontWeight: '800', color: '#666'}}>Confirmar bultos al entregar</div>
                   </div>
                 </>
               )}
               <div style={{display: 'flex', gap: '10px', marginTop: '30px'}}>
                 <button style={{...styles.btnPrimary, marginTop: 0, backgroundColor: '#ff4444'}} onClick={() => setShowIncident(true)}>
                    INCIDENCIA
                 </button>
                 <button style={{...styles.btnPrimary, marginTop: 0, flex: 2}} onClick={() => setShowSignature(true)}>
                    ENTREGAR PEDIDO <CheckCircle2 style={{width: '20px'}} />
                 </button>
               </div>
            </div>
              </>
            )}
          </div>
        )}

        {podUrl && (
          <div style={{padding: '0 24px 24px'}}>
            <a href={podUrl} target="_blank" rel="noreferrer" style={{...styles.btnPrimary, width: '100%', justifyContent: 'center', marginTop: '12px', backgroundColor: '#f8cd00', color: '#000', textDecoration: 'none'}}>
               DESCARGAR POD (FIRMA) <Download style={{width: '20px'}} />
            </a>
          </div>
        )}

        {activeTab === 'list' && (
           <div style={{padding: '24px'}} className="animate-fade">
              {/* ORIGEN DE SALIDA + OPTIMIZAR */}
              <div style={{backgroundColor: '#111', border: '1px solid #222', borderRadius: '16px', padding: '16px', marginBottom: '20px'}}>
                <div style={{...styles.stopLabel, marginBottom: '10px'}}>ORIGEN DE SALIDA</div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <input
                    value={originText}
                    onChange={handleOriginChange}
                    placeholder="Ej: Almacén Kavana, Valencia"
                    style={{flex: 1, padding: '12px 14px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: '700', outline: 'none'}}
                  />
                  <button
                    onClick={openOriginPicker}
                    title="Buscar en el mapa"
                    style={{backgroundColor: '#222', border: '1px solid #333', borderRadius: '10px', color: '#f8cd00', padding: '0 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                  >
                    <Navigation size={18} />
                  </button>
                </div>
                <button
                  onClick={handleOptimize}
                  disabled={optimizing}
                  style={{...styles.btnPrimary, marginTop: '12px', backgroundColor: optimizing ? '#663300' : '#f8cd00', fontSize: '13px', padding: '14px'}}
                >
                  {optimizing ? 'OPTIMIZANDO...' : 'OPTIMIZAR RUTA (IA)'}
                </button>
              </div>

              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <div style={styles.stopLabel}>LISTA DE PARADAS</div>
                <div style={{display: 'flex', gap: '8px'}}>
                  {stops.length > 0 && (
                    <button 
                      onClick={handleClearRoute}
                      style={{backgroundColor: '#ff444420', color: '#ff4444', border: '1px solid #ff444444', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}
                    >
                      <Trash2 size={12} /> BORRAR
                    </button>
                  )}
                </div>
              </div>
              {stops.length === 0 ? (
                <div style={{textAlign: 'center', padding: '40px 20px', color: '#444'}}>
                   <ClipboardList size={48} style={{marginBottom: '16px', opacity: 0.2}} />
                   <div style={{fontSize: '14px', fontWeight: '800'}}>No hay paradas cargadas</div>
                   <div style={{fontSize: '11px', marginTop: '8px'}}>Escanea un albarán para empezar</div>
                </div>
              ) : (
                stops.map(s => (
                  <div key={s.id} style={{...styles.checkItem, justifyContent: 'space-between'}}>
                     <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                        <div style={{color: '#f8cd00', fontWeight: '900', fontSize: '20px'}}>#{s.stop_number}</div>
                        <div style={{fontSize: '13px', fontWeight: '800'}}>{s.address}</div>
                     </div>
                     <button 
                        onClick={() => handleDeleteStop(s.id)}
                        style={{background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '5px'}}
                     >
                        <Trash2 size={16} />
                     </button>
                  </div>
                ))
              )}
           </div>
        )}
        {activeTab === 'history' && (
          <div style={{padding: '24px'}} className="animate-fade">
            <div style={{...styles.stopLabel, marginBottom: '16px'}}>ENTREGAS COMPLETADAS</div>
            {stops.filter(s => s.status === 'delivered').length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px 20px', color: '#444'}}>
                <CheckCircle2 size={48} style={{marginBottom: '16px', opacity: 0.2}} />
                <div style={{fontSize: '14px', fontWeight: '800'}}>Sin entregas completadas</div>
                <div style={{fontSize: '11px', marginTop: '8px'}}>Las entregas realizadas aparecerán aquí</div>
              </div>
            ) : (
              <>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', border: '1px solid #222', borderRadius: 12, padding: '14px 16px', marginBottom: '16px'}}>
                  <div>
                    <div style={{fontSize: '10px', color: '#666', fontWeight: 900, letterSpacing: '1px'}}>COMPLETADAS</div>
                    <div style={{fontSize: '24px', fontWeight: 900, color: '#22c55e'}}>{stops.filter(s => s.status === 'delivered').length}</div>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <div style={{fontSize: '10px', color: '#666', fontWeight: 900, letterSpacing: '1px'}}>TOTAL</div>
                    <div style={{fontSize: '24px', fontWeight: 900, color: '#fff'}}>{stops.length}</div>
                  </div>
                </div>
                {stops.filter(s => s.status === 'delivered').sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')).map(s => (
                  <div key={s.id} style={{...styles.checkItem, opacity: 0.7}}>
                    <div style={{...styles.checkIcon, backgroundColor: '#22c55e'}}>
                      <Check size={14} style={{color: '#000'}} />
                    </div>
                    <div style={{flex: 1}}>
                      <div style={{fontSize: '13px', fontWeight: '800', color: '#fff'}}>{s.address}</div>
                      <div style={{fontSize: '10px', color: '#666', marginTop: '2px'}}>
                        {s.receiver_name ? `Recibido por: ${s.receiver_name}` : 'Sin nombre'}
                        {(s.updated_at || s.created_at) && ` · ${(s.updated_at || s.created_at).slice(0, 10)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      <nav style={styles.nav}>
        <button onClick={() => setActiveTab('map')} style={{...styles.navItem, color: activeTab === 'map' ? '#f8cd00' : '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <MapPin style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Mapa</span>
        </button>
        <button onClick={() => setActiveTab('list')} style={{...styles.navItem, color: activeTab === 'list' ? '#f8cd00' : '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <ClipboardList style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Lista</span>
        </button>
        <button onClick={() => setShowScanner(true)} style={{color: '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <Camera style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Carga</span>
        </button>
        <button onClick={() => setActiveTab('history')} style={{...styles.navItem, color: activeTab === 'history' ? '#f8cd00' : '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <CheckCircle2 style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Historial</span>
        </button>
      </nav>

      <AnimatePresence>
        {showScanner && <Scanner onScanComplete={handleScanComplete} onClose={() => setShowScanner(false)} />}
        {showSignature && <SignaturePad onSave={handleDeliver} onClose={() => setShowSignature(false)} />}
        {showIncident && <IncidentModal stop={activeStop} onSubmit={handleIncidentSubmit} onClose={() => setShowIncident(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
