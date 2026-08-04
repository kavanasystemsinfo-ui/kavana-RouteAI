// Autenticación JWT (HS256) con crypto nativo de Node — sin dependencias externas.
// Robustez desde día 1: los datos y las escrituras quedan protegidos por firma.
import crypto from 'crypto';

const getSecret = () => process.env.JWT_SECRET || 'routefleet-dev-secret-change-me';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function base64urlJson(obj) {
  return base64url(JSON.stringify(obj));
}

// Crea un JWT firmado (header.payload.firma) con exp en segundos.
export function signToken(payload, secret = getSecret(), ttlSeconds = 8 * 60 * 60) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: payload.exp || now + ttlSeconds };
  const data = `${base64urlJson(header)}.${base64urlJson(body)}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// Verifica firma y expiración. Lanza Error si es inválido/expirado.
export function verifyToken(token, secret = getSecret()) {
  if (!token || typeof token !== 'string') throw new Error('Token ausente');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token inválido');
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  // Comparación en tiempo constante para evitar timing attacks.
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Firma inválida');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  } catch (e) {
    throw new Error('Payload inválido');
  }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token expirado');
  }
  return payload;
}

// Extrae el token del header Authorization: Bearer *** del query ?token= (para descargas).
export function extractToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization;
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m) return m[1];
  }
  if (req.query && req.query.token) return String(req.query.token);
  return null;
}

// Middleware: exige JWT válido con uno de los roles indicados.
// roles: 'office' | 'driver' (vacío = cualquiera autenticado).
export function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      const payload = verifyToken(token);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Sin permiso' });
      }
      req.user = payload;
      next();
    } catch (e) {
      const status = /expir/i.test(e.message) ? 401 : 401;
      res.status(status).json({ error: e.message });
    }
  };
}
