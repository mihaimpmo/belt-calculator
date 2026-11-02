// Calcule pentru o transmisie cu curea deschisă între două roți.
// Toate lungimile sunt în mm, toate unghiurile în radiani.
// Fișierul nu depinde de browser, așa că poate fi testat direct cu Node.

export const PROFILES = [
  { id: 'gt2-2', name: 'GT2 · 2 mm', pitch: 2, pld: 0.254 },
  { id: 'gt2-3', name: 'GT2 · 3 mm', pitch: 3, pld: 0.381 },
  { id: 'gt2-5', name: 'GT2 · 5 mm', pitch: 5, pld: 0.5715 },
  { id: 'htd-3m', name: 'HTD 3M', pitch: 3, pld: 0.381 },
  { id: 'htd-5m', name: 'HTD 5M', pitch: 5, pld: 0.5715 },
  { id: 'htd-8m', name: 'HTD 8M', pitch: 8, pld: 0.686 },
  { id: 'mxl', name: 'MXL · 2,032 mm', pitch: 2.032, pld: 0.254 },
  { id: 'xl', name: 'XL · 5,08 mm', pitch: 5.08, pld: 0.254 },
  { id: 'custom', name: 'Alt pas…', pitch: null, pld: 0 },
];

/** Diametrul de pitch al unei roți dințate: D = z·p / π */
export const pitchDiameter = (z, p) => (z * p) / Math.PI;

/**
 * Geometria înfășurării pentru distanța C și diametrele D1, D2.
 * phi are semn: e pozitiv când roata 2 e mai mare decât roata 1.
 * Întoarce null dacă geometria e imposibilă.
 */
export function wrap(C, D1, D2) {
  const d = D2 - D1;
  if (!(C > 0) || !(Math.abs(d) < 2 * C)) return null;
  const phi = Math.asin(d / (2 * C));
  return {
    phi,
    span: C * Math.cos(phi),          // lungimea unei porțiuni drepte
    wrap1: Math.PI - 2 * phi,         // unghiul de înfășurare pe roata 1
    wrap2: Math.PI + 2 * phi,         // unghiul de înfășurare pe roata 2
  };
}

/** Lungimea exactă a curelei. */
export function beltLength(C, D1, D2) {
  const g = wrap(C, D1, D2);
  if (!g) return NaN;
  return 2 * g.span + (Math.PI * (D1 + D2)) / 2 + g.phi * (D2 - D1);
}

/** Lungimea aproximativă: L ≈ 2C + π(D1+D2)/2 + (D2−D1)²/(4C) */
export function beltLengthApprox(C, D1, D2) {
  if (!(C > 0)) return NaN;
  return 2 * C + (Math.PI * (D1 + D2)) / 2 + (D2 - D1) ** 2 / (4 * C);
}

/** Distanța dintre centre din formula aproximativă, inversată. */
export function centerDistanceApprox(L, D1, D2) {
  const b = 2 * L - Math.PI * (D1 + D2);
  const disc = b * b - 8 * (D2 - D1) ** 2;
  if (!(b > 0) || disc < 0) return NaN;
  return (b + Math.sqrt(disc)) / 8;
}

/**
 * Distanța dintre centre pentru o curea de lungime L, din formula exactă.
 * L(C) e strict crescătoare (dL/dC = 2·cos φ), deci căutarea binară e sigură.
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
 * Traseul curelei pe linia de pitch, pentru desen și animație.
 * Roata 1 e în (0, 0), roata 2 în (C, 0); y crește în sus.
 * Cureaua e parcursă în sensul acelor de ceasornic:
 * dreapta de sus → arcul roții 2 → dreapta de jos → arcul roții 1.
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

  // Punct pe traseu la distanța s: poziție, tangentă (sensul de mers) și normala spre interior.
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
 * Calculul complet.
 * input = { mode: 'timing' | 'diameter', C,
 *           timing:   pitch, pld, z1, z2, teeth (număr | 'near' | 'down' | 'up')
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
      text: 'Distanța dintre centre e prea mică pentru aceste roți: cureaua nu le poate înfășura.',
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
    // la distanțe foarte mici, rotunjirea în jos poate da o curea imposibilă: urcăm un dinte
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
        text: `O curea de ${r.teeth} dinți e prea scurtă pentru aceste roți.`,
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
    r.warnings.push({ level: 'error', text: 'Roțile se suprapun la distanța asta.' });
  } else if (gap < 2) {
    r.warnings.push({
      level: 'warn',
      text: `Între roți rămân doar ${gap.toFixed(1).replace('.', ',')} mm.`,
    });
  }
  if (timing && r.meshTeeth < 6) {
    r.warnings.push({
      level: 'warn',
      text: `Pe roata mică sunt doar ${r.meshTeeth.toFixed(1).replace('.', ',')} dinți în angrenare. Sub 6, cureaua poate sări sub sarcină.`,
    });
  }
  if ((r.wrapSmall * 180) / Math.PI < 120) {
    r.warnings.push({
      level: 'warn',
      text: 'Unghiul de înfășurare pe roata mică e sub 120°. Mărește distanța sau folosește un întinzător.',
    });
  }

  return r;
}
