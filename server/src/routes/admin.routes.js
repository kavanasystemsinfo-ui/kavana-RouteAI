// Admin + misc endpoints — RouteAI (P3: extraído de api.js)
import express from 'express';
import { requireAuth } from '../auth.js';

export default function adminRouter(db) {
  const q = db.queries;
  const router = express.Router();

  // Dashboard metrics
  router.get('/dashboard-data', requireAuth(['office']), async (req, res) => {
    try {
      const { from, to } = req.query;
      const stops = await q.listStops(db, { from: from || undefined, to: to || undefined });
      const settings = await q.getSettings(db);
      const dashboardStops = stops.map(({ signature, ...rest }) => ({ ...rest, pod_url: null }));
      const metrics = { total: stops.length, delivered: stops.filter((s) => s.status === 'delivered').length, pending: stops.filter((s) => s.status === 'pending').length, incidents: stops.filter((s) => s.status === 'incident').length };
      res.json({ metrics, stops: dashboardStops, settings });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Settings
  router.get('/settings', requireAuth(['office']), async (req, res) => {
    try { res.json(await q.getSettings(db)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  router.put('/settings', requireAuth(['office']), async (req, res) => {
    try {
      for (const [key, value] of Object.entries(req.body)) { if (value !== undefined) await q.setSetting(db, key, value); }
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Admin sessions history
  router.get('/driver/sessions', requireAuth(['office']), async (req, res) => {
    try {
      const { from, to } = req.query;
      const f = from ? new Date(from).getTime() : null;
      const t = to ? new Date(to + 'T23:59:59').getTime() : null;
      const drivers = await q.listDrivers(db);
      const allSessions = [];
      for (const d of drivers) {
        const sessions = await q.listSessions(db, d.id);
        for (const s of sessions) {
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

  // Incidents list
  router.get('/incidents', requireAuth(['office']), async (req, res) => {
    try {
      const { from, to } = req.query;
      const f = from ? new Date(from).getTime() : null;
      const t = to ? new Date(to + 'T23:59:59').getTime() : null;
      const allIncidents = await q.listIncidents(db);
      const rangoIncidents = allIncidents.filter((inc) => {
        const t0 = inc.created_at ? new Date(inc.created_at).getTime() : null;
        if (f !== null && (t0 === null || t0 < f)) return false;
        if (t !== null && (t0 === null || t0 > t)) return false;
        return true;
      });
      const allStops = await q.listStops(db, { from: from || undefined, to: to || undefined });
      const allDrivers = await q.listDrivers(db);
      res.json(rangoIncidents.map((inc) => {
        const stop = allStops.find((s) => s.id === inc.stop_id);
        const driver = allDrivers.find((d) => d.id === stop?.driver_id);
        let photo_data = inc.photo_data || '';
        if (photo_data.length > 200) photo_data = '/incidents/legacy';
        return { ...inc, photo_data, driver_name: driver?.name || '—', address: stop?.address || '—' };
      }));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Cleanup expired visitor data
  router.post('/cleanup-expired', requireAuth(['office']), async (req, res) => {
    try {
      const result = await q.cleanupExpired(db);
      res.json({ success: true, ...result });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Technical assistant (RAG)
  const assistantLimits = new Map();
  router.post('/assistant', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== 'string' || question.trim().length < 4) return res.status(400).json({ error: 'Escribe una pregunta (mínimo 4 caracteres)' });
      if (question.length > 500) return res.status(400).json({ error: 'La pregunta es demasiado larga (máximo 500 caracteres)' });

      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      const ahora = Date.now();
      const limite = assistantLimits.get(ip);
      if (!limite || limite.resetAt < ahora) assistantLimits.set(ip, { count: 1, resetAt: ahora + 24 * 3600 * 1000 });
      else if (limite.count >= 25) return res.status(429).json({ error: 'Has alcanzado el límite de preguntas de hoy (25). Vuelve mañana o pregúntale directamente a Jorge.' });
      else limite.count += 1;

      const { responderPregunta } = await import('../services/assistantService.js');
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Asistente no configurado (falta OPENROUTER_API_KEY en el servidor)' });
      const result = await responderPregunta(apiKey, question.trim());
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error en /assistant:', error.message);
      res.status(500).json({ error: 'El asistente falló al responder. Inténtalo de nuevo en un momento.' });
    }
  });

  return router;
}
