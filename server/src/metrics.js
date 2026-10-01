// Prometheus metrics para Route AI
// Expone /metrics endpoint para scraping por Prometheus/Grafana

import promClient from 'prom-client';

// Crear registry
const register = new promClient.Registry();

// Añadir métricas por defecto (CPU, memoria, etc.)
promClient.collectDefaultMetrics({ register, prefix: 'routeai_' });

// ── Métricas custom ────────────────────────────────────────────────

// HTTP requests
export const httpRequestsTotal = new promClient.Counter({
  name: 'routeai_http_requests_total',
  help: 'Total HTTP requests by method, path, status',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'routeai_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// Auth
export const authAttemptsTotal = new promClient.Counter({
  name: 'routeai_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'result'], // type: pin|office, result: success|failure
  registers: [register]
});

// Rate limiting
export const rateLimitHitsTotal = new promClient.Counter({
  name: 'routeai_rate_limit_hits_total',
  help: 'Total rate limit hits',
  labelNames: ['endpoint', 'result'], // result: allowed|blocked
  registers: [register]
});

// Optimización de rutas
export const routeOptimizationsTotal = new promClient.Counter({
  name: 'routeai_route_optimizations_total',
  help: 'Total route optimizations performed',
  labelNames: ['result'], // result: success|error
  registers: [register]
});

export const routeOptimizationDuration = new promClient.Histogram({
  name: 'routeai_route_optimization_duration_seconds',
  help: 'Route optimization duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const routeOptimizationStops = new promClient.Histogram({
  name: 'routeai_route_optimization_stops',
  help: 'Number of stops in route optimization',
  buckets: [1, 2, 5, 10, 15, 20, 30, 50],
  registers: [register]
});

// OCR
export const ocrProcessedTotal = new promClient.Counter({
  name: 'routeai_ocr_processed_total',
  help: 'Total OCR processing requests',
  labelNames: ['result'], // result: success|error|no_text
  registers: [register]
});

export const ocrItemsExtracted = new promClient.Histogram({
  name: 'routeai_ocr_items_extracted',
  help: 'Number of items extracted per OCR',
  buckets: [0, 1, 2, 3, 5, 10, 20, 50],
  registers: [register]
});

// POD generation
export const podGeneratedTotal = new promClient.Counter({
  name: 'routeai_pod_generated_total',
  help: 'Total POD documents generated',
  labelNames: ['result'], // result: success|error
  registers: [register]
});

// Active users (drivers/offices)
export const activeDrivers = new promClient.Gauge({
  name: 'routeai_active_drivers',
  help: 'Currently active drivers (logged in last 5 min)',
  registers: [register]
});

export const activeOffices = new promClient.Gauge({
  name: 'routeai_active_offices',
  help: 'Currently active offices (logged in last 5 min)',
  registers: [register]
});

// DB operations
export const dbOperationsTotal = new promClient.Counter({
  name: 'routeai_db_operations_total',
  help: 'Total database operations',
  labelNames: ['operation', 'result'], // operation: read|write|delete, result: success|error
  registers: [register]
});

export const dbOperationDuration = new promClient.Histogram({
  name: 'routeai_db_operation_duration_seconds',
  help: 'Database operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register]
});

// WebSocket connections
export const wsConnectionsActive = new promClient.Gauge({
  name: 'routeai_ws_connections_active',
  help: 'Active WebSocket connections',
  registers: [register]
});

// Export register for /metrics endpoint
export { register };

// Helper para middleware Express
export function metricsMiddleware() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    const path = req.route?.path || req.path || 'unknown';
    
    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      httpRequestsTotal.inc({ method: req.method, path, status: res.statusCode });
      httpRequestDuration.observe({ method: req.method, path }, duration);
    });
    next();
  };
}

// Helper para grabar latencia de optimización
export function recordOptimization(stops, durationMs, success = true) {
  routeOptimizationsTotal.inc({ result: success ? 'success' : 'error' });
  if (success) {
    routeOptimizationDuration.observe(durationMs / 1000);
    routeOptimizationStops.observe(stops);
  }
}

// Helper para grabar OCR
export function recordOcr(itemsCount, success = true, hasText = true) {
  if (!hasText) {
    ocrProcessedTotal.inc({ result: 'no_text' });
    return;
  }
  ocrProcessedTotal.inc({ result: success ? 'success' : 'error' });
  if (success && itemsCount > 0) {
    ocrItemsExtracted.observe(itemsCount);
  }
}

// Helper para grabar auth
export function recordAuth(type, success) {
  authAttemptsTotal.inc({ type, result: success ? 'success' : 'failure' });
}

// Helper para grabar rate limit
export function recordRateLimit(endpoint, allowed) {
  rateLimitHitsTotal.inc({ endpoint, result: allowed ? 'allowed' : 'blocked' });
}

// Helper para grabar DB
export function recordDb(operation, durationMs, success = true) {
  dbOperationsTotal.inc({ operation, result: success ? 'success' : 'error' });
  if (success) {
    dbOperationDuration.observe({ operation }, durationMs / 1000);
  }
}

// Helper para POD
export function recordPod(success = true) {
  podGeneratedTotal.inc({ result: success ? 'success' : 'error' });
}

export default { register, metricsMiddleware };