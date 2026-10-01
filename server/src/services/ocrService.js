// OCR de albaranes industriales (Kavana Lens) – V2: extrae direcciones + bultos.
// Extrae texto de imágenes, PDFs y CSV sin dependencias pesadas.
// Tesseract.js es OPCIONAL (solo si está instalado en node_modules).
// Fallback: lectura directa + addressCleaner inteligente.

import { cleanAddress } from './addressCleaner.js';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordOcr } from '../metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { PODS_DIR } from '../storage.js';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// OCR en imágenes (Tesseract online)
async function runTesseract(imagePath) {
  try {
    const tesseractModule = await import('tesseract.js').catch(() => null);
    if (!tesseractModule) return null;
    
    const Tesseract = tesseractModule.default;
    const { data } = await Tesseract.recognize(imagePath, 'spa', {
      logger: () => {}
    });
    return data.text;
  } catch (e) {
    console.warn('Tesseract no disponible:', e.message);
    return null;
  }
}

// Detectar si un archivo es binario (imagen/PDF) vs texto
function isBinaryFile(path) {
  try {
    const buf = fs.readFileSync(path);
    const signatures = {
      jpg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47],
      gif: [0x47, 0x49, 0x46],
      pdf: [0x25, 0x50, 0x44, 0x46],
      webp: [0x52, 0x49, 0x46, 0x46],
    };
    for (const [, sig] of Object.entries(signatures)) {
      if (sig.every((b, i) => buf[i] === b)) return true;
    }
    return false;
  } catch { return true; }
}

// Extraer texto de PDF usando pdftotext (poppler-utils)
async function extractPdfText(pdfPath) {
  try {
    const { execFileSync } = await import('child_process');
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { 
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
    return text;
  } catch (e) {
    console.warn('Error extrayendo texto de PDF con pdftotext:', e.message);
    try {
      const buffer = fs.readFileSync(pdfPath, 'utf8');
      const addressPatterns = [
        /Calle\s+\w+[\s\w,]*\d+/gi,
        /Avenida\s+\w+[\s\w,]*\d+/gi,
        /Plaza\s+\w+[\s\w,]*\d+/gi,
      ];
      let found = '';
      for (const pattern of addressPatterns) {
        const match = buffer.match(pattern);
        if (match) found += match.join('\n') + '\n';
      }
      return found || '';
    } catch {
      return '';
    }
  }
}

// Procesar CSV
function extractCsvText(filePath) {
  try {
    const csv = fs.readFileSync(filePath, 'utf8');
    return csv;
  } catch (e) {
    console.warn('Error leyendo CSV:', e.message);
    return '';
  }
}

// ── V2: Extraer bultos/items del texto OCR ────────────────────────────

// Patrones comunes en albaranes españoles para detectar líneas de producto
const ITEM_LINE_PATTERNS = [
  // "3 x Cajas de vino" o "3x Cajas de vino"
  /(\d+)\s*x\s+(.+)/i,
  // "Cajas de vino ..... 3" (cantidad al final)
  /(.+?)\s*[.]{2,}\s*(\d+)/i,
  // Tabla de albarán: "Nº CODIGO PRODUCTO ... CANT" → extraer código + nombre + cantidad
  // Ej: "1  VIN-001  Vino tinto crianza Rioja 75cl    6    8,50 EUR    51,00 EUR"
  /^\d+\s+([A-Z]{2,5}-\d{2,5})\s+(.+?)\s{2,}(\d{1,4})\s?/i,
  // Variante sin código: "1  Vino tinto crianza Rioja 75cl    6  ..."
  /^\d+\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][\w\sáéíóúñÁÉÍÓÚÑ()%+\-.\/]{3,}?)\s{2,}(\d{1,4})\s?/i,
  // "Packs de yogures ...... 20" o "Packs de yogures 20"
  /^(.+?)\s*[.]{2,}\s*(\d{1,4})/i,
  // Tabla con pipes: "| 3 | Cajas de vino | 6€ | 18€ |"
  /^\|\s*\d+\s*\|\s*([^|]+)\s*\|/i,
  // "3 Cajas de vino" (cantidad al inicio, luego nombre - flexible)
  /^(\d{1,4})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-záéíóúñ0-9\s()%+\-.\/]{2,})$/m,
  // "Cajas de vino   3" (nombre + espacios + cantidad)
  /^(.+?)\s{2,}(\d{1,4})$/m,
  // Formato simple: "Producto cantidad" (ej: "Cajas de pan 3", "Botellas de agua 24")
  /^([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-záéíóúñ0-9\s()%+\-.\/]{2,}?)\s+(\d{1,4})\s*$/m,
  // Formato con "de": "Cajas de vino 6", "Botellas de agua 24"
  /^([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-záéíóúñ0-9\s()%+\-.\/]{2,}?)\s+de\s+(\w+)\s+(\d{1,4})/i,
];

// Palabras que indican fin de la sección de items
const STOP_KEYWORDS = [
  'total', 'subtotal', 'iva', 'importe', 'firma', 'recibí', 'entregado',
  'observaciones', 'notas', 'cliente', 'dirección', 'fecha', 'albarán',
  'nº', 'teléfono', 'contacto', 'productos', 'artículos', 'items'
];

function isStopLine(line) {
  const lower = line.toLowerCase().trim();
  return STOP_KEYWORDS.some(kw => lower.startsWith(kw));
}

export function extractItemsFromText(rawText) {
  if (!rawText) return [];
  
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];
  
  for (const line of lines) {
    if (isStopLine(line)) continue;
    
    for (const pattern of ITEM_LINE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        let qty, name;
        const src = pattern.source;
        if (src.includes('x')) {
          // "3 x Cajas" o "3x Cajas" → qty=3, name="Cajas"
          qty = parseInt(match[1], 10);
          name = match[2].trim();
        } else if (src.startsWith('^(\\d{1,4})') && src.includes('[A-Za-zÁÉÍÓÚÑáéíóúñ]')) {
          // "3 Cajas de vino" → qty=3, name="Cajas de vino"
          qty = parseInt(match[1], 10);
          name = match[2].trim();
        } else if (src.includes('{2,5}-\\d{2,5}')) {
          // Tabla con código: "1 VIN-001 Producto   6 ..." → name=match[2], qty=match[3]
          name = match[2].trim();
          qty = parseInt(match[3], 10);
        } else if (src.includes('|')) {
          // Tabla con pipes: "| 3 | Cajas de vino | 6€ | 18€ |" → name=match[1], qty from first group
          name = match[1].trim();
          // Extraer cantidad del inicio de la línea (antes del primer pipe)
          const qtyMatch = line.match(/^\|\s*(\d+)\s*\|/);
          qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        } else if (src.includes('[\w\sáéíóúñÁÉÍÓÚÑ()%+\-.]{3,}?')) {
          // Tabla sin código: "1 Producto   6 ..." → name=match[1], qty=match[2]
          name = match[1].trim();
          qty = parseInt(match[2], 10);
        } else if (src.startsWith('^(.+?)') && src.includes('\\s{2,}\\d{1,4}')) {
          // "Cajas de vino   3" o "Packs de yogures ...... 20" → name=match[1], qty=match[2]
          name = match[1].trim();
          qty = parseInt(match[2], 10);
        } else if (src.startsWith('^([A-Za-zÁÉÍÓÚÑáéíóúñ]')) {
          // "Producto cantidad" → name=match[1], qty=match[2]
          name = match[1].trim();
          qty = parseInt(match[2], 10);
        } else if (src.includes('de')) {
          // "Cajas de vino 6" → name=match[1], qty=match[3]
          name = match[1].trim();
          qty = parseInt(match[3], 10);
        } else {
          // Fallback
          name = match[1].trim();
          qty = parseInt(match[2], 10);
        }
        
        if (qty > 0 && qty < 10000 && name.length > 1) {
          // Limpiar nombre: quitar puntos, guiones sueltos y espacios extra
          name = name.replace(/^[-.\s]+|[-.\s]+$/g, '').replace(/\s{2,}/g, ' ').trim();
          // Solo añadir si no es una dirección ni línea de total
          if (!name.match(/\d{5}/) && !name.match(/^(calle|avenida|plaza|paseo|c\/)/i)) {
            items.push({ name, qty, checked: false });
          }
        }
        break;
      }
    }
  }
  
  return items;
}

// ── End V2 items extraction ──────────────────────────────────────────

export async function processManifestImage(imagePath, isPdf = false, isCsv = false, rawTextOverride = null) {
  let raw = '';
  
  // Si se pasa texto directo (para tests), úsalo
  if (rawTextOverride !== null) {
    raw = rawTextOverride;
  } else if (isCsv) {
    raw = extractCsvText(imagePath);
  } else if (isPdf) {
    raw = await extractPdfText(imagePath);
  } else {
    const ocrResult = await runTesseract(imagePath);
    if (ocrResult && ocrResult.trim()) {
      raw = ocrResult;
    } else if (!isBinaryFile(imagePath)) {
      try {
        raw = fs.readFileSync(imagePath, 'utf8').replace(/[^\x20-\x7E\nÁÉÍÓÚÑáéíóúñ]/g, ' ').replace(/\s+/g, ' ').trim();
      } catch (e) {
        raw = '';
      }
    } else {
      raw = '';
    }
  }
  
  const address = cleanAddress(raw);
  const items = extractItemsFromText(raw);
  
  // Record OCR metrics
  const hasText = raw && raw.trim().length > 0;
  recordOcr(items.length, true, hasText);
  
  return { address, raw, items };
}

// Generación de POD (Proof of Delivery) en PDF con firma y geolocalización.
// Usa pdfkit. Devuelve la ruta del archivo generado.

import { recordPod } from '../metrics.js';

// stop: { id, address, receiver_name, status }
// signature: dataURL ("data:image/png;base64,....")
// geo: { lat, lng } opcional
export async function generatePOD(stop, signature, geo = null) {
  ensureDir(PODS_DIR);
  const fileName = `pod_${stop.id}_${Date.now()}.pdf`;
  const filePath = path.join(PODS_DIR, fileName);
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text('KAVANA Route AI', { align: 'center' });
  doc.fontSize(12).text('Proof of Delivery (POD)', { align: 'center' });
  doc.moveDown();
  doc.text(`Parada #${stop.id}`);
  doc.text(`Direccion: ${stop.address || 'N/A'}`);
  doc.text(`Receptor: ${stop.receiver_name || 'No especificado'}`);
  // Fecha real de la entrega: usa created_at de la parada (historico),
  // con fallback a ahora si la parada no tiene fecha.
  const fechaEntrega = stop.created_at ? new Date(stop.created_at) : new Date();
  doc.text(`Fecha: ${fechaEntrega.toLocaleString('es-ES')}`);

  // Items entregados (bultos)
  let items = [];
  try { items = JSON.parse(stop.items || '[]'); } catch {}
  const delivered = items.filter(i => i.checked);
  if (delivered.length > 0) {
    doc.moveDown(0.5);
    doc.text('Bultos entregados:');
    for (const item of delivered) {
      doc.text(`  ${item.qty}x ${item.name}`);
    }
  }

  if (geo && geo.lat && geo.lng) {
    doc.text(`Geolocalización: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
  }
  doc.moveDown();

  if (signature && signature.startsWith('data:image')) {
    const base64 = signature.split(',')[1];
    const imgBuffer = Buffer.from(base64, 'base64');
    doc.text('Firma del receptor:');
    doc.image(imgBuffer, { fit: [250, 120] });
  } else {
    doc.text('Firma: (no disponible)');
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  
  // Record POD generation metric
  recordPod(true);
  
  return filePath;
}

export default { generatePOD, extractItemsFromText, processManifestImage };