// Hash de PINs de repartidores.
// Antes los PINs se guardaban en texto plano (pin TEXT + String(pin)) y el
// SHA-256 solo protegía la comparación. Ahora se almacena scrypt(N=16384)
// con salt aleatorio por driver, formato `scrypt$<saltHex>$<hashHex>`.
// scrypt es nativo de Node: cero dependencias nuevas. N modesto a propósito:
// son PINs de 4-6 dígitos, el objetivo es encarecer dumps masivos, no
// sustituir un policy de longitud.
import crypto from 'crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEYLEN = 32;

export function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pin), salt, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPin(pin, stored) {
  const s = String(stored || '');
  if (!s.startsWith('scrypt$')) {
    // PIN legacy en texto plano (migración 004 aún no aplicada o fila nueva
    // creada por código viejo): comparación timing-safe sobre SHA-256 para
    // no romper logins durante el despliegue.
    const ha = crypto.createHash('sha256').update(s).digest();
    const hb = crypto.createHash('sha256').update(String(pin)).digest();
    return crypto.timingSafeEqual(ha, hb);
  }
  try {
    const [, saltHex, hashHex] = s.split('$');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(pin), Buffer.from(saltHex, 'hex'), expected.length, SCRYPT_PARAMS);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isHashedPin(stored) {
  return String(stored || '').startsWith('scrypt$');
}
