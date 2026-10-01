// Test automatizado de OCR contra fixtures anonimizados
// Valida: dirección extraída y bultos detectados contra expected
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processManifestImage } from '../src/services/ocrService.js';
import ocrFixtures from './fixtures/ocr-fixtures.js';

function normalizeAddress(addr) {
  return addr
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressesMatch(a, b) {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  // Dirección extraída debe contener la esperada o viceversa (flexible)
  return na.includes(nb) || nb.includes(na) || 
         // O comparten componentes clave (calle + número + cp)
         (na.split(' ').filter(w => w.length > 3).every(w => nb.includes(w))) &&
         (nb.split(' ').filter(w => w.length > 3).every(w => na.includes(w)));
}

function itemsMatch(expected, actual) {
  if (!expected.length && !actual.length) return true;
  if (!expected.length || !actual.length) return false;
  
  let matched = 0;
  for (const exp of expected) {
    const found = actual.some(act => 
      normalizeAddress(act.name).includes(normalizeAddress(exp.name).split(' ')[0]) &&
      act.qty === exp.qty
    );
    if (found) matched++;
  }
  return matched >= expected.length * 0.8; // 80% de items esperados encontrados
}

test('OCR: fixtures anonimizados - dirección y bultos', async () => {
  const results = [];
  
  for (const fixture of ocrFixtures) {
    // Usar rawTextOverride para pasar el texto directo sin intentar abrirlo como archivo
    const result = await processManifestImage('', false, false, fixture.input);
    
    const addressOk = addressesMatch(result.address || '', fixture.expected.address);
    const itemsOk = itemsMatch(fixture.expected.items, result.items || []);
    
    results.push({
      name: fixture.name,
      address: { extracted: result.address, expected: fixture.expected.address, ok: addressOk },
      items: { extracted: result.items, expected: fixture.expected.items, ok: itemsOk }
    });
  }
  
  // Métricas agregadas
  const total = results.length;
  const addressPass = results.filter(r => r.address.ok).length;
  const itemsPass = results.filter(r => r.items.ok).length;
  
  const addressRate = addressPass / total;
  const itemsRate = itemsPass / total;
  
  console.log(`\n=== MÉTRICAS OCR (${total} fixtures) ===`);
  console.log(`Dirección: ${addressPass}/${total} = ${(addressRate * 100).toFixed(1)}%`);
  console.log(`Bultos:    ${itemsPass}/${total} = ${(itemsRate * 100).toFixed(1)}%`);
  
  // Detalle por fixture fallado
  for (const r of results) {
    if (!r.address.ok || !r.items.ok) {
      console.log(`\n⚠️  ${r.name}:`);
      if (!r.address.ok) console.log(`   Dirección: extraído="${r.address.extracted}" | esperado="${r.address.expected}"`);
      if (!r.items.ok) console.log(`   Items: extraídos=${JSON.stringify(r.items.extracted)} | esperados=${JSON.stringify(r.items.expected)}`);
    }
  }
  
  // Asserts finales (umbrales del plan: ≥90% dirección, ≥80% bultos)
  assert.ok(addressRate >= 0.90, `Dirección rate ${(addressRate*100).toFixed(1)}% < 90%`);
  assert.ok(itemsRate >= 0.80, `Items rate ${(itemsRate*100).toFixed(1)}% < 80%`);
});