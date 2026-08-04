// Seed mínimo: asegura que el repartidor por defecto exista siempre.
// Causa raíz del bug "repartidor desaparecido": en Render free el JSON store
// es efímero y se borra en cada reinicio. Este seed lo revive al arrancar.
// Con PostgreSQL (DATABASE_URL) el seed es redundante pero inocuo.
import * as dbModule from './db.js';

export async function seedDrivers(db) {
  const pin = process.env.DEFAULT_DRIVER_PIN || '5855';
  const name = process.env.DEFAULT_DRIVER_NAME || 'Raúl Giménez';
  const phone = process.env.DEFAULT_DRIVER_PHONE || '';
  const email = process.env.DEFAULT_DRIVER_EMAIL || '';

  // La query depende del tipo de DB
  // Usamos el pool directamente para PG o el store JSON
  if (db._type === 'pg') {
    const pool = db._pool;
    const existing = await pool.query('SELECT * FROM drivers WHERE pin = $1 LIMIT 1', [pin]);
    if (existing.rows.length > 0) return { created: false, id: existing.rows[0].id };
    const r = await pool.query(
      'INSERT INTO drivers (name, pin, phone, email, active) VALUES ($1,$2,$3,$4,true) RETURNING id',
      [name, pin, phone, email]
    );
    return { created: true, id: r.rows[0].id };
  }

  // JSON fallback
  const { queries } = dbModule;
  const existing = db._store.drivers.find((d) => String(d.pin) === String(pin));
  if (existing) return { created: false, id: existing.id };
  const id = queries.addDriver(db, name, pin, phone, email);
  return { created: true, id };
}
