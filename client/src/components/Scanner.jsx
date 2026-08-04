import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Zap, RefreshCw, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : `http://${window.location.hostname}:5001/api`;

const Scanner = ({ onScanComplete, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, success, error
  const [detectedData, setDetectedData] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Iniciar cámara con fallback
  useEffect(() => {
    async function setupCamera() {
      try {
        // Primero intentamos la cámara trasera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        }).catch(async () => {
          // Si falla, intentamos cualquier cámara disponible
          return await navigator.mediaDevices.getUserMedia({ video: true });
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Cámara no disponible, activando modo subida manual.");
        setScanStatus('error');
      }
    }
    setupCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const processImage = async (blob) => {
    setIsScanning(true);
    setScanStatus('scanning');

    try {
      const formData = new FormData();
      formData.append('image', blob, 'albaran.jpg');

      const response = await fetch(`${API_BASE}/ocr`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setDetectedData(data);
        setScanStatus('success');
        setTimeout(() => {
          onScanComplete(data);
        }, 3000);
      } else {
        setScanStatus('error');
      }
    } catch (err) {
      console.error("Error durante el escaneo:", err);
      setScanStatus('error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCapture = async () => {
    if (scanStatus === 'scanning') return;
    
    if (videoRef.current && videoRef.current.srcObject) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      processImage(blob);
    } else {
      // Si no hay cámara activa, abrimos el selector de archivos
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      processImage(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />

      {/* Header Escáner */}
      <div className="p-6 flex justify-between items-center z-20">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white">
          <X className="w-6 h-6" />
        </button>
        <div className="bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Kavana Lens v1.2</span>
        </div>
        <button className="p-2 rounded-full bg-white/10 text-white">
          <Zap className="w-6 h-6" />
        </button>
      </div>

      {/* Visor de Cámara */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Guías de Escaneo */}
        <div className="relative z-20 w-72 h-96">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-kavana-orange rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-kavana-orange rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-kavana-orange rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-kavana-orange rounded-br-lg" />

          {/* Animación de Láser */}
          <AnimatePresence>
            {isScanning && (
              <motion.div 
                initial={{ top: "0%" }}
                animate={{ top: "100%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#FF3D00] to-transparent shadow-[0_0_15px_#FF3D00] z-30"
              />
            )}
          </AnimatePresence>

          {/* Feedback de Estado */}
          <div className="absolute inset-0 flex items-center justify-center">
            {scanStatus === 'scanning' && (
              <div className="text-center bg-black/60 p-6 rounded-2xl backdrop-blur-md border border-white/5">
                <RefreshCw className="w-12 h-12 text-[#FF3D00] animate-spin mb-2 mx-auto" />
                <p className="text-[10px] text-[#FF3D00] font-black uppercase tracking-widest">Analizando con IA...</p>
              </div>
            )}
            
            {scanStatus === 'success' && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center bg-black/80 p-8 rounded-3xl backdrop-blur-xl border border-[#FF3D00]/30 w-full"
              >
                <CheckCircle2 className="w-16 h-16 text-[#FF3D00] mb-3 mx-auto" />
                <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-widest">Resultado</p>
                <p className="text-xl font-black text-white">{detectedData?.detectedAddress}</p>
                <div className="mt-4 p-2 bg-[#FF3D00]/10 rounded-lg">
                   <p className="text-[10px] text-[#FF3D00] font-bold uppercase">Dirección Cargada en Ruta</p>
                </div>
              </motion.div>
            )}

            {scanStatus === 'error' && (
              <div className="text-center p-6">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-2 mx-auto" />
                <p className="text-xs text-white font-bold uppercase">Cámara no detectada</p>
                <p className="text-[10px] text-slate-500 mt-2">Pulsa el botón central para subir una foto manualmente.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Botón Captura */}
      <div className="p-10 flex flex-col items-center gap-4 bg-black">
        <button 
          onClick={handleCapture}
          disabled={scanStatus === 'scanning'}
          className={`h-20 w-20 rounded-full border-4 flex items-center justify-center transition-all ${
            scanStatus === 'scanning' ? 'border-slate-800' : 'border-white active:scale-90 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
          }`}
        >
          {(!videoRef.current?.srcObject && scanStatus !== 'scanning') ? (
            <Upload className="text-white w-8 h-8" />
          ) : (
            <div className={`h-14 w-14 rounded-full transition-colors ${
              scanStatus === 'scanning' ? 'bg-slate-800' : 'bg-white'
            }`} />
          )}
        </button>
        <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          {(!videoRef.current?.srcObject) ? 'Subir albarán manualmente' : 'Capturar albarán'}
        </p>
      </div>
    </motion.div>
  );
};

export default Scanner;
