// Auth endpoints — RouteAI (P3: extraído de api.js, P7a: rate limiting)
import express from 'express';
import { signToken, requireAuth } from '../auth.js';

const loginLimits = new Map(); // ip → {count, resetAt}

export function resetLoginLimits() { loginLimits.clear(); }

function checkRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const limit = loginLimits.get(ip);
  if (!limit || limit.resetAt < now) {
    loginLimits.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return next();
  }
  const maxAttempts = process.env.NODE_ENV === 'production' ? 10 : 50;
  if (limit.count >= maxAttempts) return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' });
  limit.count++;
  return next();
}

export default function authRouter(db) {
  const q = db.queries;
  const router = express.Router();

  // Driver login (con rate limiting)
  router.post('/drivers/login', checkRateLimit, async (req, res) => {
    try {
      const { pin } = req.body;
      const drivers = await q.listDrivers(db);
      const d = drivers.find((x) => String(x.pin) === String(pin) && x.active);
      if (!d) return res.status(401).json({ error: 'PIN incorrecto' });
      if (d.is_demo) return res.status(403).json({ error: 'Repartidor de la demo histórica: acceso restringido' });
      const token = signToken({ role: 'driver', driverId: d.id });
      res.json({ success: true, token, driver: { id: d.id, name: d.name } });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Office login (con rate limiting)
  router.post('/office/login', checkRateLimit, (req, res) => {
    try {
      const { pin } = req.body;
      const officePin = process.env.OFFICE_PIN || '0000';
      if (pin !== officePin) return res.status(401).json({ error: 'PIN incorrecto' });
      const token = signToken({ role: 'office' });
      res.json({ success: true, token });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
