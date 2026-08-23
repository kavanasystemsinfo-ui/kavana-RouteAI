-- 004: marca la transición a PINs hasheados (scrypt) en drivers.pin.
-- Auditoría adversarial 2026-08-23 (P0-1): drivers.pin era TEXT plano.
-- El cálculo del hash lo hace el arranque de la app (backfillPinHashes en
-- index.js, con pinHash.js) porque pgcrypto no soporta scrypt. Esta
-- migración solo documenta el estado y añade un comentario de columna.
COMMENT ON COLUMN drivers.pin IS 'scrypt$<saltHex>$<hashHex> — legacy plano aceptado por verifyPin() hasta backfill';
