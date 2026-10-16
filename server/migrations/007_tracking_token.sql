-- 007: token público de seguimiento + coordenadas de parada.
-- tracking_token: permite al cliente final consultar el estado de SU entrega
-- con un enlace único (GET /track/:token) sin login. El endpoint filtra
-- is_demo y devuelve solo estado/dirección/ETA/firma.
-- lat/lng: la optimización ya geocodifica en memoria; persistir las
-- coordenadas permite calcular ETA por parada sin re-geocodificar en cada
-- consulta pública (y sin quemar Nominatim con el tráfico del tracking).
-- Ver docs/adr/009-seguimiento-publico.md para la decisión completa.

ALTER TABLE stops ADD COLUMN IF NOT EXISTS tracking_token CHAR(24) DEFAULT NULL;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION DEFAULT NULL;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stops_tracking_token
  ON stops (tracking_token) WHERE tracking_token IS NOT NULL;

-- Backfill: token para paradas existentes (incluidas demo, para que el
-- histórico blindado también sea rastreable de cara al visitante).
UPDATE stops SET tracking_token = substr(md5(random()::text || clock_timestamp()::text), 1, 24)
WHERE tracking_token IS NULL;
