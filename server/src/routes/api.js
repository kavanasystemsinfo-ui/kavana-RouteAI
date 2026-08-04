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
      const { from, to } = req.query;
      const stops = await q.listStops(db, {
        from: from || undefined,
        to: to || undefined
      });
      const settings = await q.getSettings(db);
      const podsDir = path.join(__dirname, '../../pods');
      let podsFiles = [];
      if (fs.existsSync(podsDir)) podsFiles = fs.readdirSync(podsDir).filter((f) => f.endsWith('.pdf'));
      const dashboardStops = stops.map((stop) => {
        const podFile = podsFiles.find((f) => f.includes(`_${stop.id}_`));
        // Quitar la firma base64 del payload (el POD la genera bajo demanda)
        const { signature, ...rest } = stop;
        return { ...rest, pod_url: podFile ? `/pods/${podFile}` : null };
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

  router.put('/settings', requireAuth(['office']), async (req, res) => {
    try {
      for (const [key, value] of Object.entries(req.body)) {
        if (value !== undefined) await q.setSetting(db, key, value);
      }
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Sessions (admin) — historial de jornadas de conductores
  router.get('/driver/sessions', requireAuth(['office']), async (req, res) => {
    try {
      const { from, to } = req.query;
      // Comparar como timestamps (ms), no strings: node-postgres devuelve
      // started_at como objeto Date y Date < string da NaN (nunca filtra).
      const f = from ? new Date(from).getTime() : null;
      const t = to ? new Date(to + 'T23:59:59').getTime() : null;
      const drivers = await q.listDrivers(db);
      const allSessions = [];
      for (const d of drivers) {
        const sessions = await q.listSessions(db, d.id);
        for (const s of sessions) {
          // Filtrar por rango de fechas (started_at de la jornada)
          const t0 = s.started_at ? new Date(s.started_at).getTime() : null;
          if (f !== null && (t0 === null || t0 < f)) continue;
          if (t !== null && (t0 === null || t0 > t)) continue;
          allSessions.push({ ...s, driver_name: d.name });
        }
      }
      allSessions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      res.json(allSessions);
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
      const { id } = req.params;
      const { active, fuel_type, cost_per_km } = req.body;
      if (active !== undefined) await q.setDriverActive(db, Number(id), active);
      if (fuel_type !== undefined || cost_per_km !== undefined) await q.updateDriverCost(db, Number(id), fuel_type, cost_per_km);
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

  // Driver session — iniciar jornada (km iniciales)
  router.post('/driver/session/start', requireAuth(['driver']), async (req, res) => {
    try {
      const { km_initial } = req.body;
      if (!km_initial && km_initial !== 0) return res.status(400).json({ error: 'km_initial requerido' });
      const driverId = req.user.driverId;
      // Cerrar sesión activa previa si existe
      const active = await q.getActiveSession(db, driverId);
      if (active) await q.endSession(db, active.id, km_initial); // si no cerró, usamos km_initial como final también
      const id = await q.startSession(db, driverId, parseFloat(km_initial));
      res.json({ success: true, session_id: id, km_initial: parseFloat(km_initial) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Driver session — cerrar jornada (km finales)
  router.post('/driver/session/end', requireAuth(['driver']), async (req, res) => {
    try {
      const { km_final } = req.body;
      if (!km_final && km_final !== 0) return res.status(400).json({ error: 'km_final requerido' });
      const driverId = req.user.driverId;
      const active = await q.getActiveSession(db, driverId);
      if (!active) return res.status(400).json({ error: 'No hay sesión activa' });
      const km_total = await q.endSession(db, active.id, parseFloat(km_final));
      res.json({ success: true, session_id: active.id, km_initial: active.km_initial, km_final: parseFloat(km_final), km_total });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Driver session — obtener sesión activa
  router.get('/driver/session', requireAuth(['driver']), async (req, res) => {
    try {
      const session = await q.getActiveSession(db, req.user.driverId);
      res.json({ success: true, session });
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
      // No enviar la firma base64 en el listado general (payload enorme).
      // El POD (PDF con firma) se genera bajo demanda en /stops/:id/pod.
      const sinFirma = stops.map(({ signature, ...rest }) => rest);
      res.json(sinFirma);
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
      // Extraer items directamente aqui (evita depender de la version desplegada de ocrService)
      const items = [];
      const stopKeywords = ['total', 'subtotal', 'iva', 'importe', 'firma', 'recibi', 'entregado', 'observaciones', 'notas', 'cliente', 'direccion', 'fecha', 'albaran', 'nº', 'telefono', 'contacto'];
      if (result.raw) {
        const allLines = result.raw.split('\n');
        for (const line of allLines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const lower = trimmed.toLowerCase();
          if (stopKeywords.some(kw => lower.startsWith(kw))) continue;
          // Patron tabla con codigo: "1  VIN-001  Producto    6  ..."
          let m = trimmed.match(/^\d+\s+([A-Z]{2,5}-\d{2,5})\s+(.+?)\s{2,}(\d{1,4})\s/i);
          if (m) {
            const qty = parseInt(m[3], 10);
            const name = m[2].trim();
            if (qty > 0 && qty < 10000 && name.length > 1 && !name.match(/\d{5}/)) {
              items.push({ name: name.replace(/^[-.\s]+|[-.\s]+$/g, '').replace(/\s{2,}/g, ' ').trim(), qty, checked: false });
            }
            continue;
          }
          // Patron tabla sin codigo: "1  Producto    6  ..."
          m = trimmed.match(/^\d+\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ][\w\sáéíóúñÁÉÍÓÚÑ()%+\-.]{3,}?)\s{2,}(\d{1,4})\s/i);
          if (m) {
            const qty = parseInt(m[2], 10);
            const name = m[1].trim();
            if (qty > 0 && qty < 10000 && name.length > 1 && !name.match(/\d{5}/)) {
              items.push({ name: name.replace(/^[-.\s]+|[-.\s]+$/g, '').replace(/\s{2,}/g, ' ').trim(), qty, checked: false });
            }
          }
        }
      }
      if (result.raw) {
        const lines = result.raw.split('\n');
        // Palabras que indican que una linea NO es una direccion de entrega
        const skipPatterns = [
          /^[A-Z\s]{5,}$/,           // TODO MAYUSCULAS (nombres de empresa)
          /CIF|NIF|DNI/i,             // identificadores fiscales
          /^\d{4,6}\s/,              // codigos postales solos al inicio
          /T[eé]l/i,                  // telefonos
          /^\d{3}\s\d{2}/,           // "961 23..." telefonos
          /@/,                        // emails
          /^www\./i,                  // URLs
          /^\d+[.,]\d{2}\s*EUR/,     // precios
        ];
        for (const line of lines) {
          const cleaned = line.trim().replace(/^\d+\s{2,}/, '');
          // Saltar lineas que claramente no son direcciones
          if (skipPatterns.some(p => p.test(cleaned))) continue;
          const addr = cleanAddress(cleaned);
          // Solo aceptar si contiene un indicador de via publica (Calle, C/, Avenida, etc.)
          const hasStreet = /\b(Calle|C\/|Avenida|Av\.?|Avda\.?|Carrer|Ronda|Paseo|Plaza|Ctra\.?|Camino|Pol[ií]gono|Calleja|Traves[ií]a|Glorieta|Pasaje|Urbanizaci[oó]n)\b/i.test(addr);
          if (addr && addr.length > 10 && hasStreet) addresses.push(addr);
        }
        // Si no se encontro ninguna con calle, usar result.address como fallback
        if (addresses.length === 0 && result.address && result.address.length > 5) {
          addresses.push(result.address);
        }
      }
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      if (addresses.length > 0) {
        res.json({ success: true, addresses, items, detectedAddress: addresses[0], totalAddresses: addresses.length, totalItems: items.length });
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

  // Bulk stops (V2: acepta items/bultos precargados desde OCR)
  router.post('/stops/bulk', requireAuth(['driver', 'office']), async (req, res) => {
    try {
      const { addresses, items, driver_id } = req.body;
      if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: 'Array de direcciones requerido' });
      }
      const created = [];
      let stopNumber = Date.now();
      const itemsJson = items && items.length > 0 ? JSON.stringify(items) : '';
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        const stopItems = i === 0 ? itemsJson : '';
        const id = await q.addStop(db, stopNumber++, addr, 'pending', driver_id ? Number(driver_id) : null, stopItems);
        created.push({ id, stop_number: stopNumber - 1, address: addr, items: stopItems ? items.length : 0 });
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

  // Update stop (V2: acepta items, delivery_notes y entrega con firma)
  router.patch('/stops/:id', requireAuth(['driver']), async (req, res) => {
    try {
      const { id } = req.params;
      const { status, signature, address, receiverName, items, delivery_notes } = req.body;

      // Entrega con firma → actualizar todo + generar POD
      if (status === 'delivered' && signature) {
        const updates = { status: 'delivered', signature, receiver_name: receiverName || null };
        if (items !== undefined) updates.items = typeof items === 'string' ? items : JSON.stringify(items);
        if (delivery_notes !== undefined) updates.delivery_notes = delivery_notes;
        await q.updateStop(db, Number(id), updates);

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
        res.json({ success: true });
        return;
      }

      // Cambio de direccion
      if (address) {
        await q.updateStop(db, Number(id), { address });
        res.json({ success: true });
        return;
      }

      // Actualizacion de items o delivery_notes (sin entrega)
      if (items !== undefined || delivery_notes !== undefined) {
        const updates = {};
        if (items !== undefined) updates.items = typeof items === 'string' ? items : JSON.stringify(items);
        if (delivery_notes !== undefined) updates.delivery_notes = delivery_notes;
        await q.updateStop(db, Number(id), updates);
        res.json({ success: true });
        return;
      }

      // Fallback generico
      await q.updateStop(db, Number(id), { status: status || 'pending', signature: signature || null, receiver_name: receiverName || null });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // DELETE stop (driver y office pueden borrar)
  router.delete('/stops/:id', requireAuth(['driver', 'office']), async (req, res) => {
    try { await q.deleteStop(db, Number(req.params.id)); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Clear all stops (driver y office pueden)
  router.delete('/stops', requireAuth(['driver', 'office']), async (req, res) => {
    try { await q.clearStops(db); res.json({ success: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Incident
  router.post('/stops/:id/incident', requireAuth(['driver']), async (req, res) => {
    try {
      const { id } = req.params;
      const { type, photo_data, notes } = req.body;
      // Guardar foto en disco en vez de en base64 en la BD
      let photo_url = null;
      if (photo_data && photo_data.startsWith('data:image')) {
        const matches = photo_data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const incidentsDir = path.join(__dirname, '../../incidents');
          if (!fs.existsSync(incidentsDir)) fs.mkdirSync(incidentsDir, { recursive: true });
          const filename = `incident_${id}_${Date.now()}.${ext}`;
          fs.writeFileSync(path.join(incidentsDir, filename), buffer);
          photo_url = `/incidents/${filename}`;
        }
      }
      await q.addIncident(db, Number(id), type, photo_url || photo_data?.slice(0,50) || '', notes);
      await q.updateStop(db, Number(id), { status: 'incident' });
      res.json({ success: true, photo_url });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // List incidents (admin)
  router.get('/incidents', requireAuth(['office']), async (req, res) => {
    try {
      const { from, to } = req.query;
      // Comparar como timestamps (ms): node-postgres devuelve created_at como Date
      const f = from ? new Date(from).getTime() : null;
      const t = to ? new Date(to + 'T23:59:59').getTime() : null;
      const allIncidents = await q.listIncidents(db);
      // Filtrar por rango de fechas (created_at del incidente, alineado con su parada)
      const rangoIncidents = allIncidents.filter((inc) => {
        const t0 = inc.created_at ? new Date(inc.created_at).getTime() : null;
        if (f !== null && (t0 === null || t0 < f)) return false;
        if (t !== null && (t0 === null || t0 > t)) return false;
        return true;
      });
      const allStops = await q.listStops(db, { from: from || undefined, to: to || undefined });
      const allDrivers = await q.listDrivers(db);
      const enriched = rangoIncidents.map((inc) => {
        const stop = allStops.find((s) => s.id === inc.stop_id);
        const driver = allDrivers.find((d) => d.id === stop?.driver_id);
        // Si la foto es base64, dejar solo indicador (el base64 es enorme)
        let photo_data = inc.photo_data || '';
        if (photo_data.length > 200) photo_data = '/incidents/legacy';
        return { ...inc, photo_data, driver_name: driver?.name || '—', address: stop?.address || '—' };
      });
      res.json(enriched);
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // POD URL
  router.get('/stops/:id/pod', requireAuth(['office', 'driver']), async (req, res) => {
    try {
      const podsDir = path.join(__dirname, '../../pods');
      const files = fs.existsSync(podsDir)
        ? fs.readdirSync(podsDir).filter((f) => f.includes(`_${req.params.id}_`) && f.endsWith('.pdf'))
        : [];
      if (files.length > 0) {
        // Redirigir directamente al archivo PDF
        return res.redirect(`/pods/${files[0]}`);
      }
      const allStops = await q.listStops(db);
      const stop = allStops.find((s) => String(s.id) === String(req.params.id));
      if (stop && stop.status === 'delivered' && stop.signature) {
        const podPath = await generatePOD(stop, stop.signature);
        const podUrl = `/pods/${path.basename(podPath)}`;
        await q.savePod(db, Number(req.params.id), podUrl);
        return res.redirect(podUrl);
      }
      return res.status(404).json({ error: 'Sin POD' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
