// UI, drawing and animation. Plain script, uses globalThis.Belt from belt.js.

(function () {
  const { solve, beltLoop } = globalThis.Belt;
  const $ = (s) => document.querySelector(s);
  const VB = { w: 1000, h: 480 };
  const TAU = Math.PI * 2;

  const state = { D1: 20, D2: 40, C: 100 };
  let result = null;
  let fit = null;
  let frozenFit = null;
  let drag = null;
  let scene = null;
  let offset = 0;
  let lastTime = 0;
  const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');
  const toDeg = (r) => (r * 180) / Math.PI;
  const P = (x, y) => `${x.toFixed(3)} ${y.toFixed(3)}`;

  /* ---------- state in the URL ---------- */

  function loadState() {
    const q = new URLSearchParams(location.hash.slice(1));
    for (const k of ['D1', 'D2', 'C']) {
      const v = parseFloat(q.get(k.toLowerCase()));
      if (Number.isFinite(v) && v > 0) state[k] = v;
    }
  }

  function saveState() {
    const q = new URLSearchParams({ d1: state.D1, d2: state.D2, c: +state.C.toFixed(2) });
    try { history.replaceState(null, '', '#' + q); } catch (e) { /* file:// in some browsers */ }
  }

  /* ---------- inputs ---------- */

  function initInputs() {
    for (const id of ['D1', 'D2', 'C']) {
      const input = $('#' + id);
      input.value = state[id];
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        const ok = Number.isFinite(v) && v > 0;
        input.parentElement.classList.toggle('invalid', !ok);
        if (!ok) return;
        state[id] = v;
        update();
      });
    }
  }

  /* ---------- update ---------- */

  function update() {
    result = solve(state.D1, state.D2, state.C);
    renderStage();
    renderResults();
    renderWarnings();
    renderFormula();
    saveState();
  }

  /* ---------- drawing ---------- */

  function sizeStage() {
    const narrow = $('#stage').getBoundingClientRect().width < 640;
    $('#stage').classList.toggle('narrow', narrow);
    const w = narrow ? 620 : 1000;
    const h = narrow ? 440 : 480;
    if (w === VB.w) return false;
    VB.w = w;
    VB.h = h;
    $('#stage').setAttribute('viewBox', `0 0 ${w} ${h}`);
    $('#stage-bg').setAttribute('width', w);
    $('#stage-bg').setAttribute('height', h);
    return true;
  }

  function computeFit(xmin, xmax, rmax) {
    const padX = 60, top = 60, bottom = 70;
    const sc = Math.min((VB.w - 2 * padX) / (xmax - xmin), (VB.h - top - bottom) / (2 * rmax));
    return { sc, ox: VB.w / 2 - ((xmin + xmax) / 2) * sc, oy: top + (VB.h - top - bottom) / 2 };
  }

  // Pulley drawn at radius r, with hub, D-shaped bore and lightening holes on larger pulleys.
  function pulleyMarkup(id, r) {
    const rim = r * 0.9;
    const bore = Math.max(1.4, Math.min(4, rim * 0.2));
    const hub = Math.max(bore * 2.1, rim * 0.42);
    let d = `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 Z`;

    const f = bore * 0.78;
    const fy = bore * Math.sin(Math.acos(f / bore));
    d += ` M ${P(f, -fy)} A ${bore} ${bore} 0 1 0 ${P(f, fy)} Z`;

    const rin = hub + 0.12 * rim;
    const rout = rim - 0.1 * rim - 1;
    const holes = rout - rin > 3.5 ? (rim > 40 ? 6 : 5) : 0;
    const web = Math.max(0.16, 2.2 / ((rin + rout) / 2));
    const pt = (rr, a) => P(rr * Math.cos(a), rr * Math.sin(a));
    for (let k = 0; k < holes; k++) {
      const a0 = (TAU * k) / holes + web / 2;
      const a1 = (TAU * (k + 1)) / holes - web / 2;
      d += ` M ${pt(rout, a0)} A ${rout} ${rout} 0 0 1 ${pt(rout, a1)}`;
      d += ` L ${pt(rin, a1)} A ${rin} ${rin} 0 0 0 ${pt(rin, a0)} Z`;
    }

    return `<g id="${id}">
      <path class="pulley-body" vector-effect="non-scaling-stroke" d="${d}"/>
      <circle class="pulley-hub" vector-effect="non-scaling-stroke" r="${hub}"/>
      ${holes ? '' : `<circle class="pulley-ring" vector-effect="non-scaling-stroke" r="${(rim * 0.82).toFixed(3)}"/>`}
      <circle class="pulley-screw" cy="${((hub + bore) / 2).toFixed(3)}" r="${Math.max(0.5, bore * 0.35).toFixed(3)}"/>
    </g>`;
  }

  function loopPath(C, r1, r2) {
    const L = beltLoop(C, r1, r2);
    return `M ${P(...L.A1)} L ${P(...L.B1)} ` +
      `A ${r2} ${r2} 0 ${L.w2 > Math.PI ? 1 : 0} 0 ${P(...L.B2)} ` +
      `L ${P(...L.A2)} ` +
      `A ${r1} ${r1} 0 ${L.w1 > Math.PI ? 1 : 0} 0 ${P(...L.A1)} Z`;
  }

  function renderStage() {
    const r = result;
    const world = $('#world');
    const annot = $('#annot');
    const msg = $('#stage-msg');

    if (!r.valid) {
      world.innerHTML = '';
      annot.innerHTML = '';
      scene = null;
      msg.hidden = false;
      msg.textContent = r.warnings[0].text;
      return;
    }
    msg.hidden = true;

    const r1 = r.D1 / 2;
    const r2 = r.D2 / 2;
    const C = r.C;
    const t = Math.max(1.5, 0.06 * Math.min(r1, r2));
    const rmax = Math.max(r1, r2) + t;

    fit = frozenFit || computeFit(-(r1 + t), C + r2 + t, rmax);
    const { sc, ox, oy } = fit;
    const bodyW = Math.max(t, 2.6 / sc);

    world.setAttribute('transform', `translate(${ox} ${oy}) scale(${sc} ${-sc})`);
    world.innerHTML = `
      <g>${pulleyMarkup('rot1', r1)}</g>
      <g id="p2" transform="translate(${C} 0)">${pulleyMarkup('rot2', r2)}</g>
      <path class="belt-body" d="${loopPath(C, r1 + bodyW / 2, r2 + bodyW / 2)}" stroke-width="${bodyW}"/>
      <path class="belt-mark" id="belt-marks" vector-effect="non-scaling-stroke"/>`;

    const loop = beltLoop(C, r1, r2);
    scene = {
      r1, r2, loop, bodyW,
      marks: Math.max(4, Math.round(loop.L / (60 / sc))),
      rot1: $('#rot1'),
      rot2: $('#rot2'),
      markPath: $('#belt-marks'),
    };
    drawDynamic();

    const x1 = ox;
    const x2 = ox + C * sc;
    const narrow = VB.w < 1000;
    const fontPx = narrow ? 21 : 15;
    const yDim = oy + rmax * sc + (narrow ? 44 : 38);
    const yTop = oy - rmax * sc - (narrow ? 22 : 18);
    const dimText = `C = ${fmt(C)} mm`;
    const gap = dimText.length * fontPx * 0.62 + 16;
    const showLine = x2 - x1 > gap + 40;
    const mid = (x1 + x2) / 2;
    const cross = (x, s = 9) => `<path class="center-mark" d="M${x - s} ${oy}H${x + s}M${x} ${oy - s}V${oy + s}"/>`;

    annot.innerHTML = `
      ${cross(x1)}${cross(x2)}
      <text class="svg-label" x="${x1}" y="${yTop}" text-anchor="middle">Ø${fmt(r.D1)}</text>
      <text class="svg-label" x="${x2}" y="${yTop}" text-anchor="middle">Ø${fmt(r.D2)}</text>
      <path class="dim-ext" d="M${x1} ${oy + r1 * sc + 8}V${yDim + 8}M${x2} ${oy + r2 * sc + 8}V${yDim + 8}"/>
      ${showLine ? `<path class="dim-line" d="M${x1 + 1} ${yDim}H${mid - gap / 2}" marker-start="url(#arrow)"/>
        <path class="dim-line" d="M${mid + gap / 2} ${yDim}H${x2 - 1}" marker-end="url(#arrow)"/>` : ''}
      <text class="svg-label dim" x="${mid}" y="${yDim + (showLine ? 5 : 24)}" text-anchor="middle">${dimText}</text>`;
  }

  function drawDynamic() {
    const s = scene;
    if (!s) return;
    const deg = (rad) => ((rad * 180) / Math.PI).toFixed(3);
    s.rot1.setAttribute('transform', `rotate(${deg(-offset / s.r1)})`);
    s.rot2.setAttribute('transform', `rotate(${deg(-offset / s.r2)})`);

    // short marks across the belt so the motion is visible
    const L = s.loop;
    const step = L.L / s.marks;
    const a = s.bodyW * 0.25;
    const b = s.bodyW * 0.75;
    let d = '';
    for (let k = 0; k < s.marks; k++) {
      const q = L.at(k * step + offset);
      d += `M${P(q.x - q.nx * a, q.y - q.ny * a)}L${P(q.x - q.nx * b, q.y - q.ny * b)}`;
    }
    s.markPath.setAttribute('d', d);
  }

  function frame(now) {
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    if (animate && fit && scene) {
      offset = (offset + (55 / fit.sc) * dt) % (scene.loop.L * 1000);
      drawDynamic();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- dragging ---------- */

  function initDrag() {
    const svg = $('#stage');
    const toVB = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };

    svg.addEventListener('pointerdown', (e) => {
      if (!fit || !result || !result.valid) return;
      const pt = toVB(e);
      const wx = (pt.x - fit.ox) / fit.sc;
      const wy = (fit.oy - pt.y) / fit.sc;
      if (Math.hypot(wx - result.C, wy) > result.D2 / 2 + 3 / fit.sc) return;
      e.preventDefault();
      drag = { x0: pt.x, C0: state.C };
      frozenFit = { ...fit };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add('dragging');
    });

    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const { sc, ox } = frozenFit;
      const maxC = (VB.w - 12 - ox) / sc - state.D2 / 2;
      const minC = Math.abs(state.D2 - state.D1) / 2 + 0.5;
      const C = drag.C0 + (toVB(e).x - drag.x0) / sc;
      state.C = Math.round(Math.min(maxC, Math.max(minC, C)) * 10) / 10;
      $('#C').value = state.C;
      $('#C').parentElement.classList.remove('invalid');
      update();
    });

    const end = () => {
      if (!drag) return;
      drag = null;
      frozenFit = null;
      svg.classList.remove('dragging');
      update();
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }

  /* ---------- results ---------- */

  function card(k, v, unit, sub, cls = '') {
    return `<div class="card ${cls}">
      <span class="k">${k}</span>
      <span class="v">${v}${unit ? `<small>${unit}</small>` : ''}</span>
      ${sub ? `<span class="s">${sub}</span>` : ''}
    </div>`;
  }

  function renderResults() {
    const r = result;
    if (!r.valid) {
      $('#results').innerHTML = '';
      return;
    }
    $('#results').innerHTML = [
      card('Belt length', fmt(r.L), 'mm', `approximate formula: <b>${fmt(r.Lapprox)}</b> mm`, 'primary'),
      card('Ratio', `1 : ${fmt(r.ratio)}`, '', `D₂ / D₁`),
      card('Wrap, small pulley', fmt(toDeg(r.wrapSmall), 1), '°', `large: <b>${fmt(toDeg(r.wrapLarge), 1)}</b>°`),
      card('Free span', fmt(r.span), 'mm', 'between tangent points'),
    ].join('');
  }

  function renderWarnings() {
    $('#warnings').innerHTML = (result.valid ? result.warnings : [])
      .map((w) => `<div class="warning ${w.level}">${w.text}</div>`)
      .join('');
  }

  /* ---------- formula ---------- */

  function renderFormula() {
    const r = result;
    const host = $('#formula');
    if (!r.valid) {
      host.innerHTML = '';
      return;
    }
    const t = (n, d = 2) => n.toFixed(d);
    const exact =
      `\\begin{aligned}` +
      `\\varphi &= \\arcsin\\frac{D_2 - D_1}{2C} \\\\[4pt] &= \\arcsin\\frac{${t(r.D2)} - ${t(r.D1)}}{2\\cdot ${t(r.C)}} = ${t(r.phi, 4)}\\ \\text{rad} \\\\[6pt]` +
      `L &= 2C\\cos\\varphi + \\frac{\\pi\\,(D_1 + D_2)}{2} + \\varphi\\,(D_2 - D_1) \\\\[4pt]` +
      `&= ${t(2 * r.span)} + ${t((Math.PI * (r.D1 + r.D2)) / 2)} + ${t(r.phi * (r.D2 - r.D1))} = \\mathbf{${t(r.L)}}\\,\\text{mm}` +
      `\\end{aligned}`;
    const approx =
      `L \\approx 2C + \\frac{\\pi\\,(D_1 + D_2)}{2} + \\frac{(D_2 - D_1)^2}{4C} = ${t(r.Lapprox)}\\,\\text{mm}`;

    host.innerHTML = '<div class="m"></div><div class="m"></div>';
    const [a, b] = host.querySelectorAll('.m');
    if (window.katex) {
      katex.render(exact, a, { displayMode: true, throwOnError: false });
      katex.render(approx, b, { displayMode: true, throwOnError: false });
    } else {
      a.innerHTML = `<code>L = 2C·cos φ + π(D₁+D₂)/2 + φ(D₂−D₁) = ${fmt(r.L)} mm</code>`;
      b.innerHTML = `<code>L ≈ 2C + π(D₁+D₂)/2 + (D₂−D₁)²/(4C) = ${fmt(r.Lapprox)} mm</code>`;
    }
  }

  /* ---------- startup ---------- */

  loadState();
  initInputs();
  initDrag();
  sizeStage();
  update();
  requestAnimationFrame(frame);
  addEventListener('resize', () => sizeStage() && update());
  // KaTeX comes from a CDN; if it loads after us, re-render the formula
  if (!window.katex) addEventListener('load', () => window.katex && renderFormula());
})();
