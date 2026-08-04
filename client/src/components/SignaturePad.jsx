import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Check, Trash2, User } from 'lucide-react';

const SignaturePad = ({ onSave, onClose }) => {
  const sigCanvas = useRef(null);
  const [receiverName, setReceiverName] = useState('');

  const clear = () => sigCanvas.current.clear();
  
  const save = () => {
    if (sigCanvas.current.isEmpty()) {
      alert('Por favor, pida al cliente que firme.');
      return;
    }
    if (!receiverName.trim()) {
      alert('Por favor, introduzca el nombre del receptor.');
      return;
    }
    onSave({
      signature: sigCanvas.current.getCanvas().toDataURL('image/png'),
      receiverName: receiverName
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: '#000', zIndex: 10000, 
      display: 'flex', flexDirection: 'column', padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2 style={{margin: 0, fontSize: '16px', fontWeight: '900', color: '#FF3D00', letterSpacing: '1px'}}>CONFIRMACIÓN DE ENTREGA</h2>
        <button onClick={onClose} style={{background: 'none', border: 'none', color: '#444', cursor: 'pointer'}}>
          <X size={28} />
        </button>
      </div>

      {/* Nombre del Receptor */}
      <div style={{marginBottom: '20px'}}>
        <label style={{fontSize: '10px', fontWeight: '900', color: '#666', letterSpacing: '2px', display: 'block', marginBottom: '8px'}}>NOMBRE DEL RECEPTOR</label>
        <div style={{position: 'relative'}}>
          <User size={18} style={{position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#FF3D00'}} />
          <input 
            type="text" 
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="Nombre completo..."
            style={{
              width: '100%', padding: '16px 16px 16px 48px', backgroundColor: '#111', 
              border: '1px solid #222', borderRadius: '12px', color: '#fff', 
              fontSize: '16px', fontWeight: '800', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Canvas de Firma */}
      <div style={{flex: 1, position: 'relative', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden', marginBottom: '20px'}}>
        <label style={{position: 'absolute', top: '16px', left: '16px', fontSize: '10px', fontWeight: '900', color: '#999', pointerEvents: 'none'}}>FIRMA DEL RECEPTOR AQUÍ</label>
        <SignatureCanvas 
          ref={sigCanvas}
          penColor="#000"
          canvasProps={{
            style: { width: '100%', height: '100%', cursor: 'crosshair' }
          }}
        />
      </div>

      {/* Botones de Acción */}
      <div style={{display: 'flex', gap: '12px'}}>
        <button onClick={clear} style={{
          flex: 1, padding: '18px', backgroundColor: '#111', color: '#666', 
          border: '1px solid #222', borderRadius: '12px', fontWeight: '900', 
          fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
        }}>
          <Trash2 size={18} /> BORRAR
        </button>
        <button onClick={save} style={{
          flex: 2, padding: '18px', backgroundColor: '#FF3D00', color: '#000', 
          border: 'none', borderRadius: '12px', fontWeight: '900', 
          fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
        }}>
          <Check size={18} /> CONFIRMAR ENTREGA
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
