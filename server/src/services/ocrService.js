// OCR de albaranes industriales (Kavana Lens) – V2: extrae direcciones + bultos.
// Extrae texto de imágenes, PDFs y CSV sin dependencias pesadas.
// Tesseract.js es OPCIONAL (solo si está instalado en node_modules).
// Fallback: lectura directa + addressCleaner inteligente.

import { cleanAddress } from './addressCleaner.js';
import fs from 'fs';

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
  // "3 Cajas de vino" (cantidad al inicio, luego nombre sin números)
  /^(\d{1,4})\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ\s]{2,})$/m,
  // "Cajas de vino   3" (nombre + espacios + cantidad)
  /^(.+?)\s{2,}(\d{1,4})$/m,
  // Tabla de albarán: "Nº CODIGO PRODUCTO ... CANT" → extraer código + nombre + cantidad
  // Ej: "1  VIN-001  Vino tinto crianza Rioja 75cl    6    8,50 EUR    51,00 EUR"
  /^\d+\s+([A-Z]{2,5}-\d{2,5})\s+(.+?)\s{2,}(\d{1,4})\s/i,
  // Variante sin código: "1  Vino tinto crianza Rioja 75cl    6  ..."
  /^\d+\s+([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ][\w\sáéíóúñÁÉÍÓÚÑ()%+\-.]{3,}?)\s{2,}(\d{1,4})\s/i,
];

// Palabras que indican fin de la sección de items
const STOP_KEYWORDS = [
  'total', 'subtotal', 'iva', 'importe', 'firma', 'recibí', 'entregado',
  'observaciones', 'notas', 'cliente', 'dirección', 'fecha', 'albarán',
  'nº', 'teléfono', 'contacto'
];

function isStopLine(line) {
  const lower = line.toLowerCase().trim();
  return STOP_KEYWORDS.some(kw => lower.startsWith(kw));
}

function extractItemsFromText(rawText) {
  if (!rawText) return [];
  
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];
  
  for (const line of lines) {
    if (isStopLine(line)) continue;
    
    for (const pattern of ITEM_LINE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        let qty, name;
        if (pattern.source.includes('x')) {
          // "3 x Cajas" o "3x Cajas" → qty=3, name="Cajas"
          qty = parseInt(match[1], 10);
          name = match[2].trim();
        } else if (pattern.source.includes('[.]{2,}')) {
          // "Cajas ..... 3" → name="Cajas", qty=3
          name = match[1].trim();
          qty = parseInt(match[2], 10);
        } else if (pattern.source.startsWith('^(\\\\d{1,4})')) {
          // "3 Cajas de vino" → qty=3, name="Cajas de vino"
          qty = parseInt(match[1], 10);
          name = match[2].trim();
        } else if (pattern.source.includes('{2,5}-\\\\d{2,5}')) {
          // Tabla con código: "1 VIN-001 Producto   6 ..." → name=match[2], qty=match[3]
          name = match[2].trim();
          qty = parseInt(match[3], 10);
        } else if (pattern.source.includes('[\\\\w\\\\sáéíóúñÁÉÍÓÚÑ()%+\\\\-.]{3,}?')) {
          // Tabla sin código: "1 Producto   6 ..." → name=match[1], qty=match[2]
          name = match[1].trim();
          qty = parseInt(match[2], 10);
        } else {
          // "Cajas de vino   3" → name="Cajas de vino", qty=3
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

export async function processManifestImage(imagePath, isPdf = false, isCsv = false) {
  let raw = '';
  
  if (isCsv) {
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
  return { address, raw, items };
}
