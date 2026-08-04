// Limpieza semántica de direcciones extraídas por OCR (Kavana Lens).
// Extrae la dirección de entrega eliminando símbolos de tabla y palabras
// clave de envío que ensucian el GPS (ver DECISIONES_ESTRATEGICAS.md).

const MATERIAL_KEYWORDS = [
  'bultos', 'cajas', 'palet', 'palets', 'paquetes', 'caja', 'bulto'
];

const TABLE_SYMBOLS = ['|', '[', ']', '{', '}', '\\', ';', '~', '°', '_'];

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
  const lower = text.toLowerCase();
  for (const kw of MATERIAL_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'gi');
    text = text.replace(re, '');
  }

  // 3. Normalizar espacios y limpiar ruido de puntuación colindante.
  text = text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .replace(/([.,])\s*$/g, '')
    .replace(/^\s*[:\-–]\s*/g, '')
    .trim();

  return text;
}
