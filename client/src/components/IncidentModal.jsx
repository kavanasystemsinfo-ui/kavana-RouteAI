import React, { useState, useRef } from 'react';
import { Camera, X, AlertTriangle, Send } from 'lucide-react';

const IncidentModal = ({ stop, onClose, onSubmit }) => {
  const [type, setType] = useState('ausente');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  const fileInputRef = useRef(null);

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!photo) {
      alert("Es obligatorio adjuntar una fotografía como prueba.");
      return;
    }
    onSubmit({ type, photo_data: photo, notes });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, 
      display: 'flex', flexDirection: 'column', padding: '24px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', color: '#ff4444'}}>
          <AlertTriangle size={24} />
          <h2 style={{margin: 0, fontSize: '18px', fontWeight: '900', letterSpacing: '1px'}}>REPORTAR INCIDENCIA</h2>
        </div>
        <button onClick={onClose} style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer'}}>
          <X size={32} />
        </button>
      </div>

      <div style={{marginBottom: '24px'}}>
        <label style={{fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: '8px'}}>PARADA AFECTADA</label>
        <div style={{fontSize: '16px', fontWeight: '800', color: '#fff'}}>{stop.address}</div>
      </div>

      <div style={{marginBottom: '24px'}}>
        <label style={{fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: '8px'}}>TIPO DE PROBLEMA</label>
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          {['Cliente Ausente', 'Material Dañado', 'Dirección Incorrecta', 'Otro'].map(t => (
            <button key={t} onClick={() => setType(t.toLowerCase())} style={{
              padding: '16px', borderRadius: '12px', fontSize: '14px', fontWeight: '800',
              backgroundColor: type === t.toLowerCase() ? '#ff4444' : '#111',
              color: type === t.toLowerCase() ? '#000' : '#fff',
              border: `1px solid ${type === t.toLowerCase() ? '#ff4444' : '#333'}`,
              textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
            }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom: '24px'}}>
        <label style={{fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: '8px'}}>PRUEBA GRÁFICA (OBLIGATORIA)</label>
        {!photo ? (
          <div 
            onClick={() => fileInputRef.current.click()}
            style={{
              height: '120px', backgroundColor: '#111', borderRadius: '12px', border: '2px dashed #444',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
              cursor: 'pointer', color: '#ff4444'
            }}>
            <Camera size={32} />
            <span style={{fontSize: '12px', fontWeight: '800'}}>TOCAR PARA ABRIR CÁMARA</span>
          </div>
        ) : (
          <div style={{position: 'relative', height: '160px', borderRadius: '12px', overflow: 'hidden'}}>
            <img src={photo} alt="Incidencia" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            <button onClick={() => setPhoto(null)} style={{
              position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.8)',
              border: 'none', borderRadius: '50%', padding: '8px', color: '#fff', cursor: 'pointer'
            }}>
              <X size={20} />
            </button>
          </div>
        )}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          style={{display: 'none'}} 
          onChange={handlePhotoCapture} 
        />
      </div>

      <div style={{marginBottom: '30px'}}>
        <label style={{fontSize: '12px', fontWeight: '900', color: '#666', letterSpacing: '1px', display: 'block', marginBottom: '8px'}}>NOTAS EXTRA (OPCIONAL)</label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Escribe detalles adicionales aquí..."
          style={{
            width: '100%', height: '80px', backgroundColor: '#111', border: '1px solid #333', 
            borderRadius: '12px', padding: '16px', color: '#fff', fontSize: '14px', 
            fontFamily: "'Inter', sans-serif", resize: 'none'
          }}
        />
      </div>

      <button onClick={handleSubmit} style={{
        backgroundColor: '#ff4444', color: '#000', width: '100%', padding: '20px', 
        borderRadius: '16px', border: 'none', fontWeight: '900', fontSize: '14px', 
        letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        cursor: 'pointer', marginTop: 'auto', marginBottom: '20px'
      }}>
        ENVIAR REPORTE <Send size={20} />
      </button>
    </div>
  );
};

export default IncidentModal;
