// Math for an open belt drive between two pulleys.
// All lengths are in mm, all angles in radians.
// This file has no browser dependencies, so it can be tested directly with Node.

export const PROFILES = [
  { id: 'gt2-2', name: 'GT2 · 2 mm', pitch: 2, pld: 0.254 },
  { id: 'gt2-3', name: 'GT2 · 3 mm', pitch: 3, pld: 0.381 },
  { id: 'gt2-5', name: 'GT2 · 5 mm', pitch: 5, pld: 0.5715 },
  { id: 'htd-3m', name: 'HTD 3M', pitch: 3, pld: 0.381 },
  { id: 'htd-5m', name: 'HTD 5M', pitch: 5, pld: 0.5715 },
  { id: 'htd-8m', name: 'HTD 8M', pitch: 8, pld: 0.686 },
  { id: 'mxl', name: 'MXL · 2.032 mm', pitch: 2.032, pld: 0.254 },
  { id: 'xl', name: 'XL · 5.08 mm', pitch: 5.08, pld: 0.254 },
  { id: 'custom', name: 'Custom pitch…', pitch: null, pld: 0 },
];

/** Pitch diameter of a toothed pulley: D = z·p / π */
export const pitchDiameter = (z, p) => (z * p) / Math.PI;

/**
 * Wrap geometry for center distance C and diameters D1, D2.
 * phi is signed: positive when pulley 2 is larger than pulley 1.
 * Returns null if the geometry is impossible.
 */
export function wrap(C, D1, D2) {
  const d = D2 - D1;
  if (!(C > 0) || !(Math.abs(d) < 2 * C)) return null;
  const phi = Math.asin(d / (2 * C));
  return {
    phi,
    span: C * Math.cos(phi),          // length of one straight span
    wrap1: Math.PI - 2 * phi,         // wrap angle on pulley 1
    wrap2: Math.PI + 2 * phi,         // wrap angle on pulley 2
  };
}

/** Exact belt length. */
export function beltLength(C, D1, D2) {
  const g = wrap(C, D1, D2);
  if (!g) return NaN;
  return 2 * g.span + (Math.PI * (D1 + D2)) / 2 + g.phi * (D2 - D1);
}

/** Approximate length: L ≈ 2C + π(D1+D2)/2 + (D2−D1)²/(4C) */
export function beltLengthApprox(C, D1, D2) {
  if (!(C > 0)) return NaN;
  return 2 * C + (Math.PI * (D1 + D2)) / 2 + (D2 - D1) ** 2 / (4 * C);
}

/** Center distance from the approximate formula, inverted. */
export function centerDistanceApprox(L, D1, D2) {
  const b = 2 * L - Math.PI * (D1 + D2);
  const disc = b * b - 8 * (D2 - D1) ** 2;
  if (!(b > 0) || disc < 0) return NaN;
  return (b + Math.sqrt(disc)) / 8;
}

/**
 * Center distance for a belt of length L, from the exact formula.
 * L(C) is strictly increasing (dL/dC = 2·cos φ), so bisection always converges.
 */
export function centerDistance(L, D1, D2) {
  const d = Math.abs(D2 - D1);
  const Lmin = (Math.PI * (D1 + D2)) / 2 + (Math.PI / 2) * d;
  if (!(L > Lmin)) return NaN;
  let lo = d / 2;
  let hi = Math.max(L, d);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const Lm = mid <= d / 2 ? Lmin : beltLength(mid, D1, D2);
    if (Lm < L) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Belt path along the pitch line, for drawing and animation.
 * Pulley 1 is at (0, 0), pulley 2 at (C, 0); y points up.
 * The belt runs clockwise:
 * upper span → arc on pulley 2 → lower span → arc on pulley 1.
 */
export function beltLoop(C, r1, r2) {
  const phi = Math.asin((r2 - r1) / C);
  const a = Math.PI / 2 + phi;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const span = C * Math.cos(phi);
  const w1 = Math.PI - 2 * phi;
  const w2 = Math.PI + 2 * phi;

  const A1 = [r1 * ca, r1 * sa];
  const B1 = [C + r2 * ca, r2 * sa];
  const B2 = [C + r2 * ca, -r2 * sa];
  const A2 = [r1 * ca, -r1 * sa];

  const s0 = span;
  const s1 = s0 + r2 * w2;
  const s2 = s1 + span;
  const L = s2 + r1 * w1;

  // Point at path distance s: position, tangent (direction of travel) and inward normal.
  function at(s) {
    s = ((s % L) + L) % L;
    if (s < s0) {
      const t = s / span;
      return {
        x: A1[0] + t * (B1[0] - A1[0]),
        y: A1[1] + t * (B1[1] - A1[1]),
        tx: (B1[0] - A1[0]) / span, ty: (B1[1] - A1[1]) / span,
        nx: -ca, ny: -sa,
      };
    }
    if (s < s1) {
      const ang = a - (s - s0) / r2;
      const c = Math.cos(ang), sn = Math.sin(ang);
      return { x: C + r2 * c, y: r2 * sn, tx: sn, ty: -c, nx: -c, ny: -sn };
    }
    if (s < s2) {
      const t = (s - s1) / span;
      return {
        x: B2[0] + t * (A2[0] - B2[0]),
        y: B2[1] + t * (A2[1] - B2[1]),
        tx: (A2[0] - B2[0]) / span, ty: (A2[1] - B2[1]) / span,
        nx: -ca, ny: sa,
      };
    }
    const ang = -a - (s - s2) / r1;
    const c = Math.cos(ang), sn = Math.sin(ang);
    return { x: r1 * c, y: r1 * sn, tx: sn, ty: -c, nx: -c, ny: -sn };
  }

  return { L, span, phi, a, w1, w2, s0, s1, s2, A1, B1, B2, A2, at };
}

/**
 * Full calculation.
 * input = { mode: 'timing' | 'diameter', C,
 *           timing:   pitch, pld, z1, z2, teeth (number | 'near' | 'down' | 'up')
 *           diameter: D1, D2 }
 */
export function solve(input) {
  const timing = input.mode === 'timing';
  const p = timing ? input.pitch : null;
  const pld = timing ? input.pld || 0 : 0;
  const D1 = timing ? pitchDiameter(input.z1, p) : input.D1;
  const D2 = timing ? pitchDiameter(input.z2, p) : input.D2;
  const C = input.C;

  const r = {
    mode: input.mode, C, p, pld, D1, D2,
    z1: input.z1, z2: input.z2,
    OD1: D1 - 2 * pld, OD2: D2 - 2 * pld,
    ratio: D2 / D1,
    warnings: [],
    valid: true,
  };

  r.L = beltLength(C, D1, D2);
  r.Lapprox = beltLengthApprox(C, D1, D2);

  if (!Number.isFinite(r.L)) {
    r.valid = false;
    r.warnings.push({
      level: 'error',
      text: 'The center distance is too small for these pulleys: the belt cannot wrap around them.',
    });
    return r;
  }

  if (timing) {
    r.teethExact = r.L / p;
    r.teethNearest = Math.round(r.teethExact);
    const rule = input.teeth ?? 'near';
    const eps = 1e-9;
    if (typeof rule === 'number') r.teeth = rule;
    else if (rule === 'down') r.teeth = Math.floor(r.teethExact + eps);
    else if (rule === 'up') r.teeth = Math.ceil(r.teethExact - eps);
    else r.teeth = Math.round(r.teethExact);
    r.teethRule = typeof rule === 'number' ? 'manual' : rule;

    r.Lbelt = r.teeth * p;
    r.Cactual = centerDistance(r.Lbelt, D1, D2);
    // at very small distances, rounding down can give an impossible belt: go up one tooth
    if (!Number.isFinite(r.Cactual) && typeof rule !== 'number') {
      r.teeth += 1;
      r.Lbelt = r.teeth * p;
      r.Cactual = centerDistance(r.Lbelt, D1, D2);
    }
    r.CactualApprox = centerDistanceApprox(r.Lbelt, D1, D2);
    if (!Number.isFinite(r.Cactual)) {
      r.valid = false;
      r.warnings.push({
        level: 'error',
        text: `A ${r.teeth}-tooth belt is too short for these pulleys.`,
      });
      return r;
    }
  } else {
    r.Lbelt = r.L;
    r.Cactual = C;
  }

  r.delta = r.Cactual - C;
  const g = wrap(r.Cactual, D1, D2);
  r.phi = g.phi;
  r.span = g.span;
  r.wrapSmall = Math.PI - 2 * Math.abs(g.phi);
  r.wrapLarge = Math.PI + 2 * Math.abs(g.phi);

  if (timing) {
    r.meshTeeth = (Math.min(input.z1, input.z2) * r.wrapSmall) / (2 * Math.PI);
  }

  const gap = r.Cactual - (r.OD1 + r.OD2) / 2;
  if (gap < 0) {
    r.warnings.push({ level: 'error', text: 'The pulleys overlap at this distance.' });
  } else if (gap < 2) {
    r.warnings.push({
      level: 'warn',
      text: `Only ${gap.toFixed(1)} mm of clearance between the pulleys.`,
    });
  }
  if (timing && r.meshTeeth < 6) {
    r.warnings.push({
      level: 'warn',
      text: `Only ${r.meshTeeth.toFixed(1)} teeth in mesh on the small pulley. Below 6, the belt can skip under load.`,
    });
  }
  if ((r.wrapSmall * 180) / Math.PI < 120) {
    r.warnings.push({
      level: 'warn',
      text: 'Wrap angle on the small pulley is below 120°. Increase the distance or add an idler.',
    });
  }

  return r;
}
