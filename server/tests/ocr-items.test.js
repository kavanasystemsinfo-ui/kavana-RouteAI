// Test automatizado de OCR - extracción de items contra fixtures anonimizados
// Valida: items detectados contra expected
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractItemsFromText } from '../src/services/ocrService.js';
import ocrFixtures from './fixtures/ocr-fixtures.js';

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemsMatch(expected, actual) {
  if (!expected.length && !actual.length) return true;
  if (!expected.length || !actual.length) return false;
  
  let matched = 0;
  for (const exp of expected) {
    const expNorm = normalizeText(exp.name);
    const found = actual.some(act => {
      const actNorm = normalizeText(act.name);
      // Match por nombre (contiene palabra clave) y cantidad exacta
      return (expNorm.includes(actNorm.split(' ')[0]) || actNorm.includes(expNorm.split(' ')[0])) &&
             act.qty === exp.qty;
    });
    if (found) matched++;
  }
  return matched >= expected.length * 0.8; // 80% de items esperados encontrados
}

test('OCR: extractItemsFromText - fixtures anonimizados', () => {
  const results = [];
  
  for (const fixture of ocrFixtures) {
    const items = extractItemsFromText(fixture.input);
    
    const itemsOk = itemsMatch(fixture.expected.items, items);
    
    results.push({
      name: fixture.name,
      items: { extracted: items, expected: fixture.expected.items, ok: itemsOk }
    });
  }
  
  // Métricas agregadas
  const total = results.length;
  const itemsPass = results.filter(r => r.items.ok).length;
  
  const itemsRate = itemsPass / total;
  
  console.log(`\n=== MÉTRICAS extractItemsFromText (${total} fixtures) ===`);
  console.log(`Bultos:    ${itemsPass}/${total} = ${(itemsRate * 100).toFixed(1)}%`);
  
  // Detalle por fixture fallado
  for (const r of results) {
    if (!r.items.ok) {
      console.log(`\n⚠️  ${r.name}:`);
      console.log(`   Items: extraídos=${JSON.stringify(r.items.extracted)} | esperados=${JSON.stringify(r.items.expected)}`);
    }
  }
  
  // Assert final (umbral del plan: ≥80% bultos)
  assert.ok(itemsRate >= 0.80, `Items rate ${(itemsRate*100).toFixed(1)}% < 80%`);
});