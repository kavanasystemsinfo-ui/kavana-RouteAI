// Tracking público — RouteAI.
// GET /track/:token → estado de UNA parada para el cliente final, sin login.
// El token es una clave de lookup aleatoria (24 hex), no una credencial.
// Seguridad por diseño:
//   - Sin token válido no hay datos (404, sin distinguir "existe pero es demo").
//   - No expone firma/imagen del receptor ni datos internos (id, driver, items).
//   - Rate limit propio, más estricto que la API interna (el tracking es la
//     superficie más escaneable de bots).
import express from 'express';
import { checkRateLimit, resetRateLimiter } from '../rateLimiter.js';

const STATUS_LABELS = {
  pending: 'En reparto',
  delivered: 'Entregado',
  incident: 'Incidencia',
};

// km/h medio de reparto urbano; usado solo para estimar ETA informativa.
const AVG_SPEED_KMH = 22;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function trackRouter(db) {
  const q = db.queries;
  const router = express.Router();

  router.get('/track/:token', async (req, res) => {
    try {
      // Rate limit del tracking: 30 req/min por IP. El cliente medio refresca
      // cada 30-60s; un bot escaneando tokens se corta antes de enumerar nada.
      // checkRateLimit es async (Upstash en producción, Map en dev).
      const allowed = await checkRateLimit(req.ip, 30, 60_000);
      if (!allowed) {
        return res.status(429).json({ error: 'Demasiadas consultas. Espera un momento.' });
      }
      const token = String(req.params.token || '');
      // Formato estricto: 24 hex. Corta el escaneo de basura antes de tocar BD.
      if (!/^[0-9a-f]{24}$/.test(token)) return res.status(404).json({ error: 'Enlace no válido' });

      const stop = await q.getStopByToken(db, token);
      if (!stop) return res.status(404).json({ error: 'Enlace no válido' });

      // Estado de la ruta del mismo repartidor: posición de progreso para ETA.
      // Solo si la parada está pendiente (entregada/incidente no necesita ETA).
      let eta_minutes = null;
      let pending_before = null;
      if (stop.status === 'pending' && stop.driver_id) {
        const driverStops = await q.listStops(db, { driver_id: stop.driver_id, status: 'pending' });
        const sorted = driverStops.slice().sort((a, b) => (a.stop_number || 0) - (b.stop_number || 0));
        const idx = sorted.findIndex((s) => String(s.id) === String(stop.id));
        pending_before = idx > 0 ? idx : 0; // paradas pendientes por delante
        if (idx >= 0 && sorted[idx].lat != null && sorted[idx].lng != null) {
          // Distancia desde la parada pendiente anterior (posición aproximada
          // del repartidor: su última parada pendiente previa o el origen).
          let distKm = 0;
          if (idx > 0 && sorted[idx - 1].lat != null && sorted[idx - 1].lng != null) {
            distKm += haversineKm(
              { lat: sorted[idx - 1].lat, lng: sorted[idx - 1].lng },
              { lat: sorted[idx].lat, lng: sorted[idx].lng }
            );
          }
          if (distKm > 0) eta_minutes = Math.max(5, Math.round((distKm / AVG_SPEED_KMH) * 60) + pending_before * 4);
        }
      }

      const payload = {
        success: true,
        stop: {
          status: stop.status,
          status_label: STATUS_LABELS[stop.status] || 'En reparto',
          address: stop.address,
          eta_minutes,
          pending_before,
          stop_number: stop.stop_number,
          delivered_at: stop.status === 'delivered' ? (stop.updated_at || null) : null,
          is_demo: stop.is_demo === true,
        },
      };
      res.json(payload);
    } catch (error) {
      // Sin detail: no filtrar internos (stack, SQL) en una ruta pública.
      res.status(500).json({ error: 'Error consultando el seguimiento' });
    }
  });

  return router;
}
