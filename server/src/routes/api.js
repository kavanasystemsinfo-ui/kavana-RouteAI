// API Router — RouteAI (orquestador delgado tras P3)
// Cada módulo de ruta se monta aquí. Antes: 606 líneas en un archivo. Ahora: ~16 líneas + módulos.
import express from 'express';
import authRouter from './auth.routes.js';
import driversRouter from './drivers.routes.js';
import stopsRouter from './stops.routes.js';
import ocrRouter from './ocr.routes.js';
import optimizationRouter from './optimization.routes.js';
import adminRouter from './admin.routes.js';

export default function apiRouter(db) {
  const router = express.Router();
  router.use(authRouter(db));
  router.use(driversRouter(db));
  router.use(stopsRouter(db));
  router.use(ocrRouter(db));
  router.use(optimizationRouter(db));
  router.use(adminRouter(db));
  return router;
}
