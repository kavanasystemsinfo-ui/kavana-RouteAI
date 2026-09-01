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

  // Admin sessions history — G6: una sola query con
  // JOIN y filtro from/to en SQL (antes: 1 query por driver + filtro en JS).
  router.get('/driver/sessions', requireAuth(['office']), async (req, res) => {
    try {
      const { from, to } = req.query;
      const f = from ? new Date(from) : null;
      const t = to ? new Date(to + 'T23:59:59') : null;
      const sessions = await q.listSessionsJoined(db, { from: f || undefined, to: t || undefined });
      res.json(sessions);
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Incidents list — G6: JOINs en SQL en vez de cargar
  // TODAS las incidencias + paradas + drivers y resolver con find() O(n·m).
  router.get('/incidents', requireAuth(['office']), async (req, res) => {
    try {
      const { from, to } = req.query;
      const f = from ? new Date(from) : null;
      const t = to ? new Date(to + 'T23:59:59') : null;
      const rows = await q.listIncidentsJoined(db, { from: f || undefined, to: t || undefined });
      res.json(rows.map((inc) => {
        let photo_data = inc.photo_data || '';
        if (photo_data.length > 200) photo_data = '/incidents/legacy';
        return { ...inc, photo_data, driver_name: inc.driver_name || '—', address: inc.address || '—' };
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

      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      const ahora = Date.now();
      const limite = assistantLimits.get(ip);
      if (!limite || limite.resetAt < ahora) assistantLimits.set(ip, { count: 1, resetAt: ahora + 24 * 3600 * 1000 });
      else if (limite.count >= 15) return res.status(429).json({ error: 'Has alcanzado el límite de preguntas de hoy (15). Vuelve mañana o pregúntale directamente a Jorge.' });
      else limite.count += 1;

      const { responderPregunta } = await import('../services/assistantService.js');
      const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY;
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
