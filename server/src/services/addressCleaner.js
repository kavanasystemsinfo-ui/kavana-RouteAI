// Limpieza semántica de direcciones extraídas por OCR (Kavana Lens).
// Extrae la dirección de entrega eliminando símbolos de tabla y palabras
// clave de envío que ensucian el GPS (ver DECISIONES_ESTRATEGICAS.md).
// V2: validación de direcciones reales españolas.

const MATERIAL_KEYWORDS = [
  'bultos', 'cajas', 'palet', 'palets', 'paquetes', 'caja', 'bulto'
];

const TABLE_SYMBOLS = ['|', '[', ']', '{', '}', '\\\\', ';', '~', '°', '_'];

// Patrones de direcciones españolas
const ADDRESS_PATTERNS = [
  /\bCalle\s+\w+[\s\w,]*\d+/i,
  /\bC\/\s*\w+[\s\w,]*\d+/i,
  /\bAvenida\s+\w+[\s\w,]*\d+/i,
  /\bAv\.?\s+\w+[\s\w,]*\d+/i,
  /\bAvda\.?\s+\w+[\s\w,]*\d+/i,
  /\bCarrer\s+\w+[\s\w,]*\d+/i,
  /\bRonda\s+\w+[\s\w,]*\d+/i,
  /\bPaseo\s+\w+[\s\w,]*\d+/i,
  /\bPlaza\s+\w+[\s\w,]*\d+/i,
  /\bCtra\.?\s+\w+[\s\w,]*\d+/i,
  /\bCrta\.?\s+\w+[\s\w,]*\d+/i,
  /\bCamino\s+\w+[\s\w,]*\d+/i,
  /\bUrbanización\s+\w+[\s\w,]*\d*/i,
  /\bPolígono\s+\w+[\s\w,]*\d*/i,
  /\bPol\.?\s+\w+[\s\w,]*\d*/i,
  /\bPg\.?\s+\w+[\s\w,]*\d*/i,
  /\bCalleja\s+\w+[\s\w,]*\d+/i,
  /\bTravesía\s+\w+[\s\w,]*\d+/i,
  /\bGlorieta\s+\w+[\s\w,]*\d*/i,
  /\bPasaje\s+\w+[\s\w,]*\d+/i,
  // Formatos flexibles
  /\w+\s+\d{1,5}[\s,]+0?\d{5}/i,  // "Nombre 123, 28001"
  /\w+[,\s]+\d{1,5}[,\s]+\d{5}/i,  // "Madrid, 45, 28001"
  /\b\d{5}\b/,                       // Código postal 28001
  /\b\d{1,5}\s+\w+[,\s]+\d{5}\b/i, // "45 Madrid, 28001"
  /\w+\s+\d{1,5}\s+[A-Z]/i,        // "Mayor 12 M" (indicio de dirección)
];

export function extractAddressLines(raw) {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function cleanAddress(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw;

  // 1. Quitar símbolos de tabla física que Tesseract arrastra.
  for (const sym of TABLE_SYMBOLS) {
    text = text.split(sym).join(' ');
  }

  // 2. Quitar palabras clave de material (case-insensitive).
  for (const kw of MATERIAL_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'gi');
    text = text.replace(re, '');
  }

  // 3. Normalizar espacios y limpiar ruido de puntuación colindante.
  text = text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .replace(/([.,])\s*$/g, '')
    .replace(/^\s*[:\\-–]\s*/g, '')
    .trim();

  // 4. Validar que es una dirección real (contiene calle/av/etc + número)
  const hasAddressPattern = ADDRESS_PATTERNS.some(p => p.test(text));
  
  if (!hasAddressPattern) {
    // Buscar en líneas individuales
    const lines = text.split('\n');
    for (const line of lines) {
      if (ADDRESS_PATTERNS.some(p => p.test(line))) {
        return line.trim();
      }
    }
    return '';
  }

  return text;
}
