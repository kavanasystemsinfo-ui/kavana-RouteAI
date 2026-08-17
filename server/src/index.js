// Servidor Express KAVANA Route AI.
import express from 'express';
import { initDb } from './db.js';
import apiRouter from './routes/api.js';
import { extractToken, verifyToken } from './auth.js';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';
import { seedDrivers } from './seed.js';
import { PODS_DIR, INCIDENTS_DIR } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED = (process.env.CORS_ORIGINS || 'https://kavanasystemsinfo-ui.github.io,https://routeai.kavanasystems.com,https://www.routeai.kavanasystems.com').split(',').map((s) => s.trim());

export function createServer(db) {
  const app = express();

  // Fase 1 (auditoría 2026-08-17): Render está detrás de un proxy HTTPS, así
  // que confiamos en la cabecera del edge para derivar la IP real del cliente
  // (req.ip). Con trust proxy 1, X-Forwarded-For la fija Render, no el cliente.
  app.set('trust proxy', 1);

  // CORS (antes de rutas)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || ALLOWED.includes('*') || ALLOWED.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  // Health check para Render (sin DB, responde inmediato)
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api', apiRouter(db));
  if (!fs.existsSync(PODS_DIR)) fs.mkdirSync(PODS_DIR, { recursive: true });
  // /pods y /incidents requieren JWT (no se sirven públicamente) y ownership:
  // un driver solo puede leer archivos de SUS paradas. Los nombres de archivo
  // son pod_<stopId>_<ts>.pdf / incident_<stopId>_<ts>.<ext> (auditoría 2026-08-17).
  const requirePodAccess = (db) => async (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      const payload = verifyToken(token);
      if (payload.role !== 'driver') return next(); // office u otro rol de confianza
      const m = /(pod|incident)_(\d+)_/.exec(path.basename(req.path));
      if (!m) return res.status(403).json({ error: 'Archivo no reconocido' });
      const stopId = Number(m[2]);
      const allStops = await db.queries.listStops(db);
      const stop = allStops.find((s) => String(s.id) === String(stopId));
      if (!stop) return res.status(404).json({ error: 'Parada no encontrada' });
      if (String(stop.driver_id) !== String(payload.driverId)) {
        return res.status(403).json({ error: 'Ese archivo no pertenece a tu ruta' });
      }
      next();
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  };
  app.use('/pods', requirePodAccess(db), express.static(PODS_DIR));
  if (!fs.existsSync(INCIDENTS_DIR)) fs.mkdirSync(INCIDENTS_DIR, { recursive: true });
  app.use('/incidents', requirePodAccess(db), express.static(INCIDENTS_DIR));
  return app;
}

// Arranque — SOLO cuando index.js es el entry point (no al importarlo desde
// tests: cada archivo de test importaba createServer y disparaba un listen en
// el puerto 5001, provocando EADDRINUSE en CI con archivos en paralelo).
const PORT = process.env.PORT || 5001;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    let db;
    try {
      db = await initDb();
    } catch (err) {
      console.error('[db] Error conectando a PostgreSQL, usando JSON fallback:', err.message);
      // Forzar JSON store: eliminar variables PG para que initDb no reintente
      delete process.env.PGHOST;
      delete process.env.DATABASE_URL;
      const fallbackPath = path.join(process.cwd(), 'routeai_fallback.json');
      db = await initDb(fallbackPath);
    }
    const seedResult = await seedDrivers(db);
    if (seedResult.created) console.log(`Seed: repartidor creado (id ${seedResult.id}, PIN ${process.env.DEFAULT_DRIVER_PIN || '5855'}).`);

    const app = createServer(db);

    if (!process.env.OFFICE_PIN) {
      if (process.env.NODE_ENV === 'production') {
        console.error('OFFICE_PIN no configurado: la API no arranca en producción sin un PIN definido por entorno.');
        process.exit(1);
      }
      console.warn('⚠️  OFFICE_PIN usando valor por defecto (0000). Cambiar en producción vía variable de entorno.');
    } else if (process.env.OFFICE_PIN === '0000') {
      // La demo pública de portfolio usa 0000 a propósito (README/landing lo
      // publicitan). Lo importante es que venga del entorno, no del repo.
      console.log('ℹ️  OFFICE_PIN con el valor de demo (0000). En una instalación con datos reales, cámbialo.');
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'routeai-dev-secret-change-me') {
      if (process.env.NODE_ENV === 'production') {
        console.error('JWT_SECRET no configurado o con el fallback de desarrollo: la API no arranca en producción sin un secreto real.');
        process.exit(1);
      }
      console.warn('⚠️  JWT_SECRET usando valor por defecto o fallback de desarrollo. Configurar con un valor fuerte y aleatorio en producción.');
    }

    app.listen(PORT, () => console.log(`KAVANA Route AI API en puerto ${PORT}`));
  })();
}
