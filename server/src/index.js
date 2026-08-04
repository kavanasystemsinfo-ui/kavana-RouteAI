// Servidor Express KAVANA Route AI.
import express from 'express';
import { initDb } from './db.js';
import apiRouter from './routes/api.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { seedDrivers } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PODS_DIR = path.join(process.cwd(), 'pods');

const ALLOWED = (process.env.CORS_ORIGINS || 'https://kavanasystemsinfo-ui.github.io,https://routeai.kavanasystems.com,https://www.routeai.kavanasystems.com').split(',').map((s) => s.trim());

export function createServer(db) {
  const app = express();

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
  app.use('/pods', express.static(PODS_DIR));
  return app;
}

// Arranque
const PORT = process.env.PORT || 5001;

(async () => {
  let db;
  try {
    db = await initDb();
  } catch (err) {
    console.error('[db] Error conectando a PostgreSQL, usando JSON fallback:', err.message);
    // Fallback a JSON store
    const { default: dbModule } = await import('./db.js');
    const path = await import('path');
    const os = await import('os');
    const fallbackPath = path.join(process.cwd(), 'routeai_fallback.json');
    db = await initDb(fallbackPath);
  }
  const seedResult = await seedDrivers(db);
  if (seedResult.created) console.log(`Seed: repartidor creado (id ${seedResult.id}, PIN ${process.env.DEFAULT_DRIVER_PIN || '5855'}).`);

  const app = createServer(db);

  if (process.env.OFFICE_PIN === '0000' || !process.env.OFFICE_PIN) {
    console.warn('⚠️  OFFICE_PIN usando valor por defecto (0000). Cambiar en producción vía variable de entorno.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'routeai-dev-secret-change-me') {
    console.warn('⚠️  JWT_SECRET usando valor por defecto o fallback de desarrollo. Configurar con un valor fuerte y aleatorio en producción.');
  }

  app.listen(PORT, () => console.log(`KAVANA Route AI API en puerto ${PORT}`));
})();
