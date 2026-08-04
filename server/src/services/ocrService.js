// OCR de albaranes industriales (Kavana Lens).
// Tesseract extrae texto; luego addressCleaner limpia símbolos de tabla
// y filtra materiales para dejar una dirección GPS limpia (ver DECISIONES).

import { cleanAddress } from './addressCleaner.js';

// Si Tesseract local está disponible lo usamos; si no, devolvemos el texto crudo
// para que el operario lo corrija manualmente (no bloquea el flujo).
async function runTesseract(imagePath) {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const { data } = await Tesseract.recognize(imagePath, 'spa', { logger: () => {} });
    return data.text;
  } catch {
    return '';
  }
}

export async function processManifestImage(imagePath) {
  const raw = await runTesseract(imagePath);
  const address = cleanAddress(raw);
  return { address, raw: raw || '' };
}
