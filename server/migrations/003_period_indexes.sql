-- 003: índices para los filtros de periodo (from/to) que usa la Torre de Control.
-- Auditoría adversarial 2026-08-22 (G6): /stops, /incidents, /driver/sessions y
-- /dashboard-data filtran por created_at/started_at y no había índice → seq scan
-- con 12k+ paradas en cada refresco del panel.
CREATE INDEX IF NOT EXISTS idx_stops_created_at ON stops(created_at);
CREATE INDEX IF NOT EXISTS idx_stops_driver_created ON stops(driver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_driver_sessions_started ON driver_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
