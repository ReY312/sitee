import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnils, validatePayload } from '../src/validation.js';

test('normalizeSnils strips formatting', () => {
  assert.equal(normalizeSnils('112-233-445 95'), '11223344595');
});

test('validatePayload accepts valid payload', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const selectedDate = tomorrow.toISOString().slice(0, 10);

  const result = validatePayload({
    fullName: 'Иванов Иван Иванович',
    snils: '112-233-445 95',
    selectedDate,
  });

  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
});

test('validatePayload rejects invalid date', () => {
  const result = validatePayload({
    fullName: 'Иванов Иван Иванович',
    snils: '112-233-445 95',
    selectedDate: 'bad-date',
  });

  assert.equal(result.success, false);
  assert.match(result.errors.join(' '), /дата/i);
});
