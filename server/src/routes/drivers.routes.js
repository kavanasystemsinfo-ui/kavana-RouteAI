// Drivers + sessions endpoints — RouteAI (P3: extraído de api.js)
import express from 'express';
import { requireAuth } from '../auth.js';

export default function driversRouter(db) {
  const q = db.queries;
  const router = express.Router();

  // ── Drivers CRUD ──
  router.get('/drivers', requireAuth(['office']), async (req, res) => {
    try { res.json(await q.listDrivers(db)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/drivers', requireAuth(['office']), async (req, res) => {
    try {
      const { name, pin, phone, email, session_id } = req.body;
      if (!name || !pin) return res.status(400).json({ error: 'name y pin requeridos' });
      // Auditoría 2026-08-22 (G3): PIN de 4-6 dígitos obligatorio — sin esto
      // un PIN de 1 dígito reduce el espacio de búsqueda a 10.
      if (!/^\d{4,6}$/.test(String(pin))) return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 dígitos' });
      const expiraEn = session_id ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
      const id = await q.addDriver(db, name, pin, phone || '', email || '', { session_id: session_id || '', expira_en: expiraEn });
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
      const drivers = await q.listDrivers(db);
      const target = drivers.find((d) => String(d.id) === String(id));
      if (target && target.is_demo) return res.status(403).json({ error: 'Repartidor de la demo histórica: solo lectura' });
      if (active !== undefined) await q.setDriverActive(db, Number(id), active);
      if (fuel_type !== undefined || cost_per_km !== undefined) await q.updateDriverCost(db, Number(id), fuel_type, cost_per_km);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // ── Driver sessions (individual) ──
  router.post('/driver/session/start', requireAuth(['driver']), async (req, res) => {
    try {
      const { km_initial } = req.body;
      if (!km_initial && km_initial !== 0) return res.status(400).json({ error: 'km_initial requerido' });
      const driverId = req.user.driverId;
      const active = await q.getActiveSession(db, driverId);
      if (active) await q.endSession(db, active.id, km_initial);
      const id = await q.startSession(db, driverId, parseFloat(km_initial));
      res.json({ success: true, session_id: id, km_initial: parseFloat(km_initial) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

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

  router.get('/driver/session', requireAuth(['driver']), async (req, res) => {
    try {
      const session = await q.getActiveSession(db, req.user.driverId);
      res.json({ success: true, session });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
