import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAddress, extractAddressLines } from '../src/services/addressCleaner.js';

test('elimina simbolos de tabla (|, [, ])', () => {
  const input = '| Paquetes | Calle Mayor 12 | [Bulto]';
  const out = cleanAddress(input);
  assert.ok(!out.includes('|'));
  assert.ok(!out.includes('['));
  assert.ok(!out.includes(']'));
});

test('filtra palabras clave de envio', () => {
  const input = 'Palet y Cajas entregar en Avda. del Puerto 45, Valencia';
  const out = cleanAddress(input);
  assert.ok(!out.includes('Palet'));
  assert.ok(!out.includes('Cajas'));
  assert.ok(out.includes('Avda. del Puerto 45'));
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
