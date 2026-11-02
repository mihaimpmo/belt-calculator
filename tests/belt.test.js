import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pitchDiameter, beltLength, beltLengthApprox,
  centerDistance, centerDistanceApprox, beltLoop, solve,
} from '../js/belt.js';

const close = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} diferă de ${b} (toleranță ${tol})`);

test('diametrul de pitch', () => {
  close(pitchDiameter(20, 2), 12.7324, 1e-4);
  close(pitchDiameter(40, 2), 25.4648, 1e-4);
});

test('roți egale: L = 2C + πD', () => {
  close(beltLength(100, 30, 30), 200 + Math.PI * 30);
  close(beltLengthApprox(100, 30, 30), 200 + Math.PI * 30);
});

test('exemplul GT2 20T / 40T la C = 100 mm', () => {
  const D1 = pitchDiameter(20, 2);
  const D2 = pitchDiameter(40, 2);
  close(beltLength(100, D1, D2), 260.40, 0.01);
  close(beltLengthApprox(100, D1, D2), 260.41, 0.01);
});

test('ordinea roților nu contează', () => {
  close(beltLength(80, 20, 50), beltLength(80, 50, 20));
});

test('distanța din lungime e inversa exactă a lungimii', () => {
  for (const [C, D1, D2] of [[100, 12.73, 25.46], [55, 10, 60], [300, 40, 40], [42, 30, 31]]) {
    close(centerDistance(beltLength(C, D1, D2), D1, D2), C, 1e-6);
  }
});

test('formula aproximativă inversată', () => {
  const C = 120, D1 = 15, D2 = 48;
  close(centerDistanceApprox(beltLengthApprox(C, D1, D2), D1, D2), C, 1e-9);
});

test('cureaua de 130T dă C = 99,80 mm', () => {
  const r = solve({ mode: 'timing', pitch: 2, pld: 0.254, z1: 20, z2: 40, C: 100 });
  assert.equal(r.teethNearest ?? r.teeth, 130);
  close(r.Cactual, 99.80, 0.01);
  assert.equal(r.valid, true);
});

test('regulile de rotunjire', () => {
  const base = { mode: 'timing', pitch: 2, pld: 0.254, z1: 20, z2: 40, C: 100 };
  assert.equal(solve({ ...base, teeth: 'down' }).teeth, 130);
  assert.equal(solve({ ...base, teeth: 'up' }).teeth, 131);
  assert.equal(solve({ ...base, teeth: 150 }).teeth, 150);
});

test('geometrie imposibilă', () => {
  assert.ok(Number.isNaN(beltLength(5, 10, 40)));
  assert.equal(solve({ mode: 'diameter', D1: 10, D2: 40, C: 5 }).valid, false);
  assert.equal(solve({ mode: 'timing', pitch: 2, z1: 20, z2: 40, C: 100, teeth: 20 }).valid, false);
});

test('traseul desenat are lungimea din formula exactă și e continuu', () => {
  const C = 90, r1 = 8, r2 = 21;
  const loop = beltLoop(C, r1, r2);
  close(loop.L, beltLength(C, 2 * r1, 2 * r2), 1e-9);
  for (const s of [loop.s0, loop.s1, loop.s2, loop.L]) {
    const a = loop.at(s - 1e-7);
    const b = loop.at(s + 1e-7);
    close(a.x, b.x, 1e-5);
    close(a.y, b.y, 1e-5);
  }
  // pe arce, punctele stau pe cercul roții
  const p = loop.at((loop.s0 + loop.s1) / 2);
  close(Math.hypot(p.x - C, p.y), r2, 1e-9);
  const q = loop.at((loop.s2 + loop.L) / 2);
  close(Math.hypot(q.x, q.y), r1, 1e-9);
});
