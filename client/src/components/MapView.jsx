import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para iconos de Leaflet en Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MapView({ address, zoom = 15, height = 220, onNavigate }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Coordenadas por defecto (Valencia)
    const defaultLat = 39.47;
    const defaultLng = -0.38;

    const map = L.map(containerRef.current).setView([defaultLat, defaultLng], zoom);
    
    // Tiles OSM con modo oscuro
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors, © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Geocodificar la dirección y centrar + marker
    let cancelled = false;
    fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      .then(r => r.json())
      .then(({ lat, lng }) => {
        if (cancelled) return;
        if (lat && lng) {
          map.setView([lat, lng], zoom);
          if (markerRef.current) markerRef.current.remove();
          const marker = L.marker([lat, lng]).addTo(map);
          marker.bindPopup(address).openPopup();
          markerRef.current = marker;
        }
      })
      .catch(() => {
        // Si falla geocodificación, mantener vista por defecto
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [address, zoom]);

  const handleNavigate = () => {
    if (onNavigate) onNavigate();
    else window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height, borderRadius: '32px', overflow: 'hidden' }} />
      <button
        onClick={handleNavigate}
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#f8cd00',
          color: '#000',
          border: 'none',
          borderRadius: '16px',
          padding: '12px 24px',
          fontWeight: '900',
          fontSize: '14px',
          letterSpacing: '1px',
          cursor: 'pointer',
          boxShadow: '0 10px 20px rgba(255,107,0,0.2)',
          zIndex: 1000,
        }}
      >
        INICIAR NAVEGACIÓN
      </button>
    </div>
  );
}