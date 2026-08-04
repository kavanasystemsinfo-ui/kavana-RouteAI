import express from 'express';
import { processManifestImage } from '../services/ocrService.js';
import { optimizeRoute } from '../services/aiService.js';
import { generatePOD } from '../services/pdfService.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dbModule from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Factory: recibe la conexion de BD para permitir inyeccion en tests.
// Usa siempre la capa `queries` (sin SQL directo) para ser agnostic de la BD.
export default function apiRouter(db) {
  db = db || dbModule.initDb();
  const { queries } = dbModule;
  const router = express.Router();

  // Construye la URL absoluta de un recurso servido por este backend
  // (ej. PODs), usando el host real de la peticion. Asi el frontend
  // puede usarla directamente sin concatenar origenes.
  const absoluteUrl = (req, relPath) => {
    const host = req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return `${proto}://${host}${relPath}`;
  };
  // Multer para subida de imagenes (incidentes)
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
  });
  const upload = multer({ storage });

  // Dashboard metrics (Torre de Control)
  router.get('/dashboard-data', (req, res) => {
    try {
      const stops = queries.listStops(db);
      const settings = queries.getSettings(db);
      const podsDir = path.join(__dirname, '../../pods');
      let podsFiles = [];
      if (fs.existsSync(podsDir)) {
        podsFiles = fs.readdirSync(podsDir).filter((f) => f.endsWith('.pdf'));
      }
      const dashboardStops = stops.map((stop) => {
        const podFile = podsFiles.find((f) => f.includes(`_${stop.id}_`));
        return { ...stop, pod_url: podFile ? `/pods/${podFile}` : null };
      });
      const metrics = {
        total: stops.length,
        delivered: stops.filter((s) => s.status === 'delivered').length,
        pending: stops.filter((s) => s.status === 'pending').length,
        incidents: stops.filter((s) => s.status === 'incident').length
      };
      res.json({ metrics, stops: dashboardStops, settings });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obtener configuracion financiera (OPEX)
  router.get('/settings', (req, res) => {
    try {
      res.json(queries.getSettings(db));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Actualizar configuracion financiera (Tarifas OPEX)
  router.put('/settings', (req, res) => {
    try {
      const { cost_per_km, cost_per_hour } = req.body;
      if (cost_per_km !== undefined) queries.setSetting(db, 'cost_per_km', cost_per_km);
      if (cost_per_hour !== undefined) queries.setSetting(db, 'cost_per_hour', cost_per_hour);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obtener todas las paradas
  router.get('/stops', (req, res) => {
    try {
      res.json(queries.listStops(db));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Procesar OCR (Automatico)
  router.post('/ocr', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });
      await processManifestImage(req.file.path);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Procesar OCR (Manual) -> crea parada
  router.post('/ocr_manual', (req, res) => {
    try {
      const { address, stop_number } = req.body;
      queries.addStop(db, stop_number, address, 'pending');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Optimizar Ruta (IA)
  router.post('/optimize', async (req, res) => {
    try {
      const { stops } = req.body;
      await optimizeRoute(stops);
      res.json({ success: true });
    } catch (error) {
      console.error('AI Error:', error.message);
      res.status(500).json({ error: 'Error optimizando ruta: ' + error.message });
    }
  });

  // Actualizar estado o firma de una parada
  router.patch('/stops/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, signature, address, receiverName } = req.body;
      if (address) {
        queries.updateStop(db, Number(id), { address });
      } else {
        queries.updateStop(db, Number(id), {
          status: status || 'pending',
          signature: signature || null,
          receiver_name: receiverName || null
        });
        // MODULO POD: si es entrega con firma, generar PDF y devolver URL
        if (status === 'delivered' && signature) {
          const stopData = queries.listStops(db).find((s) => String(s.id) === String(id));
          if (stopData) {
            stopData.receiver_name = receiverName || 'No especificado';
            try {
              const podPath = await generatePOD(stopData, signature);
              const podUrl = `/pods/${path.basename(podPath)}`;
              queries.savePod(db, Number(id), podUrl);
              res.json({ success: true, pod_url: absoluteUrl(req, podUrl) });
              return;
            } catch (podErr) {
              console.error('❌ Error generando POD:', podErr);
            }
          }
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error(`FATAL en PATCH /stops/${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Borrar una parada
  router.delete('/stops/:id', (req, res) => {
    try {
      queries.deleteStop(db, Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Borrar todas las paradas
  router.delete('/stops', (req, res) => {
    try {
      queries.clearStops(db);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Registrar una incidencia
  router.post('/stops/:id/incident', (req, res) => {
    try {
      const { id } = req.params;
      const { type, photo_data, notes } = req.body;
      queries.addIncident(db, Number(id), type, photo_data, notes);
      queries.updateStop(db, Number(id), { status: 'incident' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obtener URL del POD de una parada, si existe.
  router.get('/stops/:id/pod', (req, res) => {
    try {
      const podsDir = path.join(__dirname, '../../pods');
      const files = fs.existsSync(podsDir)
        ? fs.readdirSync(podsDir).filter((f) => f.includes(`_${req.params.id}_`) && f.endsWith('.pdf'))
        : [];
      if (files.length > 0) {
        return res.json({ pod_url: `/pods/${files[0]}` });
      }
      // Si no hay archivo pero la parada fue entregada con firma, regenerar al vuelo
      // (los PODs en Render son efímeros tras spin-down).
      const stop = queries.listStops(db).find((s) => String(s.id) === String(req.params.id));
      if (stop && stop.status === 'delivered' && stop.signature) {
        const podPath = generatePOD(stop, stop.signature);
        const podUrl = `/pods/${path.basename(podPath)}`;
        queries.savePod(db, Number(req.params.id), podUrl);
        return res.json({ pod_url: absoluteUrl(req, podUrl) });
      }
      return res.status(404).json({ error: 'Sin POD' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
