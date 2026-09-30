import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardPeriod } from '../src/utils/dashboardPeriod.ts';

test('compara o mesmo intervalo de dias quando o mês anterior é mais curto', () => {
  assert.deepEqual(dashboardPeriod(new Date(2026, 2, 31)), {
    currentStart: '2026-03-01', currentEnd: '2026-03-31',
    previousStart: '2026-02-01', previousEnd: '2026-02-28', previousEndDay: 28,
  });
});

test('respeita a passagem de ano', () => {
  assert.equal(dashboardPeriod(new Date(2026, 0, 15)).previousEnd, '2025-12-15');
});
