// Auth endpoints — RouteAI (P3: extraído de api.js, P7a: rate limiting)
import express from 'express';
import crypto from 'crypto';
import { signToken, requireAuth } from '../auth.js';
import { verifyPin } from '../pinHash.js';
import { resetRateLimiter } from '../rateLimiter.js';
import { recordAuth } from '../metrics.js';

// Comparación timing-safe de PINs (misma longitud tras hash SHA-256).
function pinsMatch(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Helper para setear cookie httpOnly con el JWT
function setTokenCookie(res, token) {
  res.cookie('rf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8h = TTL del JWT
    path: '/'
  });
}

function clearTokenCookie(res) {
  res.clearCookie('rf_token', { path: '/' });
}

export function resetLoginLimits() { return resetRateLimiter(); }

export default function authRouter(db) {
  const q = db.queries;
  const router = express.Router();

  // Driver login (sin rate limit en demo — evita bloqueo en Render free)
  router.post('/drivers/login', async (req, res) => {
    try {
      const { pin } = req.body;
      const drivers = await q.listActiveDrivers(db);
      const d = drivers.find((x) => verifyPin(pin, x.pin));
      if (!d) {
        recordAuth('pin', false);
        return res.status(401).json({ error: 'PIN incorrecto' });
      }
      if (d.is_demo) return res.status(403).json({ error: 'Repartidor de la demo histórica: acceso restringido' });
      const token = signToken({ role: 'driver', driverId: d.id });
      setTokenCookie(res, token);
      recordAuth('pin', true);
      res.json({ success: true, driver: { id: d.id, name: d.name }, token });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Office login (sin rate limit en demo)
  router.post('/office/login', async (req, res) => {
    try {
      const { pin } = req.body;
      const officePin = process.env.OFFICE_PIN || (process.env.NODE_ENV === 'production' ? null : '0000');
      if (!officePin) return res.status(500).json({ error: 'OFFICE_PIN no configurado en el servidor' });
      if (!pinsMatch(pin, officePin)) {
        recordAuth('office', false);
        return res.status(401).json({ error: 'PIN incorrecto' });
      }
      const token = signToken({ role: 'office' });
      setTokenCookie(res, token);
      recordAuth('office', true);
      res.json({ success: true, token });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Logout - limpia la cookie
  router.post('/logout', (req, res) => {
    clearTokenCookie(res);
    res.json({ success: true });
  });

  return router;
}
