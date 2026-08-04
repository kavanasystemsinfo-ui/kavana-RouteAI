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
    color: '#FF3D00',
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
    backgroundColor: '#FF3D00',
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
    backgroundColor: '#FF3D00',
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
  : `http://${window.location.hostname}:5001/api`;

function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [showScanner, setShowScanner] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [podUrl, setPodUrl] = useState(null);
  const [stops, setStops] = useState([]);
  
  const [mapZoom, setMapZoom] = useState(15);

  const fetchStops = async () => {
    try {
      const response = await fetch(`${API_BASE}/stops`);
      const data = await response.json();
      setStops(data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchStops(); }, []);

  const activeStop = stops.find(s => s.status === 'pending') || stops[0] || {
    stop_number: 1,
    address: "Cargando dirección...",
    id: 1
  };

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
      const res = await fetch(`${API_BASE}/stops/${deliveredId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'delivered', 
          signature: deliveryData.signature,
          receiverName: deliveryData.receiverName
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
          const podRes = await fetch(`${API_BASE}/stops/${deliveredId}/pod`);
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
      await fetch(`${API_BASE}/stops/${activeStop.id}/incident`, {
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
      await fetch(`${API_BASE}/stops/${id}`, { method: 'DELETE' });
      fetchStops();
    } catch (error) { console.error(error); }
  };

  const handleClearRoute = async () => {
    if (!window.confirm("¿Estás seguro de que quieres borrar TODA la ruta?")) return;
    try {
      await fetch(`${API_BASE}/stops`, { method: 'DELETE' });
      fetchStops();
    } catch (error) { console.error(error); }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <img src="logo.png" alt="Kavana RouteFleet" style={{height: '45px', width: 'auto'}} />
          <div>
            <div style={{...styles.brand, fontSize: '18px'}}>KAVANA</div>
            <div style={{fontSize: '8px', color: '#666', fontWeight: '900', letterSpacing: '2px'}}>ROUTEFLEET</div>
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
           <div style={{textAlign: 'right'}}>
              <div style={{fontSize: '10px', fontWeight: '900'}}>JORGE A.</div>
              <div style={{width: '6px', height: '6px', backgroundColor: '#FF3D00', borderRadius: '50%', marginLeft: 'auto', marginTop: '4px'}}></div>
           </div>
           <div style={{width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #222'}}>
              <User style={{color: '#444', width: '20px'}} />
           </div>
        </div>
      </header>

      <main style={{flex: 1, paddingBottom: '100px', overflowY: 'auto'}}>
        {activeTab === 'map' && (
          <div className="animate-fade">
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
                  <button onClick={() => setMapZoom(15)} style={{width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FF3D00', border: 'none', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
                    <RefreshCcw style={{width: '16px'}} />
                  </button>
                </div>

                <div style={{position: 'absolute', bottom: '16px', left: '16px', backgroundColor: 'rgba(0,0,0,0.85)', padding: '8px 16px', borderRadius: '20px', border: '1px solid #FF3D0033', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(5px)', pointerEvents: 'none'}}>
                  <Clock style={{color: '#FF3D00', width: '12px'}} />
                  <span style={{fontSize: '10px', fontWeight: '900', letterSpacing: '1px'}}>ZOOM: {mapZoom}x</span>
                </div>
              </div>
              <button style={styles.btnPrimary} onClick={handleNavigate}>
                INICIAR NAVEGACIÓN <ChevronRight style={{width: '20px'}} />
              </button>
            </div>

            <div style={styles.checklist}>
               <div style={styles.stopLabel}>CHECKLIST DE ENTREGA (4 BULTOS)</div>
               {[1, 2, 3, 4].map(i => (
                 <div key={i} style={{...styles.checkItem, opacity: i > 2 ? 0.3 : 1}}>
                    <div style={i > 2 ? {width: '24px', height: '24px', border: '2px solid #444', borderRadius: '4px'} : styles.checkIcon}>
                      {i <= 2 && <Check style={{width: '14px', color: '#000', strokeWidth: '4px'}} />}
                    </div>
                    <div style={{fontSize: '12px', fontWeight: '800'}}>Bulto {i}/4 #KL-78{i} {i <= 2 && <span style={{color: '#666', marginLeft: '8px'}}>(Confirmado)</span>}</div>
                 </div>
               ))}
               <div style={{display: 'flex', gap: '10px', marginTop: '30px'}}>
                 <button style={{...styles.btnPrimary, marginTop: 0, backgroundColor: '#ff4444'}} onClick={() => setShowIncident(true)}>
                    INCIDENCIA
                 </button>
                 <button style={{...styles.btnPrimary, marginTop: 0, flex: 2}} onClick={() => setShowSignature(true)}>
                    ENTREGAR PEDIDO <CheckCircle2 style={{width: '20px'}} />
                 </button>
               </div>
            </div>
          </div>
        )}

        {podUrl && (
          <div style={{padding: '0 24px 24px'}}>
            <a href={podUrl} target="_blank" rel="noreferrer" style={{...styles.btnPrimary, width: '100%', justifyContent: 'center', marginTop: '12px', backgroundColor: '#FF3D00', color: '#000', textDecoration: 'none'}}>
               DESCARGAR POD (FIRMA) <Download style={{width: '20px'}} />
            </a>
          </div>
        )}

        {activeTab === 'list' && (
           <div style={{padding: '24px'}} className="animate-fade">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <div style={styles.stopLabel}>LISTA DE PARADAS</div>
                {stops.length > 0 && (
                  <button 
                    onClick={handleClearRoute}
                    style={{backgroundColor: '#ff444420', color: '#ff4444', border: '1px solid #ff444444', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'}}
                  >
                    <Trash2 size={12} /> BORRAR RUTA
                  </button>
                )}
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
                        <div style={{color: '#FF3D00', fontWeight: '900', fontSize: '20px'}}>#{s.stop_number}</div>
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
      </main>

      <nav style={styles.nav}>
        <button onClick={() => setActiveTab('map')} style={{...styles.navItem, color: activeTab === 'map' ? '#FF3D00' : '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <MapPin style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Mapa</span>
        </button>
        <button onClick={() => setActiveTab('list')} style={{...styles.navItem, color: activeTab === 'list' ? '#FF3D00' : '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <ClipboardList style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Lista</span>
        </button>
        <button onClick={() => setShowScanner(true)} style={{color: '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <Camera style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Carga</span>
        </button>
        <button style={{color: '#444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'}}>
          <Bell style={{width: '24px', height: '24px'}} />
          <span style={{fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px'}}>Avisos</span>
        </button>
      </nav>

      <AnimatePresence>
        {showScanner && <Scanner onScanComplete={fetchStops} onClose={() => setShowScanner(false)} />}
        {showSignature && <SignaturePad onSave={handleDeliver} onClose={() => setShowSignature(false)} />}
        {showIncident && <IncidentModal stop={activeStop} onSubmit={handleIncidentSubmit} onClose={() => setShowIncident(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
