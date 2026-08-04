// Servidor Express KAVANA RouteFleet.
import express from 'express';
import dbModule from './db.js';
import apiRouter from './routes/api.js';

export function createServer(db) {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter(db));
  return app;
}

// Arranque solo si se ejecuta directamente.
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = dbModule.initDb();
  const app = createServer(db);
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`KAVANA RouteFleet API en puerto ${PORT}`));
}
