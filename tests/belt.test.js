import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/belt.js';

const { beltLength, beltLengthApprox, beltLoop, solve } = globalThis.Belt;

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} differs from ${b} (tolerance ${tol})`);

test('equal pulleys: L = 2C + πD', () => {
  close(beltLength(100, 30, 30), 200 + Math.PI * 30);
  close(beltLengthApprox(100, 30, 30), 200 + Math.PI * 30);
});

test('GT2 20T / 40T example at C = 100 mm', () => {
  const D1 = (20 * 2) / Math.PI;
  const D2 = (40 * 2) / Math.PI;
  close(beltLength(100, D1, D2), 260.40, 0.01);
  close(beltLengthApprox(100, D1, D2), 260.41, 0.01);
});

test('pulley order does not matter', () => {
  close(beltLength(80, 20, 50), beltLength(80, 50, 20));
});

test('exact and approximate agree for small diameter differences', () => {
  close(beltLength(300, 40, 50), beltLengthApprox(300, 40, 50), 0.01);
});

test('impossible or invalid input', () => {
  assert.ok(Number.isNaN(beltLength(5, 10, 40)));
  assert.equal(solve(10, 40, 5).valid, false);
  assert.equal(solve(0, 40, 100).valid, false);
});

test('overlap warning', () => {
  const r = solve(40, 40, 30);
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some((w) => w.level === 'error'));
});

test('drawn path matches the exact length and is continuous', () => {
  const C = 90, r1 = 8, r2 = 21;
  const loop = beltLoop(C, r1, r2);
  close(loop.L, beltLength(C, 2 * r1, 2 * r2), 1e-9);
  for (const s of [loop.s0, loop.s1, loop.s2, loop.L]) {
    const a = loop.at(s - 1e-7);
    const b = loop.at(s + 1e-7);
    close(a.x, b.x, 1e-5);
    close(a.y, b.y, 1e-5);
  }
  const p = loop.at((loop.s0 + loop.s1) / 2);
  close(Math.hypot(p.x - C, p.y), r2, 1e-9);
});
