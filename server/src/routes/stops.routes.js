// Stops endpoints — RouteAI (P3: extraído de api.js)
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireDriver, requireDriverOwnsStop } from '../auth.js';
import { generatePOD } from '../services/pdfService.js';
import { PODS_DIR, INCIDENTS_DIR } from '../storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function stopsRouter(db) {
  const q = db.queries;
  const router = express.Router();

  async function esStopDemo(stopId) {
    const stops = await q.listStops(db);
    const stop = stops.find((s) => String(s.id) === String(stopId));
    if (!stop) return false;
    const drivers = await q.listDrivers(db);
    const driver = drivers.find((d) => d.id === stop.driver_id);
    return !!(driver && driver.is_demo);
  }

  const absoluteUrl = (req, relPath) => {
    const host = req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return `${proto}://${host}${relPath}`;
  };

  // Stops list — driver solo ve sus paradas; oficina puede filtrar por driver.
  // G6 (auditoría 2026-08-22): ?lite=1 excluye items/session_id/expira_en del
  // payload (MB con 12k filas demo). La app del repartidor NO usa lite.
  router.get('/stops', requireAuth(['office', 'driver']), async (req, res) => {
    try {
      let { driver_id, status, from, to, lite } = req.query;
      if (req.user.role === 'driver') driver_id = String(req.user.driverId);
      const stops = await q.listStops(db, {
        driver_id: driver_id !== undefined ? Number(driver_id) : undefined,
        status: status || undefined, from: from || undefined, to: to || undefined,
        lite: lite === '1' && req.user.role === 'office',
      });
      const drivers = await q.listDrivers(db);
      const demoDriverIds = new Set(drivers.filter((d) => d.is_demo).map((d) => d.id));
      res.json(stops.map(({ signature, ...rest }) => ({ ...rest, is_demo: demoDriverIds.has(rest.driver_id) })));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Bulk stops
  router.post('/stops/bulk', requireAuth(['driver', 'office']), async (req, res) => {
    try {
      const { addresses, items, driver_id: bodyDriverId } = req.body;
      const driver_id = req.user.role === 'driver' ? req.user.driverId : (bodyDriverId || null);
      if (!addresses || !Array.isArray(addresses) || addresses.length === 0) return res.status(400).json({ error: 'Array de direcciones requerido' });
      // P1 (auditoría 2026-08-23): tope de superficie de DoS — sin límite,
      // un solo request podía crear decenas de miles de filas.
      const MAX_BULK = 100;
      if (addresses.length > MAX_BULK) return res.status(413).json({ error: `Máximo ${MAX_BULK} direcciones por request` });
      const created = [];
      let stopNumber = Date.now();
      const itemsJson = items && items.length > 0 ? JSON.stringify(items) : '';
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        const stopItems = i === 0 ? itemsJson : '';
        const id = await q.addStop(db, stopNumber++, addr, 'pending', driver_id, stopItems);
        created.push({ id, stop_number: stopNumber - 1, address: addr, items: stopItems ? items.length : 0 });
      }
      res.json({ success: true, created, total: created.length });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Update stop (V2)
  router.patch('/stops/:id', requireAuth(['driver']), requireDriverOwnsStop(db), async (req, res) => {
    try {
      const { id } = req.params;
      const { status, signature, address, receiverName, items, delivery_notes } = req.body;
      const blindado = await esStopDemo(Number(id));
      if (blindado) return res.status(403).json({ error: 'Parada de la demo histórica: solo lectura' });

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
            return res.json({ success: true, pod_url: absoluteUrl(req, podUrl) });
          } catch (podErr) { console.error('Error generando POD:', podErr); }
        }
        return res.json({ success: true });
      }
      if (address) { await q.updateStop(db, Number(id), { address }); return res.json({ success: true }); }
      if (items !== undefined || delivery_notes !== undefined) {
        const updates = {};
        if (items !== undefined) updates.items = typeof items === 'string' ? items : JSON.stringify(items);
        if (delivery_notes !== undefined) updates.delivery_notes = delivery_notes;
        await q.updateStop(db, Number(id), updates);
        return res.json({ success: true });
      }
      await q.updateStop(db, Number(id), { status: status || 'pending', signature: signature || null, receiver_name: receiverName || null });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // DELETE single stop
  router.delete('/stops/:id', requireAuth(['driver', 'office']), requireDriverOwnsStop(db), async (req, res) => {
    try {
      const blindado = await esStopDemo(Number(req.params.id));
      if (blindado) return res.status(403).json({ error: 'Parada de la demo histórica: solo lectura' });
      await q.deleteStop(db, Number(req.params.id));
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Clear all stops (visitante, no demo) — SOLO oficina: un driver no puede
  // vaciar la ruta de la empresa (IDOR detectado en auditoría 2026-08-17).
  router.delete('/stops', requireAuth(['office']), async (req, res) => {
    try {
      const stops = await q.listStops(db);
      const drivers = await q.listDrivers(db);
      const demoDriverIds = new Set(drivers.filter((d) => d.is_demo).map((d) => d.id));
      const borrables = stops.filter((s) => !demoDriverIds.has(s.driver_id));
      for (const s of borrables) await q.deleteStop(db, s.id);
      res.json({ success: true, deleted: borrables.length });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Incident report — SOLO sobre paradas propias (IDOR auditoría 2026-08-17):
  // requireDriverOwnsStop evita que un driver marque paradas ajenas.
  router.post('/stops/:id/incident', requireAuth(['driver']), requireDriverOwnsStop(db), async (req, res) => {
    try {
      const { id } = req.params;
      const blindado = await esStopDemo(Number(id));
      if (blindado) return res.status(403).json({ error: 'Parada de la demo histórica: solo lectura' });
      const { type, photo_data, notes } = req.body;
      let photo_url = null;
      if (photo_data && photo_data.startsWith('data:image')) {
        const matches = photo_data.match(/^data:image\/(\w+);base64,(.+)$/);
        // P1 (auditoría 2026-08-23): máx 5 MB de foto decodificada — evita
        // que un request de 10 MB (límite express.json) se convierta en
        // escrituras gigantes repetidas al volumen persistente.
        const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
        if (matches) {
          if (matches[2].length * 0.75 > MAX_PHOTO_BYTES) {
            return res.status(413).json({ error: 'Foto demasiado grande (máx 5 MB)' });
          }
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const incidentsDir = INCIDENTS_DIR;
          if (!fs.existsSync(incidentsDir)) fs.mkdirSync(incidentsDir, { recursive: true });
          const filename = `incident_${id}_${Date.now()}.${ext}`;
          fs.writeFileSync(path.join(incidentsDir, filename), buffer);
          photo_url = `/incidents/${filename}`;
        }
      }
      await q.addIncident(db, Number(id), type, photo_url || photo_data?.slice(0, 50) || '', notes);
      await q.updateStop(db, Number(id), { status: 'incident' });
      res.json({ success: true, photo_url });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // POD URL — SOLO la oficina o el driver dueño de la parada (IDOR auditoría
  // 2026-08-17): la firma del receptor es dato sensible de otro repartidor.
  router.get('/stops/:id/pod', requireAuth(['office', 'driver']), requireDriverOwnsStop(db), async (req, res) => {
    try {
      const podsDir = PODS_DIR;
      const files = fs.existsSync(podsDir) ? fs.readdirSync(podsDir).filter((f) => f.includes(`_${req.params.id}_`) && f.endsWith('.pdf')) : [];
      if (files.length > 0) return res.redirect(`/pods/${files[0]}`);
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
