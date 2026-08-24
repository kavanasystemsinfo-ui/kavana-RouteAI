// Backfill: convierte PINs legacy en texto plano a scrypt. Se ejecuta en cada arranque; es un no-op cuando todos los
// PINs ya están hasheados. verifyPin() acepta formato plano mientras tanto,
// así que no hay ventana de bloqueo para repartidores.
import { isHashedPin, hashPin } from './pinHash.js';

export async function backfillPinHashes(db) {
  if (db._type === 'pg') {
    const pool = db._pool;
    const res = await pool.query('SELECT id, pin FROM drivers');
    let converted = 0;
    for (const row of res.rows) {
      if (!isHashedPin(row.pin)) {
        await pool.query('UPDATE drivers SET pin = $1 WHERE id = $2', [hashPin(row.pin), row.id]);
        converted++;
      }
    }
    if (converted > 0) console.log(`[pin-backfill] ${converted} PIN(s) legacy hasheados con scrypt.`);
    return;
  }
  // JSON store
  let converted = 0;
  for (const d of db._store.drivers) {
    if (!isHashedPin(d.pin)) {
      d.pin = hashPin(d.pin);
      converted++;
    }
  }
  if (converted > 0) { db._save(); console.log(`[pin-backfill] ${converted} PIN(s) legacy hasheados con scrypt.`); }
}
