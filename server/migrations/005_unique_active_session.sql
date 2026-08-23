-- 005: garantía de unicidad de sesión activa por driver.
-- Auditoría adversarial 2026-08-23 (P0-3): startSession hacía INSERT directo
-- sin restricción; dos requests concurrentes podían crear 2 sesiones activas
-- para el mismo repartidor (SELECT-then-INSERT no es atómico).
-- Índice único parcial: solo aplica a filas status='active'.
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_sessions_active
  ON driver_sessions(driver_id)
  WHERE status = 'active';
