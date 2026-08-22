// Simulación diaria de la empresa de reparto ficticia — KAVANA ROUTE AI
// Mantiene la demo "viva": cada día genera las rutas de hoy para los 6
// repartidores (paradas pendientes + jornada con km), cierra las jornadas
// de ayer y resuelve los pendientes de días anteriores.
//
// Uso: PGHOST=... PGPASSWORD=... node server/simulate-daily.js  (cron diario 06:00)
// Idempotente por diseño: reemplaza los pendientes de hoy y recrea la jornada
// activa de hoy. Las entregas reales (delivered/incident) nunca se tocan.

import pg from 'pg';

// ---------------------------------------------------------------------------
// Conexión (mismas variables que db.js: PGHOST o DATABASE_URL)
// ---------------------------------------------------------------------------
function createPool() {
  const sslEnabled = String(process.env.PGSSLMODE || 'require').toLowerCase() !== 'disable';
  const ssl = sslEnabled ? { rejectUnauthorized: false } : false;
  const host = process.env.PGHOST;
  if (host) {
    return new pg.Pool({
      host,
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'neondb_owner',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || 'neondb',
      ssl,
      family: 4,
    });
  }
  const url = process.env.DATABASE_URL;
  if (url) return new pg.Pool({ connectionString: url, ssl, family: 4 });
  console.error('Sin conexión: falta PGHOST o DATABASE_URL');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Semilla determinista por día (misma fecha = mismos datos)
// ---------------------------------------------------------------------------
function rnd() {
  const hoy = new Date();
  const seed = hoy.getFullYear() * 10000 + (hoy.getMonth() + 1) * 100 + hoy.getDate();
  let x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
function entre(min, max) { return Math.round(min + rnd() * (max - min)); }
function elegir(arr) { return arr[Math.floor(rnd() * arr.length)]; }

// ---------------------------------------------------------------------------
// Datos (mismos que seed-historico.js)
// ---------------------------------------------------------------------------
const DIRECCIONES = [
  'Calle de Russafa, 8 - 46004 Valencia',
  'Calle del Mar, 12 - 46003 Valencia',
  'Calle Bordadores, 10 - 46003 Valencia',
  'Calle Jorge Juan, 4 - 46004 Valencia',
  'Calle Doctor Collado, 5 - 46001 Valencia',
  'Calle Guillem de Castro, 12 - 46001 Valencia',
  'Calle Arzobispo Martínez, 7 - 46003 Valencia',
  'Calle Colón, 20 - 46004 Valencia',
  'Avenida del Oeste, 15 - 46001 Valencia',
  'Calle de la Paz, 3 - 46003 Valencia',
  'Plaza del Ayuntamiento, 1 - 46002 Valencia',
  'Calle de las Barcas, 9 - 46002 Valencia',
  'Calle Xàtiva, 18 - 46002 Valencia',
  'Calle de San Vicente Mártir, 33 - 46002 Valencia',
  'Calle Ruzafa, 25 - 46006 Valencia',
  'Calle Sueca, 14 - 46006 Valencia',
  'Calle Literato Azorín, 21 - 46006 Valencia',
  'Calle Puerto Rico, 30 - 46006 Valencia',
  'Calle Cuba, 11 - 46006 Valencia',
  'Calle de la Reina, 105 - 46011 Valencia',
  'Calle Sagunto, 40 - 46009 Valencia',
  'Calle Alicante, 22 - 46004 Valencia',
  'Calle Gran Vía Marqués del Turia, 60 - 46005 Valencia',
  'Calle Don Juan de Austria, 8 - 46002 Valencia',
  'Calle Roger de Lauria, 12 - 46002 Valencia',
  'Calle Sorní, 6 - 46004 Valencia',
  'Calle Cirilo Amorós, 54 - 46004 Valencia',
  'Calle Salvador Giner, 7 - 46004 Valencia',
  'Calle Conde Salvatierra, 15 - 46004 Valencia',
  'Calle Isabel la Católica, 9 - 46004 Valencia',
  'Calle Ciscar, 20 - 46005 Valencia',
  'Calle Grabador Esteve, 11 - 46004 Valencia',
  'Calle Ribera, 5 - 46004 Valencia',
  'Calle Pizarro, 33 - 46004 Valencia',
  'Calle San Elías, 27 - 46005 Valencia',
  'Calle Pérez Galdós, 19 - 46005 Valencia',
  'Calle Ángel Guimerá, 13 - 46008 Valencia',
  'Calle Cuenca, 24 - 46007 Valencia',
  'Calle San Vicente, 78 - 46007 Valencia',
  'Calle Padre Jofré, 4 - 46008 Valencia',
  'Calle Beato Nicolás Factor, 15 - 46008 Valencia',
  'Calle Hospital, 12 - 46001 Valencia',
  'Calle Campaneros, 3 - 46003 Valencia',
  'Calle Caballeros, 8 - 46003 Valencia',
  'Calle Ramiro de Maeztu, 6 - 46007 Valencia',
  'Calle Albacete, 31 - 46007 Valencia',
  'Calle Novelda, 9 - 46009 Valencia',
  'Calle Campanar, 42 - 46009 Valencia',
  'Calle Menéndez y Pelayo, 16 - 46007 Valencia',
  'Calle del Pie de la Cruz, 2 - 46001 Valencia',
];

const CATALOGO = [
  { name: 'Caja de aceite oliva 12x1L', qtyMax: 6 },
  { name: 'Pack de cerveza 24 uds', qtyMax: 4 },
  { name: 'Caja de vino tinto', qtyMax: 5 },
  { name: 'Palé de agua mineral', qtyMax: 2 },
  { name: 'Caja de conservas', qtyMax: 8 },
  { name: 'Bolsa de arroz 5kg', qtyMax: 10 },
  { name: 'Caja de galletas surtidas', qtyMax: 6 },
  { name: 'Paquete textil 10 uds', qtyMax: 3 },
  { name: 'Caja de detergente', qtyMax: 5 },
  { name: 'Termo de transporte', qtyMax: 2 },
  { name: 'Caja de zumos 12x1L', qtyMax: 6 },
  { name: 'Pack de refrescos 24 uds', qtyMax: 4 },
];

function generarItems() {
  const n = entre(1, 4);
  const items = [];
  for (let i = 0; i < n; i++) {
    const prod = elegir(CATALOGO);
    items.push({ name: prod.name, qty: entre(1, prod.qtyMax), checked: false });
  }
  return JSON.stringify(items);
}

function generarDireccionesRuta(n) {
  const pool = DIRECCIONES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const pool = createPool();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diaSemana = hoy.getDay();
  const esDomingo = diaSemana === 0;
  const esSabado = diaSemana === 6;
  console.log(`→ Simulación diaria RouteAI (${hoy.toISOString().slice(0, 10)}, ${esDomingo ? 'domingo' : esSabado ? 'sábado' : 'laborable'})`);

  // 1) Resolver pendientes de días anteriores: se consideran entregados o
  //    no resueltos (la empresa sigue operando). Las paradas con firma o
  //    incidencia reales NO se tocan.
  const pendientesViejos = await pool.query("DELETE FROM stops WHERE status = 'pending' AND created_at < $1", [hoy]);
  console.log(`  • Pendientes de días anteriores resueltos: ${pendientesViejos.rowCount}`);

  // 2) Cerrar jornadas activas de AYER o anteriores (auditoría 2026-08-22, G1):
  //    NUNCA cerrar una sesión de HOY — si un repartidor real tiene la jornada
  //    abierta al pasar el cron, sus km reales no se tocan con valores inventados.
  const activas = await pool.query(
    "SELECT id, driver_id, km_initial FROM driver_sessions WHERE status = 'active' AND date < $1",
    [hoy]
  );
  for (const s of activas.rows) {
    const kmFinal = parseFloat(s.km_initial) + entre(25, 45);
    const kmTotal = parseFloat((kmFinal - parseFloat(s.km_initial)).toFixed(3));
    await pool.query(
      "UPDATE driver_sessions SET km_final = $1, km_total = $2, ended_at = NOW(), status = 'closed' WHERE id = $3",
      [kmFinal, kmTotal, s.id]
    );
  }
  if (activas.rows.length > 0) console.log(`  • ${activas.rows.length} jornadas de ayer cerradas`);

  // 3) ¿Ya hay paradas de hoy? (el seed histórico deja pendientes del día 0).
  //    Si las hay, no duplicar: solo abrimos la jornada de hoy si falta.
  const paradasHoy = await pool.query('SELECT COUNT(*) AS n FROM stops WHERE created_at >= $1', [hoy]);
  const yaHayParadasHoy = parseInt(paradasHoy.rows[0].n, 10) > 0;
  if (yaHayParadasHoy) {
    console.log(`  • Ya hay ${paradasHoy.rows[0].n} paradas de hoy (seed o simulación previa). No se duplican.`);
  }

  // 4) Repartidores activos
  const drivers = await pool.query("SELECT id, name FROM drivers WHERE active = true ORDER BY id");
  if (drivers.rows.length === 0) {
    console.log('  • No hay repartidores activos. Nada que simular.');
    await pool.end();
    return;
  }

  // 5) Para cada repartidor: abrir jornada de hoy + generar ruta pendiente
  let totalStops = 0;
  for (const d of drivers.rows) {
    // Odómetro: último km_final del conductor (o arranque si no tiene historial)
    const ultimo = await pool.query(
      "SELECT km_final FROM driver_sessions WHERE driver_id = $1 AND km_final IS NOT NULL ORDER BY started_at DESC LIMIT 1",
      [d.id]
    );
    const kmInitial = ultimo.rows[0] ? parseFloat(ultimo.rows[0].km_final) : 25000;

    // Domingo: jornada de descanso, sin paradas ni sesión nueva
    if (esDomingo) {
      console.log(`  • ${d.name}: domingo, sin ruta.`);
      continue;
    }

    // Abrir jornada de hoy — idempotente (auditoría 2026-08-22, G1):
    // si ya existe una active para este driver y esta fecha, no duplicar
    // (reintentos del cron o ejecuciones concurrentes).
    const yaActiva = await pool.query(
      "SELECT id FROM driver_sessions WHERE driver_id = $1 AND date = $2 AND status = 'active' LIMIT 1",
      [d.id, hoy]
    );
    if (yaActiva.rowCount === 0) {
      const sessionRes = await pool.query(
        "INSERT INTO driver_sessions (driver_id, km_initial, km_final, km_total, date, started_at, status) VALUES ($1,$2,NULL,NULL,$3,NOW(),'active') RETURNING id",
        [d.id, kmInitial, hoy]
      );
      void sessionRes;
    }

    // Si ya hay paradas de hoy (seed día 0 o simulación previa), no generar más
    if (yaHayParadasHoy) {
      console.log(`  • ${d.name}: jornada abierta (${kmInitial} km), paradas de hoy ya existen.`);
      continue;
    }

    // Número de paradas: sábado ruta corta, laborable ruta normal
    const nParadas = esSabado ? entre(10, 16) : entre(15, 30);
    const direcciones = generarDireccionesRuta(nParadas);
    const horaInicio = entre(8, 10);
    let horaActual = new Date(hoy);
    horaActual.setHours(horaInicio, entre(0, 59), 0, 0);

    for (let p = 0; p < nParadas; p++) {
      const kmEntre = 0.3 + rnd() * 1.8;
      const distance = kmEntre.toFixed(1) + ' km';
      const estimatedTime = entre(6, 20) + ' min';
      horaActual.setMinutes(horaActual.getMinutes() + entre(8, 15));
      await pool.query(
        `INSERT INTO stops (stop_number, address, status, driver_id, items, distance, estimated_time, created_at)
         VALUES ($1,$2,'pending',$3,$4,$5,$6,$7)`,
        [p + 1, direcciones[p], d.id, generarItems(), distance, estimatedTime, horaActual]
      );
      totalStops++;
    }
    console.log(`  • ${d.name}: jornada abierta (${kmInitial} km) + ${nParadas} paradas pendientes`);
  }

  // 5) Registrar última simulación
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('simulation_last_run', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [new Date().toISOString()]
  );

  console.log('────────────────────────────────────────────');
  console.log(`  • Paradas pendientes creadas hoy: ${totalStops}`);
  console.log('────────────────────────────────────────────');
  await pool.end();
}

main().catch((err) => {
  console.error('✗ Error en simulación diaria:', err.message);
  process.exit(1);
});
