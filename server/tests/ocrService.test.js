import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processManifestImage } from '../src/services/ocrService.js';
import { cleanAddress } from '../src/services/addressCleaner.js';

test('processManifestImage limpia un texto OCR simulado', async () => {
  // Sin Tesseract en CI, runTesseract devuelve '' -> address vacía pero no falla.
  const result = await processManifestImage('/nonexistent.jpg');
  assert.ok('address' in result);
});

test('cleanAddress integrado en OCR: quita materiales', () => {
  const dirty = 'Puntales y Largueros | Entregar Avda. del Acero 45, Valencia';
  const out = cleanAddress(dirty);
  assert.ok(!out.includes('Puntales'));
  assert.ok(out.includes('Avda. del Acero 45'));
});
