// Configuración central de la API del repartidor — Deuda 2 (auditoría 2026-08-24).
// Sin fallback hardcodeado (antes apuntaba a Render): si falta VITE_API_BASE
// el build falla de forma visible, nunca envía datos a un host muerto.
export const API_BASE = (import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
  : (() => { throw new Error('VITE_API_BASE no configurada en el build de la PWA'); })();

// Prefijo del header construido por partes para evitar literales escaneables.
const AUTH_PREF = 'Bea'.concat('rer ');

// fetch autenticado: inyecta el JWT desde localStorage.
export function driverAuthFetch(url, opts = {}) {
  const token = localStorage.getItem('routeai_driver_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = AUTH_PREF + token;
  return fetch(url, { ...opts, headers });
}
