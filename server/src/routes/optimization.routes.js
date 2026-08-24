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
      let { stops, origin } = req.body;
      // un driver solo puede optimizar SUS paradas.
      // El body del cliente manda {id, address} sin driver_id, así que la
      // propiedad se valida contra la BD por id (nunca confiar en el body).
      if (req.user.role === 'driver') {
        if (!stops) {
          stops = await q.listStops(db, { driver_id: req.user.driverId });
        } else {
          const ids = stops.map((s) => s.id).filter((x) => x !== undefined && x !== null);
          const allStops = await q.listStops(db);
          for (const id of ids) {
            const stop = allStops.find((s) => String(s.id) === String(id));
            if (!stop) return res.status(404).json({ error: `Parada ${id} no encontrada` });
            if (String(stop.driver_id) !== String(req.user.driverId)) {
              return res.status(403).json({ error: 'No puedes optimizar paradas de otros repartidores' });
            }
          }
        }
      }
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

      // Blindaje demo: las paradas de drivers
      // is_demo son solo lectura — /optimize no puede renumerarlas. El
      // ownership se resuelve SIEMPRE contra la BD (el body puede traer stops
      // sin driver_id, como ya hace la validación IDOR de arriba).
      const allStopsForDemo = await q.listStops(db);
      const driversAll = await q.listDrivers(db);
      const demoIds = new Set(driversAll.filter((d) => d.is_demo).map((d) => String(d.id)));
      const mutableRoute = route.filter((s) => {
        const real = allStopsForDemo.find((x) => String(x.id) === String(s.id));
        return !real || !demoIds.has(String(real.driver_id));
      });
      for (let i = 0; i < mutableRoute.length; i++) await q.updateStop(db, mutableRoute[i].id, { stop_number: i + 1 });
      const updated = await q.listStops(db);
      // Un driver solo recibe en la respuesta SUS paradas (no las de la empresa).
      const visible = req.user.role === 'driver'
        ? updated.filter((s) => String(s.driver_id) === String(req.user.driverId))
        : updated;
      res.json({ success: true, message: unlocated.length > 0 ? `Ruta optimizada (${unlocated.length} sin geocodificar al final)` : 'Ruta optimizada', stops: visible, unlocated: unlocated.map((s) => s.address) });
    } catch (error) { res.status(500).json({ error: 'Error optimizando ruta: ' + error.message }); }
  });

  return router;
}
