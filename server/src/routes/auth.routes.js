// Auth endpoints — RouteAI (P3: extraído de api.js)
import express from 'express';
import { signToken, requireAuth } from '../auth.js';

export default function authRouter(db) {
  const q = db.queries;
  const router = express.Router();

  // Driver login
  router.post('/drivers/login', async (req, res) => {
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

  // Office login
  router.post('/office/login', (req, res) => {
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
