// Auth endpoints — RouteAI (P3: extraído de api.js, P7a: rate limiting)
import express from 'express';
import crypto from 'crypto';
import { signToken, requireAuth } from '../auth.js';
import { verifyPin } from '../pinHash.js';

const loginLimits = new Map(); // ip → {count, resetAt}
const accountLimits = new Map(); // cuenta intentada → {count, resetAt}

export function resetLoginLimits() { loginLimits.clear(); accountLimits.clear(); }

function checkRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
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

// Auditoría 2026-08-22 (G3): el rate limit por IP se evita rotando
// X-Forwarded-For. Segunda barrera por CUENTA intentada (PIN), inmune a la
// rotación de IPs. Ventana deslizante por minuto con bloqueo temporal.
const MAX_PER_ACCOUNT = process.env.NODE_ENV === 'production' ? 5 : 20;
const ACCOUNT_WINDOW_MS = 60 * 1000;

function checkAccountLimit(key) {
  const now = Date.now();
  const rec = accountLimits.get(key);
  if (!rec || rec.resetAt < now) {
    accountLimits.set(key, { count: 1, resetAt: now + ACCOUNT_WINDOW_MS });
    return true;
  }
  rec.count++;
  return rec.count <= MAX_PER_ACCOUNT;
}

// Comparación timing-safe de PINs (misma longitud tras hash SHA-256).
function pinsMatch(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export default function authRouter(db) {
  const q = db.queries;
  const router = express.Router();

  // Driver login (rate limit por IP + por PIN intentado, auditoría 2026-08-22 G3)
  router.post('/drivers/login', checkRateLimit, async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || !checkAccountLimit(`driver:${String(pin).trim()}`)) {
        return res.status(429).json({ error: 'Demasiados intentos para este código. Espera un minuto.' });
      }
      // P0 (auditoría 2026-08-23): los PINs se guardan hasheados con scrypt,
      // así que NO se puede filtrar por pin en SQL — se cargan SOLO los
      // drivers activos (filtro en BD, deuda 1 cerrada 2026-08-24: antes se
      // listaba la tabla entera) y se verifica con scrypt+salt por fila
      // (timing-safe). verifyPin acepta también PIN legacy plano durante la
      // ventana de despliegue, antes de aplicar la migración 004.
      const drivers = await q.listActiveDrivers(db);
      const d = drivers.find((x) => verifyPin(pin, x.pin));
      if (!d) return res.status(401).json({ error: 'PIN incorrecto' });
      if (d.is_demo) return res.status(403).json({ error: 'Repartidor de la demo histórica: acceso restringido' });
      const token = signToken({ role: 'driver', driverId: d.id });
      res.json({ success: true, token, driver: { id: d.id, name: d.name } });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  // Office login (con rate limiting). En desarrollo el PIN por defecto es 0000
  // (mismo criterio que el fallback de JWT_SECRET); en producción NO existe
  // fallback: el PIN debe venir de OFFICE_PIN en el entorno (auditoría 2026-08-17).
  router.post('/office/login', checkRateLimit, (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || !checkAccountLimit('office')) {
        return res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' });
      }
      const officePin = process.env.OFFICE_PIN || (process.env.NODE_ENV === 'production' ? null : '0000');
      if (!officePin) return res.status(500).json({ error: 'OFFICE_PIN no configurado en el servidor' });
      if (!pinsMatch(pin, officePin)) return res.status(401).json({ error: 'PIN incorrecto' });
      const token = signToken({ role: 'office' });
      res.json({ success: true, token });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
