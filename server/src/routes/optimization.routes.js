// Route optimization — RouteAI (P3: extraído de api.js)
import express from 'express';
import { requireAuth } from '../auth.js';
import { geocodeAddress } from '../services/geocode.js';
import { optimizeRoute } from '../services/routeOptimizer.js';

export default function optimizationRouter(db) {
  const q = db.queries;
  const router = express.Router();

  router.post('/optimize', requireAuth(['driver', 'office']), async (req, res) => {
    try {
      const { stops, origin } = req.body;
      const stopsList = stops || await q.listStops(db);
      if (!stopsList || stopsList.length === 0) return res.status(400).json({ error: 'No hay paradas para optimizar' });

      let originCoords = null;
      if (origin && typeof origin === 'object') {
        if (typeof origin.lat === 'number' && typeof origin.lng === 'number') originCoords = { lat: origin.lat, lng: origin.lng };
        else if (origin.text) originCoords = await geocodeAddress(origin.text);
      }
      if (!originCoords) originCoords = { lat: 39.47, lng: -0.38 };

      const geoStops = [];
      for (const s of stopsList) {
        let coord = (typeof s.lat === 'number' && typeof s.lng === 'number')
          ? { lat: s.lat, lng: s.lng } : await geocodeAddress(s.address);
        geoStops.push({ id: s.id, address: s.address, lat: coord?.lat ?? null, lng: coord?.lng ?? null });
      }
      const unlocated = geoStops.filter((s) => s.lat === null);
      const located = geoStops.filter((s) => s.lat !== null);
      let route;
      if (located.length === 0) route = geoStops;
      else if (located.length === 1) route = geoStops;
      else if (unlocated.length > 0) route = [...optimizeRoute(located, originCoords), ...unlocated];
      else route = optimizeRoute(located, originCoords);

      for (let i = 0; i < route.length; i++) await q.updateStop(db, route[i].id, { stop_number: i + 1 });
      const updated = await q.listStops(db);
      res.json({ success: true, message: unlocated.length > 0 ? `Ruta optimizada (${unlocated.length} sin geocodificar al final)` : 'Ruta optimizada', stops: updated, unlocated: unlocated.map((s) => s.address) });
    } catch (error) { res.status(500).json({ error: 'Error optimizando ruta: ' + error.message }); }
  });

  return router;
}
