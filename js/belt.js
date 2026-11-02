// Math for an open belt drive between two pulleys.
// All lengths are in mm, all angles in radians.
// Plain script (no modules), so the page also works when opened directly from disk.
// It sets globalThis.Belt, which the page and the Node tests both use.

(function () {
  /**
   * Wrap geometry for center distance C and pitch diameters D1, D2.
   * phi is signed: positive when pulley 2 is larger than pulley 1.
   * Returns null if the geometry is impossible.
   */
  function wrap(C, D1, D2) {
    const d = D2 - D1;
    if (!(C > 0) || !(Math.abs(d) < 2 * C)) return null;
    const phi = Math.asin(d / (2 * C));
    return {
      phi,
      span: C * Math.cos(phi),        // length of one straight span
      wrap1: Math.PI - 2 * phi,       // wrap angle on pulley 1
      wrap2: Math.PI + 2 * phi,       // wrap angle on pulley 2
    };
  }

  /** Exact belt length. */
  function beltLength(C, D1, D2) {
    const g = wrap(C, D1, D2);
    if (!g) return NaN;
    return 2 * g.span + (Math.PI * (D1 + D2)) / 2 + g.phi * (D2 - D1);
  }

  /** Approximate length: L ≈ 2C + π(D1+D2)/2 + (D2−D1)²/(4C) */
  function beltLengthApprox(C, D1, D2) {
    if (!(C > 0)) return NaN;
    return 2 * C + (Math.PI * (D1 + D2)) / 2 + (D2 - D1) ** 2 / (4 * C);
  }

  /**
   * Belt path along the pitch line, for drawing and animation.
   * Pulley 1 is at (0, 0), pulley 2 at (C, 0); y points up.
   * The belt runs clockwise: upper span → arc on pulley 2 → lower span → arc on pulley 1.
   */
  function beltLoop(C, r1, r2) {
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

    // Point at path distance s: position and inward normal.
    function at(s) {
      s = ((s % L) + L) % L;
      if (s < s0) {
        const t = s / span;
        return { x: A1[0] + t * (B1[0] - A1[0]), y: A1[1] + t * (B1[1] - A1[1]), nx: -ca, ny: -sa };
      }
      if (s < s1) {
        const ang = a - (s - s0) / r2;
        return { x: C + r2 * Math.cos(ang), y: r2 * Math.sin(ang), nx: -Math.cos(ang), ny: -Math.sin(ang) };
      }
      if (s < s2) {
        const t = (s - s1) / span;
        return { x: B2[0] + t * (A2[0] - B2[0]), y: B2[1] + t * (A2[1] - B2[1]), nx: -ca, ny: sa };
      }
      const ang = -a - (s - s2) / r1;
      return { x: r1 * Math.cos(ang), y: r1 * Math.sin(ang), nx: -Math.cos(ang), ny: -Math.sin(ang) };
    }

    return { L, span, phi, w1, w2, s0, s1, s2, A1, B1, B2, A2, at };
  }

  /** Full calculation for pitch diameters D1, D2 and center distance C. */
  function solve(D1, D2, C) {
    const r = { D1, D2, C, warnings: [], valid: true };

    if (!(D1 > 0) || !(D2 > 0) || !(C > 0)) {
      r.valid = false;
      r.warnings.push({ level: 'error', text: 'Enter positive values for both diameters and the distance.' });
      return r;
    }

    r.L = beltLength(C, D1, D2);
    r.Lapprox = beltLengthApprox(C, D1, D2);

    if (!Number.isFinite(r.L)) {
      r.valid = false;
      r.warnings.push({ level: 'error', text: 'The distance is too small for these pulleys: the belt cannot wrap around them.' });
      return r;
    }

    const g = wrap(C, D1, D2);
    r.phi = g.phi;
    r.span = g.span;
    r.ratio = D2 / D1;
    r.wrapSmall = Math.PI - 2 * Math.abs(g.phi);
    r.wrapLarge = Math.PI + 2 * Math.abs(g.phi);

    if (C < (D1 + D2) / 2) {
      r.warnings.push({ level: 'error', text: 'The pulleys overlap at this distance.' });
    }
    if ((r.wrapSmall * 180) / Math.PI < 120) {
      r.warnings.push({ level: 'warn', text: 'Wrap angle on the small pulley is below 120°, so the belt may slip.' });
    }
    return r;
  }

  globalThis.Belt = { wrap, beltLength, beltLengthApprox, beltLoop, solve };
})();
