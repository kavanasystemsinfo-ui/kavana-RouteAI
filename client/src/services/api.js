// Configuración central de la API del repartidor — Deuda 2 (auditoría 2026-08-24).
// Sin fallback hardcodeado a hosts legacy: si falta VITE_API_BASE, el build
// falla de forma visible, nunca envía datos a un host muerto. Excepción: en
// entorno de TEST se usa un placeholder porque los tests mockean fetch y no
// hacen red real.
export const API_BASE = (import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : import.meta.env.MODE === 'test'
    ? '/api'
    : (() => { throw new Error('VITE_API_BASE no configurada en el build de la PWA'); })();

// fetch autenticado: usa cookie httpOnly (credenciales incluidas automáticamente).
// El token ya no se guarda en localStorage; el navegador envía la cookie httpOnly.
export function driverAuthFetch(url, opts = {}) {
  return fetch(url, {
    ...opts,
    credentials: 'include', // envía cookie httpOnly automáticamente
    headers: {
      ...(opts.headers || {}),
    },
  });
}
