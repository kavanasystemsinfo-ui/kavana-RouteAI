import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePOD } from '../src/services/pdfService.js';
import fs from 'fs';

// PNG válido de 1x1 px (blanco) codificado en base64.
const VALID_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR4nGP8//8/AzbAhFV00EoAAFbUAw037MyjAAAAAElFTkSuQmCC';

test('generatePOD crea un PDF valido con firma', async () => {
  const stop = { id: 7, address: 'C/ Prueba 1, Paterna', receiver_name: 'Maria' };
  const signature = 'data:image/png;base64,' + VALID_PNG;
  const geo = { lat: 39.5, lng: -0.42 };
  const filePath = await generatePOD(stop, signature, geo);
  assert.ok(fs.existsSync(filePath));
  const head = fs.readFileSync(filePath).subarray(0, 5).toString('latin1');
  assert.equal(head, '%PDF-');
  fs.unlinkSync(filePath);
});

test('generatePOD maneja firma ausente', async () => {
  const stop = { id: 8, address: 'C/ Sin 1', receiver_name: 'Pedro' };
  const filePath = await generatePOD(stop, null);
  assert.ok(fs.existsSync(filePath));
  fs.unlinkSync(filePath);
});
