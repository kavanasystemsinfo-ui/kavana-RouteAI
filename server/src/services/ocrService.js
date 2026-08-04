// OCR de albaranes industriales (Kavana Lens).
// Extrae texto de imágenes, PDFs y CSV sin dependencias pesadas.
// Tesseract.js es OPCIONAL (solo si está instalado en node_modules).
// Fallback: lectura directa + addressCleaner inteligente.

import { cleanAddress } from './addressCleaner.js';
import fs from 'fs';

// OCR en imágenes (Tesseract online)
async function runTesseract(imagePath) {
  try {
    // Dynamic import - solo falla si no está instalado
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
    // Si el archivo empieza con bytes típicos de imagen/PDF, es binario
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
    // Usar execFileSync con array de args (evita inyección por shell)
    const { execFileSync } = await import('child_process');
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { 
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
    return text;
  } catch (e) {
    console.warn('Error extrayendo texto de PDF con pdftotext:', e.message);
    // Fallback: leer como texto plano
    try {
      const buffer = fs.readFileSync(pdfPath, 'utf8');
      // Buscar direcciones en el PDF crudo
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

export async function processManifestImage(imagePath, isPdf = false, isCsv = false) {
  let raw = '';
  
  if (isCsv) {
    raw = extractCsvText(imagePath);
  } else if (isPdf) {
    raw = await extractPdfText(imagePath);
  } else {
    // Imagen: intentar OCR primero, fallback solo si es texto legible
    const ocrResult = await runTesseract(imagePath);
    if (ocrResult && ocrResult.trim()) {
      raw = ocrResult;
    } else if (!isBinaryFile(imagePath)) {
      // Fallback: leer como texto (solo si no es binario)
      try {
        raw = fs.readFileSync(imagePath, 'utf8').replace(/[^\x20-\x7E\nÁÉÍÓÚÑáéíóúñ]/g, ' ').replace(/\s+/g, ' ').trim();
      } catch (e) {
        raw = '';
      }
    } else {
      // Es imagen binaria sin OCR disponible
      raw = '';
    }
  }
  
  const address = cleanAddress(raw);
  return { address, raw };
}
