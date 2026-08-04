import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAddress, extractAddressLines } from '../src/services/addressCleaner.js';

test('elimina simbolos de tabla (|, [, ])', () => {
  const input = '| Puntales | Calle Mayor 12 | [Bulto]';
  const out = cleanAddress(input);
  assert.ok(!out.includes('|'));
  assert.ok(!out.includes('['));
  assert.ok(!out.includes(']'));
});

test('filtra palabras clave de material industrial', () => {
  const input = 'Largueros y Puntales entregar en Avda. del Acero 45, Valencia';
  const out = cleanAddress(input);
  assert.ok(!out.includes('Largueros'));
  assert.ok(!out.includes('Puntales'));
  assert.ok(out.includes('Avda. del Acero 45'));
});

test('conserva la direccion limpia y legible', () => {
  const input = 'Cliente: Juan | Direccion: C/ Industria 8, Paterna (Valencia) | 4 bultos';
  const out = cleanAddress(input);
  assert.ok(out.includes('C/ Industria 8'));
  assert.ok(out.includes('Paterna'));
});

test('extractAddressLines devuelve lineas no vacias', () => {
  const lines = extractAddressLines('Linea1\n\n  \nLinea2 con datos');
  assert.deepEqual(lines, ['Linea1', 'Linea2 con datos']);
});
