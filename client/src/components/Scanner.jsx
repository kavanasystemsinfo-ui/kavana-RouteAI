import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, RefreshCw, CheckCircle2, AlertTriangle, Upload, FileText, FileImage } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : `http://${window.location.hostname}:5001/api`;

// Scanner v2 - Mobile UI + PDF/CSV support - 2026-07-18
const Scanner = ({ onScanComplete, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('select'); // select, scanning, success, error
  const [detectedData, setDetectedData] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cámara solo cuando el usuario la activa explícitamente
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      }).catch(async () => {
        return await navigator.mediaDevices.getUserMedia({ video: true });
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (err) {
      console.warn("Cámara no disponible");
      setScanStatus('error');
    }
  };

  // Parar cámara al cerrar
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraReady(false);
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const processFile = async (file) => {
    if (!file) return;
    
    setIsScanning(true);
    setScanStatus('scanning');

    try {
      const formData = new FormData();
      
      // Detectar tipo
      const isPdf = file.type === 'application/pdf';
      const isCsv = file.type === 'text/csv';
      const fileName = file.name || (isPdf ? 'albaran.pdf' : 'albaran.jpg');
      
      formData.append('image', file, fileName);
      
      // Si es CSV, añadir flag
      if (isCsv) {
        formData.append('type', 'csv');
      }

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
        }, 2000);
      } else {
        setScanStatus('error');
      }
    } catch (err) {
      console.error("Error procesando archivo:", err);
      setScanStatus('error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCapture = async () => {
    if (scanStatus === 'scanning') return;
    
    if (cameraReady && videoRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
      processFile(blob);
    } else if (!cameraReady) {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  // Pantalla de selección inicial (más intuitivo para móvil)
  if (scanStatus === 'select') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-center p-6"
      >
        {/* Header */}
        <div className="w-full flex justify-between items-center mb-8">
          <button onClick={onClose} className="p-3 rounded-full bg-white/10 text-white">
            <X className="w-6 h-6" />
          </button>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <span className="text-xs font-bold text-white uppercase tracking-widest">Cargar Albarán</span>
          </div>
          <div className="w-12"></div>
        </div>

        {/* Opciones de carga */}
        <div className="w-full max-w-sm space-y-4">
          {/* Opción 1: Cámara */}
          <button
            onClick={startCamera}
            className="w-full p-6 bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl flex items-center gap-4 active:scale-95 transition-transform"
          >
            <div className="p-3 bg-white/20 rounded-xl">
              <FileImage className="w-8 h-8 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-bold text-white">Escanear con Cámara</p>
              <p className="text-xs text-white/80">Para fotos de albaranes en papel</p>
            </div>
          </button>

          {/* Opción 2: Subir archivo */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-6 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl flex items-center gap-4 active:scale-95 transition-transform"
          >
            <div className="p-3 bg-white/20 rounded-xl">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-bold text-white">Seleccionar Archivo</p>
              <p className="text-xs text-white/80">PDF, JPG, PNG o CSV desde descargas/email</p>
            </div>
          </button>

          {/* Input oculto pero con accept ampliado */}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*,.pdf,.csv,application/pdf,text/csv"
            onChange={handleFileSelect}
          />
        </div>

        <p className="text-xs text-slate-500 mt-8 text-center">
          Los archivos se procesan en el servidor y no se guardan en el dispositivo
        </p>
      </motion.div>
    );
  }

  // Cámara activada - mostrar visor
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Input para archivos (oculto) */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,.pdf,.csv,application/pdf,text/csv"
        onChange={handleFileSelect}
      />

      {/* Header Escáner */}
      <div className="p-4 flex justify-between items-center z-20 bg-black/80 backdrop-blur-md">
        <button onClick={() => { stopCamera(); setScanStatus('select'); }} className="p-2 rounded-full bg-white/10 text-white">
          <X className="w-6 h-6" />
        </button>
        <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Cámara</span>
        </div>
        <button className="p-2 rounded-full bg-white/10 text-white">
          <Zap className="w-6 h-6" />
        </button>
      </div>

      {/* Visor de Cámara - responsive */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Guías de Escaneo - responsive */}
        <div className="relative z-20 w-full max-w-xs aspect-[3/4] mx-4">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-orange-500 rounded-tl" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-orange-500 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-orange-500 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-orange-500 rounded-br" />
        </div>

        {/* Feedback de Estado */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mx-4">
          {scanStatus === 'scanning' && (
            <div className="text-center bg-black/70 p-6 rounded-2xl backdrop-blur-md border border-white/5">
              <RefreshCw className="w-12 h-12 text-orange-500 animate-spin mb-2 mx-auto" />
              <p className="text-xs text-orange-500 font-bold uppercase tracking-widest">Procesando...</p>
            </div>
          )}
          
          {scanStatus === 'success' && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center bg-black/80 p-6 rounded-2xl backdrop-blur-xl border border-orange-500/30 w-full"
            >
              <CheckCircle2 className="w-14 h-14 text-orange-500 mb-2 mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Éxito</p>
              <p className="text-lg font-bold text-white">{detectedData?.detectedAddress}</p>
            </motion.div>
          )}

          {scanStatus === 'error' && (
            <div className="text-center p-6">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-2 mx-auto" />
              <p className="text-sm text-white font-bold">No se pudo procesar</p>
              <p className="text-xs text-slate-400 mt-2">Intenta con otro archivo</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Botón Captura (más pequeño y visible) */}
      <div className="p-6 flex flex-col items-center gap-3 bg-black safe-area-bottom">
        <button 
          onClick={handleCapture}
          disabled={scanStatus === 'scanning'}
          className={`h-16 w-16 rounded-full border-2 flex items-center justify-center transition-all ${
            scanStatus === 'scanning' ? 'border-slate-800' : 'border-white active:scale-90 shadow-lg'
          }`}
        >
          {scanStatus !== 'scanning' && <div className="h-12 w-12 rounded-full bg-white" />}
        </button>
        <p className="text-xs text-slate-400 uppercase">
          {cameraReady ? 'Capturar' : 'Seleccionar archivo'}
        </p>
      </div>
    </motion.div>
  );
};

export default Scanner;