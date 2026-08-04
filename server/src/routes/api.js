import express from 'express';
import { processManifestImage } from '../services/ocrService.js';
import { generatePOD } from '../services/pdfService.js';
import { geocodeAddress } from '../services/geocode.js';
import { optimizeRoute } from '../services/routeOptimizer.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { signToken, requireAuth } from '../auth.js';
import { cleanAddress } from '../services/addressCleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function apiRouter(db) {
  const q = db.queries;
  const router = express.Router();

  const absoluteUrl = (req, relPath) => {
    const host = req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return `${proto}://${host}${relPath}`;
  };

  const upload = multer({ storage: multer.memoryStorage() });

  // Dashboard metrics
  router.get('/dashboard-data', requireAuth(['office']), async (req, res) => {
    try {
      const stops = await q.listStops(db);
      const settings = await q.getSettings(db);
      const podsDir = path.join(__dirname, '../../pods');
      let podsFiles = [];
      if (fs.existsSync(podsDir)) podsFiles = fs.readdirSync(podsDir).filter((f) => f.endsWith('.pdf'));
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

  // Settings
  router.get('/settings', requireAuth(['office']), async (req, res) => {
    try { res.json(await q.getSettings(db)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.put('/settings', async (req, res) => {
    try {
      const { cost_per_km, cost_per_hour } = req.body;
      if (cost_per_km !== undefined) await q.setSetting(db, 'cost_per_km', cost_per_km);
      if (cost_per_hour !== undefined) await q.setSetting(db, 'cost_per_hour', cost_per_hour);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Drivers
  router.get('/drivers', requireAuth(['office']), async (req, res) => {
    try { res.json(await q.listDrivers(db)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/drivers', requireAuth(['office']), async (req, res) => {
    try {
      const { name, pin, phone, email } = req.body;
      if (!name || !pin) return res.status(400).json({ error: 'name y pin requeridos' });
      const id = await q.addDriver(db, name, pin, phone || '', email || '');
      let emailResult = { sent: false, dev: false };
      try {
        const { sendDriverWelcome } = await import('../services/emailService.js');
        emailResult = await sendDriverWelcome({ name, email: email || '', pin });
      } catch (mailErr) { console.error('Error enviando email:', mailErr.message); }
      res.json({ success: true, id, emailSent: emailResult.sent, emailDev: emailResult.dev });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.patch('/drivers/:id', requireAuth(['office']), async (req, res) => {
    try {
      const { active } = req.body;
      if (active !== undefined) await q.setDriverActive(db, Number(req.params.id), active);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Driver login
  router.post('/drivers/login', async (req, res) => {
    try {
      const { pin } = req.body;
      const drivers = await q.listDrivers(db);
      const d = drivers.find((x) => String(x.pin) === String(pin) && x.active);
      if (!d) return res.status(401).json({ error: 'PIN incorrecto' });
      const token = signToken({ role: 'driver', driverId: d.id });
      res.json({ success: true, token, driver: { id: d.id, name: d.name } });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Office login
  router.post('/office/login', (req, res) => {
    try {
      const { pin } = req.body;
      const officePin = process.env.OFFICE_PIN || '0000';
      if (pin !== officePin) return res.status(401).json({ error: 'PIN incorrecto' });
      const token = signToken({ role: 'office' });
      res.json({ success: true, token });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Stops list
  router.get('/stops', requireAuth(['office', 'driver']), async (req, res) => {
    try {
      const { driver_id, status, from, to } = req.query;
      const stops = await q.listStops(db, {
        driver_id: driver_id !== undefined ? Number(driver_id) : undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined
      });
      res.json(stops);
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // OCR
  router.post('/ocr', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
      const buffer = req.file.buffer;
      const fileType = req.file.mimetype;
      const fileTypeFlag = req.body.type || '';
      const isPdf = fileType === 'application/pdf' || fileTypeFlag === 'pdf';
      const isCsv = fileType === 'text/csv' || fileTypeFlag === 'csv';
      const tmpPath = `/tmp/ocr_${Date.now()}_${req.file.originalname || 'file'}`;
      fs.writeFileSync(tmpPath, buffer);
      const result = await processManifestImage(tmpPath, isPdf, isCsv);
      let addresses = [];
      if (result.raw) {
        const lines = result.raw.split('\n');
        for (const line of lines) {
          // Limpiar prefijos tipo "N       " (número de parada + espacios)
          const cleaned = line.trim().replace(/^\d+\s{2,}/, '');
          const addr = cleanAddress(cleaned);
          if (addr && addr.length > 5) addresses.push(addr);
        }
      }
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      if (addresses.length > 0) {
        res.json({ success: true, addresses, detectedAddress: addresses[0], totalAddresses: addresses.length });
      } else {
        res.json({ success: false, error: 'No se detectó dirección en el archivo' });
      }
    } catch (error) {
      console.error('Error OCR:', error);
      res.status(500).json({ error: error.message || 'Error interno procesando archivo' });
    }
  });

  // Manual OCR
  router.post('/ocr_manual', requireAuth(['driver']), async (req, res) => {
    try {
      const { address, stop_number, driver_id } = req.body;
      await q.addStop(db, stop_number, address, 'pending', driver_id ? Number(driver_id) : null);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Bulk stops
  router.post('/stops/bulk', requireAuth(['driver', 'office']), async (req, res) => {
    try {
      const { addresses, driver_id } = req.body;
      if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: 'Array de direcciones requerido' });
      }
      const created = [];
      let stopNumber = Date.now();
      for (const addr of addresses) {
        const id = await q.addStop(db, stopNumber++, addr, 'pending', driver_id ? Number(driver_id) : null);
        created.push({ id, stop_number: stopNumber - 1, address: addr });
      }
      res.json({ success: true, created, total: created.length });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Optimize route (algoritmo 2-opt local, sin IA)
  router.post('/optimize', async (req, res) => {
    try {
      const { stops, origin } = req.body;
      const stopsList = stops || await q.listStops(db);
      if (!stopsList || stopsList.length === 0) return res.status(400).json({ error: 'No hay paradas para optimizar' });

      let originCoords = null;
      if (origin && typeof origin === 'object') {
        if (typeof origin.lat === 'number' && typeof origin.lng === 'number') originCoords = { lat: origin.lat, lng: origin.lng };
        else if (origin.text) originCoords = await geocodeAddress(origin.text);
      }
      if (!originCoords) originCoords = { lat: 39.47, lng: -0.38 };

      // Geocodificar todas las paradas
      const geoStops = [];
      for (const s of stopsList) {
        let coord = (typeof s.lat === 'number' && typeof s.lng === 'number')
          ? { lat: s.lat, lng: s.lng } : await geocodeAddress(s.address);
        geoStops.push({ id: s.id, address: s.address, lat: coord?.lat ?? null, lng: coord?.lng ?? null });
      }
      const unlocated = geoStops.filter((s) => s.lat === null);
      const located = geoStops.filter((s) => s.lat !== null);

      let route;
      if (located.length === 0) {
        // Sin coordenadas, mantener orden original
        route = geoStops;
      } else if (located.length === 1) {
        route = geoStops;
      } else if (unlocated.length > 0) {
        // Optimizar solo las geocodificadas, dejar el resto al final
        const optimized = optimizeRoute(located, originCoords);
        route = [...optimized, ...unlocated];
      } else {
        route = optimizeRoute(located, originCoords);
      }

      // Guardar orden en base de datos
      for (let i = 0; i < route.length; i++) {
        await q.updateStop(db, route[i].id, { stop_number: i + 1 });
      }

      const updated = await q.listStops(db);
      res.json({
        success: true,
        message: unlocated.length > 0
          ? `Ruta optimizada (${unlocated.length} dirección(es) sin geocodificar se dejaron al final)`
          : 'Ruta optimizada',
        stops: updated, unlocated: unlocated.map((s) => s.address)
      });
    } catch (error) { res.status(500).json({ error: 'Error optimizando ruta: ' + error.message }); }
  });

  // Update stop
  router.patch('/stops/:id', requireAuth(['driver']), async (req, res) => {
    try {
      const { id } = req.params;
      const { status, signature, address, receiverName } = req.body;
      if (address) {
        await q.updateStop(db, Number(id), { address });
      } else {
        await q.updateStop(db, Number(id), { status: status || 'pending', signature: signature || null, receiver_name: receiverName || null });
        if (status === 'delivered' && signature) {
          const allStops = await q.listStops(db);
          const stopData = allStops.find((s) => String(s.id) === String(id));
          if (stopData) {
            stopData.receiver_name = receiverName || 'No especificado';
            try {
              const podPath = await generatePOD(stopData, signature);
              const podUrl = `/pods/${path.basename(podPath)}`;
              await q.savePod(db, Number(id), podUrl);
              res.json({ success: true, pod_url: absoluteUrl(req, podUrl) });
              return;
            } catch (podErr) { console.error('Error generando POD:', podErr); }
          }
        }
      }
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Delete stop
  router.delete('/stops/:id', requireAuth(['driver']), async (req, res) => {
    try { await q.deleteStop(db, Number(req.params.id)); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Clear all stops
  router.delete('/stops', requireAuth(['driver']), async (req, res) => {
    try { await q.clearStops(db); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Incident
  router.post('/stops/:id/incident', requireAuth(['driver']), async (req, res) => {
    try {
      const { id } = req.params;
      const { type, photo_data, notes } = req.body;
      await q.addIncident(db, Number(id), type, photo_data, notes);
      await q.updateStop(db, Number(id), { status: 'incident' });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // POD URL
  router.get('/stops/:id/pod', requireAuth(['office', 'driver']), async (req, res) => {
    try {
      const podsDir = path.join(__dirname, '../../pods');
      const files = fs.existsSync(podsDir)
        ? fs.readdirSync(podsDir).filter((f) => f.includes(`_${req.params.id}_`) && f.endsWith('.pdf'))
        : [];
      if (files.length > 0) return res.json({ pod_url: `/pods/${files[0]}` });
      const allStops = await q.listStops(db);
      const stop = allStops.find((s) => String(s.id) === String(req.params.id));
      if (stop && stop.status === 'delivered' && stop.signature) {
        const podPath = await generatePOD(stop, stop.signature);
        const podUrl = `/pods/${path.basename(podPath)}`;
        await q.savePod(db, Number(req.params.id), podUrl);
        return res.json({ pod_url: absoluteUrl(req, podUrl) });
      }
      return res.status(404).json({ error: 'Sin POD' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
