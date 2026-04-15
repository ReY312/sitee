import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnils, validatePayload } from '../src/validation.js';

test('normalizeSnils strips formatting', () => {
  assert.equal(normalizeSnils('112-233-445 95'), '11223344595');
});

test('validatePayload accepts valid payload', () => {
  const in30m = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const result = validatePayload({
    fullName: 'Иванов Иван Иванович',
    snils: '112-233-445 95',
    appointmentAt: in30m,
  });

  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
});

test('validatePayload rejects invalid snils', () => {
  const in30m = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const result = validatePayload({
    fullName: 'Иванов Иван Иванович',
    snils: '123-456-789 00',
    appointmentAt: in30m,
  });

  assert.equal(result.success, false);
  assert.match(result.errors.join(' '), /СНИЛС/);
});
