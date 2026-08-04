// Seed mínimo: asegura que el repartidor por defecto exista siempre.
// Causa raíz del bug "repartidor desaparecido": en Render free el JSON store
// es efímero y se borra en cada reinicio. Este seed lo revive al arrancar.
// No pide datos al usuario; usa valores por defecto (configurables vía env).

import dbModule from './db.js';

export function seedDrivers(db) {
  const { queries } = dbModule;
  const existing = queries.listDrivers(db);
  const pin = process.env.DEFAULT_DRIVER_PIN || '5855';
  const name = process.env.DEFAULT_DRIVER_NAME || 'Repartidor KAVANA';
  const phone = process.env.DEFAULT_DRIVER_PHONE || '';
  const email = process.env.DEFAULT_DRIVER_EMAIL || '';
  const already = existing.find((d) => String(d.pin) === String(pin));
  if (already) return { created: false, id: already.id };
  const id = queries.addDriver(db, name, pin, phone, email);
  return { created: true, id };
}
