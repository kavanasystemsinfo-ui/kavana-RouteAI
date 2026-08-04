// Seed de HISTÓRICO — Empresa de reparto ficticia "KAVANA Distribuciones, S.L."
// Genera 90 días de datos realistas para que la Torre de Control parezca una
// empresa viva: rutas diarias por repartidor (15-30 paradas), bultos, entregas
// firmadas, incidencias y jornadas con kilometraje.
//
// Uso: DATABASE_URL=... node server/seed-historico.js
// Idempotente: si ya hay más de 500 paradas históricas, NO duplica.
// Sin fotos de incidencias (Nivel 1): photo_data queda vacío, solo notas.

import zlib from 'zlib';
import { initDb } from './src/db.js';

// ---------------------------------------------------------------------------
// Semilla determinista: misma BD = mismos datos (reproducible)
// ---------------------------------------------------------------------------
let seedRnd = 42;
function rnd() {
  seedRnd = (seedRnd * 1103515245 + 12345) % 2147483648;
  return seedRnd / 2147483648;
}
function entre(min, max) { return Math.round(min + rnd() * (max - min)); }
function elegir(arr) { return arr[Math.floor(rnd() * arr.length)]; }

// ---------------------------------------------------------------------------
// Datos base
// ---------------------------------------------------------------------------
const REPARTIDORES = [
  { name: 'Raúl Giménez',      pin: '5855', fuel_type: 'diesel', baseKm: 42000 },
  { name: 'Marco Andrés',      pin: '5856', fuel_type: 'diesel',  baseKm: 31500 },
  { name: 'Lucía Ferrando',    pin: '5857', fuel_type: 'electrico', baseKm: 9800 },
  { name: 'Javier Molina',     pin: '5858', fuel_type: 'gasolina', baseKm: 52700 },
  { name: 'Elena Roselló',     pin: '5859', fuel_type: 'hibrido', baseKm: 26400 },
  { name: 'Sergio Vidal',      pin: '5860', fuel_type: 'diesel',  baseKm: 67100 },
];

// Calles reales de Valencia (las mismas zonas que usa el geocoding del repo)
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

const RECEPTORES = [
  'Carlos García', 'María Pérez', 'Juan Martínez', 'Ana López', 'Luis Sánchez',
  'Carmen Gómez', 'David Ruiz', 'Isabel Fernández', 'Miguel Torres', 'Laura Ramírez',
  'Pablo Navarro', 'Sandra Molina', 'Ángel Romero', 'Paula Delgado', 'Raúl Ferrer',
  'Nuria Costa', 'Óscar Ibáñez', 'Beatriz Moya', 'Iván Pastor', 'Cristina Blasco',
  'Jorge Adán', 'Marta Ortega', 'Rubén Gil', 'Silvia Campos', 'Adrián Vega',
  'Rocío Pascual', 'Héctor Salas', 'Patricia León', 'Daniel Fuentes', 'Eva Navarro',
];

// Catálogo de bultos típico de una distribuidora
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

const TIPOS_INCIDENCIA = [
  'Cliente ausente',
  'Dirección incorrecta',
  'Bulto dañado',
  'Rechazado por cliente',
  'No se pudo acceder',
  'Horario cerrado',
];

const NOTAS_INCIDENCIA = [
  'Cliente no localizado tras 3 llamadas. Se intentará mañana.',
  'El número no existe. Se llamó al teléfono de contacto sin éxito.',
  'Bulto con golpe visible en el lateral. Se notificó al cliente.',
  'El cliente pidió devolución del pedido completo.',
  'Portal cerrado y sin portero. Se dejó aviso.',
  'Local cerrado a la hora de entrega programada.',
];

// Foto placeholder por tipo de incidencia (archivos en server/incidents/)
const FOTO_POR_TIPO = {
  'Cliente ausente': '/incidents/cliente_ausente.jpg',
  'Dirección incorrecta': '/incidents/direccion_incorrecta.jpg',
  'Bulto dañado': '/incidents/bulto_danado.jpg',
  'Rechazado por cliente': '/incidents/rechazado.jpg',
  'No se pudo acceder': '/incidents/sin_acceso.jpg',
  'Horario cerrado': '/incidents/horario_cerrado.jpg',
};

// ---------------------------------------------------------------------------
// Mini generador de firma PNG (sin dependencias, zlib nativo)
// Dibuja 2-3 trazos sinusoidales tipo garabato sobre fondo transparente.
// ---------------------------------------------------------------------------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makeSignaturePng(seed) {
  const W = 200, H = 80;
  const px = Buffer.alloc(W * H * 4); // RGBA transparente
  let s = seed;
  function srnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }

  const trazos = 2 + Math.floor(srnd() * 2);
  for (let t = 0; t < trazos; t++) {
    const x0 = 15 + srnd() * 40;
    const y0 = 20 + srnd() * 30;
    const len = 90 + srnd() * 60;
    const amp = 6 + srnd() * 10;
    const freq = 0.05 + srnd() * 0.08;
    const grosor = 2 + srnd() * 1.5;
    for (let i = 0; i < len; i++) {
      const x = x0 + i;
      const y = y0 + Math.sin(i * freq + t * 2) * amp + (srnd() - 0.5) * 2;
      const r = Math.ceil(grosor);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= grosor * grosor) {
            const xi = Math.round(x + dx), yi = Math.round(y + dy);
            if (xi >= 0 && xi < W && yi >= 0 && yi < H) {
              const idx = (yi * W + xi) * 4;
              px[idx] = 25; px[idx + 1] = 50; px[idx + 2] = 120; px[idx + 3] = 255;
            }
          }
        }
      }
    }
  }

  // Escanear líneas con filtro 0 (none) y comprimir
  const stride = W * 4;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,' + png.toString('base64');
}

// ---------------------------------------------------------------------------
// Generadores de contenido
// ---------------------------------------------------------------------------
function generarItems(entregado) {
  const n = entre(1, 4);
  const items = [];
  for (let i = 0; i < n; i++) {
    const prod = elegir(CATALOGO);
    items.push({
      name: prod.name,
      qty: entre(1, prod.qtyMax),
      checked: entregado ? true : rnd() < 0.5,
    });
  }
  return JSON.stringify(items);
}

function generarDireccionesRuta(n) {
  const pool = DIRECCIONES.slice();
  // Barajar
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
  console.log('→ Seed HISTÓRICO RouteAI (90 días) — empresa ficticia en producción...');

  const db = await initDb();
  const pool = db._pool;

  // Idempotencia: si ya hay histórico real (miles de paradas), no duplicar
  const countRes = await pool.query(
    "SELECT COUNT(*) AS n FROM stops WHERE created_at < NOW() - INTERVAL '1 day'"
  );
  const yaTieneHistorico = parseInt(countRes.rows[0].n, 10);
  if (yaTieneHistorico > 500) {
    console.log(`  • Ya existe histórico (${yaTieneHistorico} paradas). No se duplica.`);
    await pool.end();
    return;
  }
  console.log(`  • Paradas históricas actuales: ${yaTieneHistorico}. Generando...`);

  // Settings de costes (por tipo de combustible)
  const settings = {
    cost_per_km: 0.3,
    cost_per_hour: 15,
    cost_per_km_diesel: 0.30,
    cost_per_km_gasolina: 0.35,
    cost_per_km_electrico: 0.15,
    cost_per_km_hibrido: 0.28,
  };
  for (const [key, value] of Object.entries(settings)) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)]
    );
  }

  // Repartidores (crear solo los que no existan por PIN)
  const driverRows = await pool.query('SELECT id, pin FROM drivers');
  const pinsExistentes = new Set(driverRows.rows.map((r) => String(r.pin)));
  const driverIds = [];
  for (const rep of REPARTIDORES) {
    if (pinsExistentes.has(rep.pin)) {
      const existing = driverRows.rows.find((r) => String(r.pin) === rep.pin);
      await pool.query('UPDATE drivers SET fuel_type=$1, is_demo=true WHERE id=$2', [rep.fuel_type, existing.id]);
      driverIds.push(existing.id);
    } else {
      const r = await pool.query(
        'INSERT INTO drivers (name, pin, phone, email, active, fuel_type, is_demo) VALUES ($1,$2,$3,$4,true,$5,true) RETURNING id',
        [rep.name, rep.pin, '', '', rep.fuel_type]
      );
      driverIds.push(r.rows[0].id);
    }
  }
  console.log(`  • ${driverIds.length} repartidores listos (marcados is_demo, solo lectura).`);

  // Odómetros por repartidor (km acumulados día a día)
  const odometros = REPARTIDORES.map((r) => r.baseKm);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let totalStops = 0;
  let totalDelivered = 0;
  let totalIncidents = 0;
  let totalPending = 0;
  let totalSessions = 0;

  // 90 días hacia atrás (día 0 = hoy, día 89 = hace 3 meses)
  for (let dia = 89; dia >= 0; dia--) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - dia);
    const esReciente = dia <= 2; // últimos 3 días: deja pendientes para la demo

    for (let d = 0; d < driverIds.length; d++) {
      const driverId = driverIds[d];
      const nParadas = entre(15, 30);
      const direcciones = generarDireccionesRuta(nParadas);
      const horaInicio = entre(8, 10); // 8:00-10:00
      let horaActual = new Date(fecha);
      horaActual.setHours(horaInicio, entre(0, 59), 0, 0);
      let kmRuta = 0;

      // Jornada del repartidor ese día
      const kmInitial = odometros[d];
      const kmFinal = kmInitial + entre(25, 45);
      odometros[d] = kmFinal;
      const kmTotal = parseFloat((kmFinal - kmInitial).toFixed(3));

      const startedAt = new Date(fecha);
      startedAt.setHours(horaInicio, 0, 0, 0);
      const endedAt = new Date(fecha);
      endedAt.setHours(15, entre(0, 30), 0, 0);

      const sessionRes = await pool.query(
        `INSERT INTO driver_sessions
           (driver_id, km_initial, km_final, km_total, date, started_at, ended_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'closed') RETURNING id`,
        [driverId, kmInitial, kmFinal, kmTotal, fecha, startedAt, endedAt]
      );
      totalSessions++;
      void sessionRes;

      for (let p = 0; p < nParadas; p++) {
        const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
        // Distribución: ~85% entregado, ~10% incidencia, ~5% pendiente (solo días recientes)
        let status;
        const roll = rnd();
        if (esReciente && roll > 0.75) status = 'pending';
        else if (roll > 0.88) status = 'incident';
        else status = 'delivered';

        const address = direcciones[p];
        const items = generarItems(status === 'delivered');
        const stopNumber = p + 1;
        const kmEntre = 0.3 + rnd() * 1.8;
        kmRuta += kmEntre;
        const distance = kmEntre.toFixed(1) + ' km';
        const estimatedTime = entre(6, 20) + ' min';

        // Avanzar reloj de la ruta
        horaActual.setMinutes(horaActual.getMinutes() + entre(8, 15));

        const stopRes = await pool.query(
          `INSERT INTO stops
             (stop_number, address, status, driver_id, items, distance, estimated_time, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [stopNumber, address, status, driverId, items, distance, estimatedTime, horaActual]
        );
        const stopId = stopRes.rows[0].id;
        totalStops++;

        if (status === 'delivered') {
          const signature = makeSignaturePng(stopId + seedRnd);
          const receiver = elegir(RECEPTORES);
          await pool.query(
            'UPDATE stops SET signature=$1, receiver_name=$2 WHERE id=$3',
            [signature, receiver, stopId]
          );
          totalDelivered++;
        } else if (status === 'incident') {
          const tipo = elegir(TIPOS_INCIDENCIA);
          await pool.query(
            'INSERT INTO incidents (stop_id, type, photo_data, notes, created_at) VALUES ($1,$2,$3,$4,$5)',
            [stopId, tipo, FOTO_POR_TIPO[tipo] || '', elegir(NOTAS_INCIDENCIA), horaActual]
          );
          totalIncidents++;
        } else {
          totalPending++;
        }
      }
    }

    if (dia % 15 === 0) console.log(`  • Día ${90 - dia}/90 completado...`);
  }

  console.log('────────────────────────────────────────────');
  console.log('  Resumen del histórico generado:');
  console.log(`  • Repartidores: ${driverIds.length}`);
  console.log(`  • Paradas totales: ${totalStops}`);
  console.log(`  • Entregadas: ${totalDelivered} (${Math.round((totalDelivered / totalStops) * 100)}%)`);
  console.log(`  • Incidencias: ${totalIncidents} (${Math.round((totalIncidents / totalStops) * 100)}%)`);
  console.log(`  • Pendientes: ${totalPending} (${Math.round((totalPending / totalStops) * 100)}%)`);
  console.log(`  • Jornadas con km: ${totalSessions}`);
  console.log('────────────────────────────────────────────');

  await pool.end();
}

main().catch((err) => {
  console.error('✗ Error en seed histórico:', err.message);
  process.exit(1);
});
