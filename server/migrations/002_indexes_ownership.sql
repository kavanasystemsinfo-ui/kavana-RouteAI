-- 002: índices para ownership y consultas de la Torre de Control.
-- La auditoría 2026-08-17 detectó consultas O(n) en el panel con 12.000+
-- paradas demo. Estos índices hacen que los JOINs/filtros por driver y status
-- vayan por índice en vez de escaneo completo.
CREATE INDEX IF NOT EXISTS idx_stops_driver_id ON stops(driver_id);
CREATE INDEX IF NOT EXISTS idx_stops_status ON stops(status);
CREATE INDEX IF NOT EXISTS idx_incidents_stop_id ON incidents(stop_id);
CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver ON driver_sessions(driver_id);