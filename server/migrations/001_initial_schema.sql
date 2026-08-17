-- 001: esquema inicial de KAVANA Route AI (extraído de db.js SCHEMA_SQL)
-- Idempotente por diseño (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS):
-- la migración 001 debe poder correr sobre una BD que ya tenga el esquema
-- creado por el arranque anterior del MVP.

CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS stops (
  id SERIAL PRIMARY KEY,
  stop_number BIGINT NOT NULL,
  address TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  driver_id INTEGER REFERENCES drivers(id),
  signature TEXT,
  receiver_name TEXT,
  distance TEXT,
  estimated_time TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE stops ALTER COLUMN stop_number TYPE BIGINT;

ALTER TABLE stops ADD COLUMN IF NOT EXISTS items TEXT DEFAULT '';
ALTER TABLE stops ADD COLUMN IF NOT EXISTS delivery_notes TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  stop_id INTEGER REFERENCES stops(id),
  type TEXT,
  photo_data TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pods (
  stop_id INTEGER PRIMARY KEY REFERENCES stops(id),
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS driver_sessions (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id),
  km_initial NUMERIC(10,3),
  km_final NUMERIC(10,3),
  km_total NUMERIC(10,3),
  date DATE DEFAULT CURRENT_DATE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  status TEXT DEFAULT 'active'
);

-- Migración: añadir columnas de coste por vehículo (si no existen)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT '';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cost_per_km NUMERIC(10,2) DEFAULT 0;

-- Migración: ampliar decimales de km (1 → 3 decimales)
ALTER TABLE driver_sessions ALTER COLUMN km_initial TYPE NUMERIC(10,3);
ALTER TABLE driver_sessions ALTER COLUMN km_final TYPE NUMERIC(10,3);
ALTER TABLE driver_sessions ALTER COLUMN km_total TYPE NUMERIC(10,3);

-- Migración: blindaje de datos demo (solo lectura) + sesiones de visitante
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS session_id TEXT DEFAULT '';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS expira_en TIMESTAMP;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS session_id TEXT DEFAULT '';
ALTER TABLE stops ADD COLUMN IF NOT EXISTS expira_en TIMESTAMP;