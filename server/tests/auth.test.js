import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken, extractToken } from '../src/auth.js';

test('signToken + verifyToken roundtrip', () => {
  const secret = 'test-secret';
  const token = signToken({ role: 'office' }, secret);
  const payload = verifyToken(token, secret);
  assert.equal(payload.role, 'office');
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
});

test('verifyToken falla con secreto distinto', () => {
  const token = signToken({ role: 'office' }, 'secret-a');
  assert.throws(() => verifyToken(token, 'secret-b'), /inv.lid/i);
});

test('verifyToken falla con token expirado', () => {
  const token = signToken({ role: 'driver', driverId: 1, exp: 1 }, 's');
  assert.throws(() => verifyToken(token, 's'), /expir|inv.lid/i);
});

test('extractToken lee Bearer header', () => {
  const req = { headers: { authorization: 'Bearer abc.def.ghi' } };
  assert.equal(extractToken(req), 'abc.def.ghi');
});
