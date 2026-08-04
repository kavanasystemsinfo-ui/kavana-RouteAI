// Servidor Express KAVANA RouteFleet.
import express from 'express';
import dbModule from './db.js';
import apiRouter from './routes/api.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// PODs en ./pods relativo al cwd (server/) para coincidir con pdfService.
const PODS_DIR = path.join(process.cwd(), 'pods');

// Orígenes permitidos (CORS). Por defecto admite la Pages de GitHub y cualquier
// origen en desarrollo. Ampliable vía env CORS_ORIGINS (separado por comas).
const ALLOWED = (process.env.CORS_ORIGINS || 'https://kavanasystemsinfo-ui.github.io').split(',').map((s) => s.trim());

export function createServer(db) {
  const app = express();

  // Middleware CORS (debe ir antes de las rutas)
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

  app.use(express.json());
  app.use('/api', apiRouter(db));
  // Sirve los PODs generados como descarga directa.
  if (!fs.existsSync(PODS_DIR)) fs.mkdirSync(PODS_DIR, { recursive: true });
  app.use('/pods', express.static(PODS_DIR));
  return app;
}

// Arranque solo si se ejecuta directamente.
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = dbModule.initDb();
  const app = createServer(db);
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`KAVANA RouteFleet API en puerto ${PORT}`));
}
