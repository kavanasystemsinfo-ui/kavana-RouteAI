# Plan de DR (Disaster Recovery) — KAVANA RouteAI

Auditoría adversarial 2026-08-23, gap G2: "¿qué pasa si mañana pierdes la
base de datos?" Hasta hoy la respuesta era "no tengo DR formal". Este plan lo
cierra.

## Componentes y qué se pierde

| Componente | Dónde vive | RPO objetivo | Cómo se restaura |
|---|---|---|---|
| PostgreSQL (Neon) | Neon cloud | 24 h | `pg_restore`/psql del dump diario |
| PODs PDF + fotos incidencias | Volumen Fly `routeai_data` | ~0 (volumen persistente; riesgo = fallo del volumen) | Recrear volumen + regenerar PODs bajo demanda (los PDFs se generan desde BD; las fotos de incidencias son placeholders commiteados en el repo para la demo) |
| Código | GitHub | 0 | clone |
| Secrets | Fly secrets | 0 (reconfigurables) | flyctl secrets set |

## Backup diario (implementado)

- Script: `/root/scripts/routeai-backup.sh` (VPS, fuera del repo) — pg_dump
  comprimido a `/root/backups/routeai/routeai_db_YYYYMMDD_HHMMSS.sql.gz`.
  Credenciales en `/root/.routeai-backup.env` (chmod 600, fuera de repos).
- Cron: diario 02:30 UTC (`30 2 * * *`), antes del cleanup 03:00.
- Retención: 14 días.
- Verificación integrada: dump < 10 KB se considera fallo (exit 1) y NO borra
  los anteriores; el fallo del 22-08 (dump de 20 bytes por credencial
  corrupta) habría sido detectado con esto.

## Restore probado (2026-08-24, dump routeai_db_20260824_023001.sql.gz)

1. Integridad: `gunzip -t` OK.
2. Restauración completa en BD temporal Neon (schema public limpio):
   0 errores.
3. Conteos tras restore vs producción:
   - drivers 6 = 6 · stops 12.303 vs 12.435 (diferencia esperada: el cron
     simulate-daily del día siguiente creó paradas nuevas tras el dump)
   - incidents 1.267 = 1.267 · pods 9 · sessions 656
4. BD temporal eliminada.

**Pitfall Neon**: `DROP DATABASE` puede fallar con "session using the
database" aunque no haya sesiones reales; terminar backends con
pg_terminate_backend antes del DROP. Y en el psql de verificación usar
nombres cualificados (`public.drivers`) o fijar search_path.

## Limitaciones aceptadas

- Un solo destino (VPS local). Mejora futura: copia offsite (S3/B2).
- RPO 24 h: la última jornada podría perderse parcialmente. Aceptable para un
  sistema portfolio-demo; para clientes reales: WAL archiving o Neon branching.
- El restore NO re-ejecuta migraciones pendientes: restaurar sobre una BD con
  el mismo schema version (las migraciones van incluidas en el dump).
