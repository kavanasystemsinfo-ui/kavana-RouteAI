import express from 'express';
import { processManifestImage } from '../services/ocrService.js';
import { optimizeRoute } from '../services/aiService.js';
import { generatePOD } from '../services/pdfService.js';
import { geocodeAddress } from '../services/geocode.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dbModule from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { cleanAddress } from '../services/addressCleaner.js';

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
  // Multer para subida de imagenes - usa memoria en vez de disco (Render free no tiene disco persistente)
  const upload = multer({ storage: multer.memoryStorage() });

  // Dashboard metrics (Torre de Control) — solo oficina
  router.get('/dashboard-data', requireAuth(['office']), (req, res) => {
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

  // Obtener configuración financiera — solo oficina
  router.get('/settings', requireAuth(['office']), (req, res) => {
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

  // --- Repartidores (drivers) — solo oficina ---
  router.get('/drivers', requireAuth(['office']), (req, res) => {
    try {
      res.json(queries.listDrivers(db));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/drivers', requireAuth(['office']), async (req, res) => {
    try {
      const { name, pin, phone, email } = req.body;
      if (!name || !pin) return res.status(400).json({ error: 'name y pin requeridos' });
      const id = queries.addDriver(db, name, pin, phone || '', email || '');
      // Enviar email de bienvenida con instrucciones de descarga (SMTP/Resend).
      // No bloquea la respuesta si el email falla.
      let emailResult = { sent: false, dev: false };
      try {
        const { sendDriverWelcome } = await import('../services/emailService.js');
        emailResult = await sendDriverWelcome({ name, email: email || '', pin });
      } catch (mailErr) {
        console.error('Error enviando email de bienvenida:', mailErr.message);
      }
      res.json({ success: true, id, emailSent: emailResult.sent, emailDev: emailResult.dev });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch('/drivers/:id', requireAuth(['office']), (req, res) => {
    try {
      const { active } = req.body;
      if (active !== undefined) queries.setDriverActive(db, Number(req.params.id), active);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Login de repartidor por PIN -> JWT role driver
  router.post('/drivers/login', (req, res) => {
    try {
      const { pin } = req.body;
      const drivers = queries.listDrivers(db);
      const d = drivers.find((x) => String(x.pin) === String(pin) && x.active);
      if (!d) return res.status(401).json({ error: 'PIN incorrecto' });
      const token = signToken({ role: 'driver', driverId: d.id });
      res.json({ success: true, token, driver: { id: d.id, name: d.name } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Login de oficina (PIN único de empresa) -> JWT role office
  router.post('/office/login', (req, res) => {
    try {
      const { pin } = req.body;
      const officePin = process.env.OFFICE_PIN || '0000';
      if (pin !== officePin) return res.status(401).json({ error: 'PIN incorrecto' });
      const token = signToken({ role: 'office' });
      res.json({ success: true, token });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Obtener todas las paradas (con filtros) — solo oficina
  router.get('/stops', requireAuth(['office', 'driver']), (req, res) => {
    try {
      const { driver_id, status, from, to } = req.query;
      const stops = queries.listStops(db, {
        driver_id: driver_id !== undefined ? Number(driver_id) : undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined
      });
      res.json(stops);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- OCR / Subida de albaranes ---
  // Acepta imágenes (JPG/PNG), PDFs y CSV
  router.post('/ocr', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Archivo requerido (imagen, PDF o CSV)' });
      
      const buffer = req.file.buffer;
      const fileType = req.file.mimetype;
      const fileTypeFlag = req.body.type || '';
      
      const isPdf = fileType === 'application/pdf' || fileTypeFlag === 'pdf';
      const isCsv = fileType === 'text/csv' || fileTypeFlag === 'csv';
      
      // Guardar buffer temporal para procesamiento
      const tmpPath = `/tmp/ocr_${Date.now()}_${req.file.originalname || 'file'}`;
      fs.writeFileSync(tmpPath, buffer);
      
      const result = await processManifestImage(tmpPath, isPdf, isCsv);
      
      // Extraer TODAS las direcciones encontradas
      let addresses = [];
      if (result.raw) {
        // Buscar todas las líneas que contienen direcciones
        const lines = result.raw.split('\n');
        for (const line of lines) {
          const addr = cleanAddress(line.trim());
          if (addr && addr.length > 5) {
            addresses.push(addr);
          }
        }
      }
      
      // Limpiar archivo temporal
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      
      if (addresses.length > 0) {
        res.json({ 
          success: true, 
          addresses,
          detectedAddress: addresses[0], // Primera dirección para compatibilidad
          totalAddresses: addresses.length
        });
      } else {
        res.json({ success: false, error: 'No se detectó dirección en el archivo' });
      }
    } catch (error) {
      console.error('Error OCR:', error);
      res.status(500).json({ error: error.message || 'Error interno procesando archivo' });
    }
  });

  // Procesar OCR (Manual) -> crea parada — solo repartidor autenticado
  router.post('/ocr_manual', requireAuth(['driver']), (req, res) => {
    try {
      const { address, stop_number, driver_id } = req.body;
      queries.addStop(db, stop_number, address, 'pending', driver_id ? Number(driver_id) : null);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Crear múltiples paradas a la vez (desde OCR de PDF/albarán)
  router.post('/stops/bulk', requireAuth(['driver']), (req, res) => {
    try {
      const { addresses, driver_id } = req.body;
      if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: 'Array de direcciones requerido' });
      }
      
      const created = [];
      let stopNumber = Date.now();
      for (const addr of addresses) {
        const id = queries.addStop(db, stopNumber++, addr, 'pending', driver_id ? Number(driver_id) : null);
        created.push({ id, stop_number: stopNumber - 1, address: addr });
      }
      
      res.json({ success: true, created, total: created.length });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Optimizar Ruta (IA) — geocodifica origen + paradas y reordena en la BD.
  // Body: { origin: { text } | { lat, lng }, stops: [{ id, address }] }
  router.post('/optimize', async (req, res) => {
    try {
      const { stops, origin } = req.body;
      const stopsList = stops || queries.listStops(db);
      if (!stopsList || stopsList.length === 0) {
        return res.status(400).json({ error: 'No hay paradas para optimizar' });
      }

      // 1) Geocodificar origen (texto -> lat/lng, o usar lat/lng directo).
      let originCoords = null;
      if (origin && typeof origin === 'object') {
        if (typeof origin.lat === 'number' && typeof origin.lng === 'number') {
          originCoords = { lat: origin.lat, lng: origin.lng };
        } else if (origin.text) {
          originCoords = await geocodeAddress(origin.text);
        }
      }
      if (!originCoords) {
        // Fallback: Valencia centro si no hay origen válido.
        originCoords = { lat: 39.47, lng: -0.38 };
      }

      // 2) Geocodificar cada parada (solo las que no tengan ya lat/lng).
      const geoStops = [];
      for (const s of stopsList) {
        let coord = (typeof s.lat === 'number' && typeof s.lng === 'number')
          ? { lat: s.lat, lng: s.lng }
          : await geocodeAddress(s.address);
        geoStops.push({ id: s.id, address: s.address, lat: coord?.lat ?? null, lng: coord?.lng ?? null });
      }
      const unlocated = geoStops.filter((s) => s.lat === null);
      if (unlocated.length > 0) {
        console.warn('Paradas no geocodificadas:', unlocated.map((s) => s.address));
      }

      // 3) Optimizar (IA DeepSeek o fallback greedy local).
      const result = await optimizeRoute(geoStops, originCoords);

      // 4) Reordenar paradas en la BD según la ruta optimizada.
      for (let i = 0; i < result.route.length; i++) {
        const stop = result.route[i];
        queries.updateStop(db, stop.id, { stop_number: i + 1 });
      }

      const updated = queries.listStops(db);
      res.json({
        success: true,
        engine: result.engine,
        message: result.engine === 'ai-deepseek' ? 'Ruta optimizada por IA' : 'Ruta optimizada (algoritmo local)',
        stops: updated,
        unlocated: unlocated.map((s) => s.address)
      });
    } catch (error) {
      console.error('AI Error:', error.message);
      res.status(500).json({ error: 'Error optimizando ruta: ' + error.message });
    }
  });

  // Actualizar estado o firma de una parada — solo repartidor autenticado
  router.patch('/stops/:id', requireAuth(['driver']), async (req, res) => {
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

  // Borrar una parada — solo repartidor autenticado
  router.delete('/stops/:id', requireAuth(['driver']), (req, res) => {
    try {
      queries.deleteStop(db, Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Borrar todas las paradas
  router.delete('/stops', requireAuth(['driver']), (req, res) => {
    try {
      queries.clearStops(db);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Registrar una incidencia — solo repartidor autenticado
  router.post('/stops/:id/incident', requireAuth(['driver']), (req, res) => {
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

  // Obtener URL del POD de una parada, si existe. — oficina o repartidor
  router.get('/stops/:id/pod', requireAuth(['office', 'driver']), async (req, res) => {
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
        const podPath = await generatePOD(stop, stop.signature);
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
