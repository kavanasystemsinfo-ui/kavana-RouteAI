// Auth endpoints — RouteAI (P3: extraído de api.js, P7a: rate limiting)
import express from 'express';
import crypto from 'crypto';
import { signToken, requireAuth } from '../auth.js';
import { verifyPin } from '../pinHash.js';
import { checkRateLimit, checkAccountLimit, resetRateLimiter } from '../rateLimiter.js';
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

  // Driver login (rate limit por IP + por PIN intentado)
  router.post('/drivers/login', checkRateLimit, async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || !await checkAccountLimit(`driver:${String(pin).trim()}`)) {
        recordAuth('pin', false);
        return res.status(429).json({ error: 'Demasiados intentos para este código. Espera un minuto.' });
      }
      // P0: los PINs se guardan hasheados con scrypt,
      // así que NO se puede filtrar por pin en SQL — se cargan SOLO los
      // drivers activos (filtro en BD, antes se
      // listaba la tabla entera) y se verifica con scrypt+salt por fila
      // (timing-safe). verifyPin acepta también PIN legacy plano durante la
      // ventana de despliegue, antes de aplicar la migración 004.
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
      res.json({ success: true, driver: { id: d.id, name: d.name } });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Office login (con rate limiting). En desarrollo el PIN por defecto es 0000
  // (mismo criterio que el fallback de JWT_SECRET); en producción NO existe
  // fallback: el PIN debe venir de OFFICE_PIN en el entorno.
  router.post('/office/login', checkRateLimit, async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || !await checkAccountLimit('office')) {
        recordAuth('office', false);
        return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' });
      }
      const officePin = process.env.OFFICE_PIN || (process.env.NODE_ENV === 'production' ? null : '0000');
      if (!officePin) return res.status(500).json({ error: 'OFFICE_PIN no configurado en el servidor' });
      if (!pinsMatch(pin, officePin)) {
        recordAuth('office', false);
        return res.status(401).json({ error: 'PIN incorrecto' });
      }
      const token = signToken({ role: 'office' });
      setTokenCookie(res, token);
      recordAuth('office', true);
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Logout - limpia la cookie
  router.post('/logout', (req, res) => {
    clearTokenCookie(res);
    res.json({ success: true });
  });

  return router;
}
