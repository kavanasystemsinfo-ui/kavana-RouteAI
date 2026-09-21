-- 006: añadir columna is_demo a stops para lookup O(1) en esStopDemo
-- Evita full-scan en JS (12k filas demo) y JOIN con drivers en cada request.
-- La columna se rellena desde drivers.is_demo al crear la parada.

ALTER TABLE stops ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Índice para filtrado rápido de paradas demo en /stops y /optimize
CREATE INDEX IF NOT EXISTS idx_stops_is_demo ON stops (is_demo) WHERE is_demo = true;

-- Backfill: propagar is_demo desde drivers a stops existentes
UPDATE stops SET is_demo = d.is_demo
FROM drivers d
WHERE stops.driver_id = d.id AND d.is_demo = true AND stops.is_demo = false;