import { PROFILES, solve, beltLoop } from './belt.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const VB = { w: 1000, h: 560 };

function sizeStage() {
  const narrow = $('#stage').getBoundingClientRect().width < 640;
  const w = narrow ? 620 : 1000;
  const h = narrow ? 470 : 560;
  $('#stage').classList.toggle('narrow', narrow);
  if (w === VB.w) return false;
  VB.w = w;
  VB.h = h;
  $('#stage').setAttribute('viewBox', `0 0 ${w} ${h}`);
  $('#stage-bg').setAttribute('width', w);
  $('#stage-bg').setAttribute('height', h);
  return true;
}
const TAU = Math.PI * 2;

const DEFAULTS = {
  mode: 'timing',
  profile: 'gt2-2',
  pitch: 2,
  z1: 20,
  z2: 40,
  D1: 40,
  D2: 80,
  C: 100,
  teeth: 'near', // 'near' | 'down' | 'up' | number
};

const state = loadState();
let result = null;
let fit = null;
let frozenFit = null;
let drag = null;
let scene = null;
let offset = 0;
let lastTime = 0;
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- formatting ---------- */

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const texP = (n) => String(+n.toFixed(3));
const tex = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '?');
const toDeg = (r) => (r * 180) / Math.PI;
const signed = (n, d = 2) => (n > 0.004 ? '+' : n < -0.004 ? '−' : '±') + fmt(Math.abs(n), d);
const profile = () => PROFILES.find((p) => p.id === state.profile) || PROFILES[0];

/* ---------- state in the URL ---------- */

function loadState() {
  const s = { ...DEFAULTS };
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (k) => {
    const v = parseFloat(q.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  if (q.get('m') === 'd') s.mode = 'diameter';
  if (PROFILES.some((p) => p.id === q.get('p'))) s.profile = q.get('p');
  const map = { pitch: 'pitch', z1: 'z1', z2: 'z2', d1: 'D1', d2: 'D2', c: 'C' };
  for (const [k, key] of Object.entries(map)) {
    const v = num(k);
    if (v !== undefined) s[key] = v;
  }
  s.z1 = Math.round(s.z1);
  s.z2 = Math.round(s.z2);
  const n = q.get('n');
  if (n === 'down' || n === 'up') s.teeth = n;
  else if (num('n')) s.teeth = Math.round(num('n'));
  const prof = PROFILES.find((p) => p.id === s.profile);
  if (prof.pitch) s.pitch = prof.pitch;
  return s;
}

function saveState() {
  const q = new URLSearchParams();
  if (state.mode === 'diameter') {
    q.set('m', 'd');
    q.set('d1', state.D1);
    q.set('d2', state.D2);
  } else {
    q.set('p', state.profile);
    if (state.profile === 'custom') q.set('pitch', state.pitch);
    q.set('z1', state.z1);
    q.set('z2', state.z2);
    if (state.teeth !== 'near') q.set('n', state.teeth);
  }
  q.set('c', +state.C.toFixed(2));
  history.replaceState(null, '', '#' + q.toString());
}

/* ---------- controls ---------- */

function initControls() {
  $('#profile').innerHTML = PROFILES.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');

  $$('#mode button').forEach((b) =>
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      syncInputs();
      update();
    }),
  );

  $('#profile').addEventListener('change', (e) => {
    state.profile = e.target.value;
    if (profile().pitch) state.pitch = profile().pitch;
    resetManualTeeth();
    syncInputs();
    update();
  });

  bindNumber('pitch', { min: 0.1, resetTeeth: true });
  bindNumber('z1', { min: 6, int: true, resetTeeth: true });
  bindNumber('z2', { min: 6, int: true, resetTeeth: true });
  bindNumber('D1', { min: 0.5 });
  bindNumber('D2', { min: 0.5 });
  bindNumber('C', { min: 1, resetTeeth: true, after: () => ($('#C-range').value = state.C) });

  $('#C-range').addEventListener('input', (e) => {
    state.C = +e.target.value;
    resetManualTeeth();
    $('#C').value = state.C;
    update();
  });

  $('#teeth').addEventListener('input', (e) => {
    const v = Math.round(parseFloat(e.target.value));
    if (Number.isFinite(v) && v >= 10) {
      state.teeth = v;
      update();
    }
  });

  $$('#round button').forEach((b) =>
    b.addEventListener('click', () => {
      state.teeth = b.dataset.round;
      update();
    }),
  );

  $$('[data-step]').forEach((b) =>
    b.addEventListener('click', () => {
      const input = $('#' + b.dataset.for);
      const v = (parseFloat(input.value) || 0) + Number(b.dataset.step);
      input.value = Math.max(Number(input.min) || 0, v);
      input.dispatchEvent(new Event('input'));
    }),
  );

  $('#play').addEventListener('click', () => setPlaying(!playing));
  setPlaying(playing);

  $('#share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied');
    } catch {
      toast('Copy the address from the browser bar');
    }
  });

  $('#theme').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  });

  initDrag();
}

function bindNumber(id, { min = 0, int = false, resetTeeth = false, after } = {}) {
  const input = $('#' + id);
  input.addEventListener('input', () => {
    let v = parseFloat(input.value);
    const ok = Number.isFinite(v) && v >= min;
    input.parentElement.classList.toggle('invalid', !ok);
    if (!ok) return;
    if (int) v = Math.round(v);
    state[id] = v;
    if (resetTeeth) resetManualTeeth();
    after?.();
    update();
  });
}

function resetManualTeeth() {
  if (typeof state.teeth === 'number') state.teeth = 'near';
}

function syncInputs() {
  const timing = state.mode === 'timing';
  $$('#mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
  $$('[data-show]').forEach((el) => (el.hidden = el.dataset.show !== state.mode));
  $('#profile').value = state.profile;
  $('#pitch').value = state.pitch;
  $('#pitch').disabled = profile().id !== 'custom';
  $('#z1').value = state.z1;
  $('#z2').value = state.z2;
  $('#D1').value = state.D1;
  $('#D2').value = state.D2;
  $('#C').value = state.C;
  $('#C-range').value = state.C;
  $$('.num.invalid').forEach((el) => el.classList.remove('invalid'));
  if (!timing) $('#teeth').value = '';
}

function setPlaying(on) {
  playing = on;
  const b = $('#play');
  b.setAttribute('aria-pressed', String(on));
  b.querySelector('span').textContent = on ? 'Pause' : 'Play';
}

function toast(text) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1600);
}

/* ---------- update ---------- */

function update() {
  const timing = state.mode === 'timing';
  result = solve({
    mode: state.mode,
    C: state.C,
    pitch: state.pitch,
    pld: timing ? profile().pld : 0,
    z1: state.z1,
    z2: state.z2,
    D1: state.D1,
    D2: state.D2,
    teeth: state.teeth,
  });

  if (timing) {
    if (document.activeElement !== $('#teeth') && result.teeth) $('#teeth').value = result.teeth;
    const rule = typeof state.teeth === 'number' ? 'manual' : state.teeth;
    $$('#round button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.round === rule)));
  }

  renderStage();
  renderResults();
  renderWarnings();
  renderFormulas();
  saveState();
}

/* ---------- drawing ---------- */

const svgPt = (x, y) => `${x.toFixed(3)} ${y.toFixed(3)}`;

function computeFit(xmin, xmax, rmax) {
  const padX = 64;
  const top = 64;
  const bottom = 92;
  const sc = Math.min((VB.w - 2 * padX) / (xmax - xmin), (VB.h - top - bottom) / (2 * rmax));
  return {
    sc,
    ox: VB.w / 2 - ((xmin + xmax) / 2) * sc,
    oy: top + (VB.h - top - bottom) / 2,
  };
}

// Pulley outline centered at the origin. Toothed pulleys get grooves for the belt teeth.
function pulleyOutline(ro, z, p) {
  if (!z) {
    return `M ${ro} 0 A ${ro} ${ro} 0 1 1 ${-ro} 0 A ${ro} ${ro} 0 1 1 ${ro} 0 Z`;
  }
  const h = 0.38 * p;
  const ri = ro - h;
  const wo = (0.3 * p) / ro;
  const wi = (0.19 * p) / ri;
  const P = (r, a) => svgPt(r * Math.cos(a), r * Math.sin(a));
  let d = `M ${P(ro, wo)}`;
  for (let j = 1; j <= z; j++) {
    const c = (TAU * j) / z;
    d += ` A ${ro} ${ro} 0 0 1 ${P(ro, c - wo)}`;
    d += ` L ${P(ri, c - wi)} L ${P(ri, c + wi)} L ${P(ro, c + wo)}`;
  }
  return d + ' Z';
}

// Hub, bore and lightening holes (drawn as cutouts with fill-rule evenodd).
function pulleyCutouts(rRim, pd) {
  const bore = Math.max(1.4, Math.min(4, rRim * 0.2));
  const hub = Math.max(bore * 2.1, rRim * 0.42);
  let d = '';
  // D-shaped bore
  const f = bore * 0.78;
  const fa = Math.acos(f / bore);
  d += ` M ${svgPt(f, -bore * Math.sin(fa))}`;
  d += ` A ${bore} ${bore} 0 1 0 ${svgPt(f, bore * Math.sin(fa))} Z`;

  let holes = 0;
  const rin = hub + 0.12 * rRim;
  const rout = rRim - 0.1 * rRim - 1;
  if (rout - rin > 3.5) {
    holes = rRim > 40 ? 6 : 5;
    const web = Math.max(0.16, 2.2 / ((rin + rout) / 2));
    for (let k = 0; k < holes; k++) {
      const a0 = (TAU * k) / holes + web / 2;
      const a1 = (TAU * (k + 1)) / holes - web / 2;
      const P = (r, a) => svgPt(r * Math.cos(a), r * Math.sin(a));
      d += ` M ${P(rout, a0)} A ${rout} ${rout} 0 0 1 ${P(rout, a1)}`;
      d += ` L ${P(rin, a1)} A ${rin} ${rin} 0 0 0 ${P(rin, a0)} Z`;
    }
  }
  return { d, hub, bore, holes, pd };
}

function pulleyMarkup(id, ro, z, p, pd) {
  const rRim = z ? ro - 0.38 * p : ro;
  const cut = pulleyCutouts(rRim * 0.9, pd);
  const outline = pulleyOutline(ro, z, p);
  const screwAt = (cut.hub + cut.bore) / 2;
  return `
    <g class="rot" id="${id}">
      <path class="pulley-body" vector-effect="non-scaling-stroke" d="${outline}${cut.d}"/>
      <circle class="pulley-hub" vector-effect="non-scaling-stroke" r="${cut.hub}"/>
      ${cut.holes ? '' : `<circle class="pulley-ring" vector-effect="non-scaling-stroke" r="${(rRim * 0.82).toFixed(3)}"/>`}
      <circle class="pulley-screw" cx="0" cy="${screwAt.toFixed(3)}" r="${Math.max(0.5, cut.bore * 0.35).toFixed(3)}"/>
    </g>`;
}

function loopPath(C, r1, r2) {
  const L = beltLoop(C, r1, r2);
  const large2 = L.w2 > Math.PI ? 1 : 0;
  const large1 = L.w1 > Math.PI ? 1 : 0;
  return (
    `M ${svgPt(...L.A1)} L ${svgPt(...L.B1)} ` +
    `A ${r2} ${r2} 0 ${large2} 0 ${svgPt(...L.B2)} ` +
    `L ${svgPt(...L.A2)} ` +
    `A ${r1} ${r1} 0 ${large1} 0 ${svgPt(...L.A1)} Z`
  );
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
    msg.textContent = r.warnings[0]?.text || 'Invalid input.';
    return;
  }
  msg.hidden = true;

  const timing = r.mode === 'timing';
  const p = timing ? r.p : 0;
  const r1 = r.D1 / 2;
  const r2 = r.D2 / 2;
  const ro1 = r.OD1 / 2;
  const ro2 = r.OD2 / 2;
  const C = r.Cactual;
  const Cd = state.C;

  // belt thickness in mm, with a minimum visible size on screen
  const back = timing ? 0.32 * p : Math.max(1.5, 0.06 * Math.min(r1, r2));
  const toothH = timing ? 0.38 * p : 0;
  const rmax = Math.max(r1, r2) + back;

  fit = frozenFit || computeFit(-(r1 + back), Math.max(C, Cd) + r2 + back, rmax);
  const { sc, ox, oy } = fit;
  const minPx = 2.6 / sc;
  const bodyW = Math.max(back, minPx);
  const bodyOff = timing ? -r.pld + bodyW / 2 : bodyW / 2;

  const showTeeth = timing && p * sc >= 3.2;
  const ghost = timing && Math.abs(Cd - C) > 0.01;

  world.setAttribute('transform', `translate(${ox} ${oy}) scale(${sc} ${-sc})`);
  world.innerHTML = `
    <g id="p1">${pulleyMarkup('rot1', ro1, timing ? r.z1 : 0, p, r.D1)}</g>
    <g id="p2" class="draggable" transform="translate(${C} 0)">${pulleyMarkup('rot2', ro2, timing ? r.z2 : 0, p, r.D2)}</g>
    ${ghost ? `<circle id="ghost" class="ghost draggable" vector-effect="non-scaling-stroke" cx="${Cd}" cy="0" r="${ro2}"/>` : ''}
    <path class="belt-body" d="${loopPath(C, r1 + bodyOff, r2 + bodyOff)}" stroke-width="${bodyW}"/>
    <path class="belt-teeth" id="belt-teeth" vector-effect="non-scaling-stroke"/>
    <path class="belt-mark" id="belt-marks" vector-effect="non-scaling-stroke"/>
  `;

  const loop = beltLoop(C, r1, r2);
  // spacing of the motion marks: a whole number of marks around the belt
  const markCount = Math.max(1, Math.round(loop.L / (64 / sc)));
  scene = {
    timing, p, r1, r2, loop, showTeeth, toothH,
    pld: r.pld,
    N: timing ? r.teeth : 0,
    marks: markCount,
    bodyW,
    // pulley phases, so the grooves line up exactly with the belt teeth
    c1: timing ? -loop.a + loop.s2 / r1 : 0,
    c2: timing ? loop.a + loop.s0 / r2 : 0,
    rot1: $('#rot1'),
    rot2: $('#rot2'),
    teeth: $('#belt-teeth'),
    markPath: $('#belt-marks'),
  };
  drawDynamic();

  // annotations, in screen coordinates
  const S = (x, y) => [ox + x * sc, oy - y * sc];
  const [x1, cy] = S(0, 0);
  const [x2] = S(C, 0);
  const [xd] = S(Cd, 0);
  const yDim = oy + rmax * sc + 40;
  const yTop = oy - rmax * sc - (VB.w < 1000 ? 22 : 18);
  const cross = (x, y, s = 9) =>
    `<path class="center-mark" d="M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}"/>`;

  const lab1 = timing ? `${r.z1}T · Ø${fmt(r.D1)}` : `Ø${fmt(r.D1)}`;
  const lab2 = timing ? `${r.z2}T · Ø${fmt(r.D2)}` : `Ø${fmt(r.D2)}`;
  const dimText = `C = ${fmt(C)} mm`;
  const fontPx = VB.w < 1000 ? 21 : 15;
  const showGap = x2 - x1 > dimText.length * fontPx * 0.62 + 60;
  const dimLine = (a, b, y, gap) => {
    const m = (a + b) / 2;
    return `<path class="dim-line" d="M${a + 1} ${y}H${m - gap / 2}" marker-start="url(#arrow)"/>` +
      `<path class="dim-line" d="M${m + gap / 2} ${y}H${b - 1}" marker-end="url(#arrow)"/>`;
  };

  annot.innerHTML = `
    ${cross(x1, cy)}${cross(x2, cy)}
    <text class="svg-label" x="${x1}" y="${yTop}" text-anchor="middle">${lab1}</text>
    <text class="svg-label" x="${x2}" y="${yTop}" text-anchor="middle">${lab2}</text>
    <path class="dim-ext" d="M${x1} ${cy + ro1 * sc + 8}V${yDim + 8}M${x2} ${cy + ro2 * sc + 8}V${yDim + 8}"/>
    ${showGap ? dimLine(x1, x2, yDim, dimText.length * fontPx * 0.62 + 16) : ''}
    <text class="svg-label dim" x="${(x1 + x2) / 2}" y="${yDim + (showGap ? 5 : 22)}" text-anchor="middle">${dimText}</text>
    ${ghost ? `<text class="svg-label small" x="${(x1 + x2) / 2}" y="${yDim + (showGap ? 1.9 : 3) * fontPx}" text-anchor="middle">target ${fmt(Cd)} mm · ${signed(r.delta)} mm</text>` : ''}
    ${ghost && Math.abs(xd - x2) > 14 ? cross(xd, cy, 5) : ''}
  `;
}

function drawDynamic() {
  const s = scene;
  if (!s) return;
  const deg = (rad) => (rad * 180) / Math.PI;
  s.rot1.setAttribute('transform', `rotate(${deg(s.c1 - offset / s.r1).toFixed(3)})`);
  s.rot2.setAttribute('transform', `rotate(${deg(s.c2 - offset / s.r2).toFixed(3)})`);

  const L = s.loop;
  if (s.showTeeth) {
    let d = '';
    const w0 = 0.29 * s.p;
    const w1 = 0.18 * s.p;
    for (let k = 0; k < s.N; k++) {
      const q = L.at(k * s.p + offset);
      const bx = q.x + q.nx * s.pld;
      const by = q.y + q.ny * s.pld;
      const tx = bx + q.nx * s.toothH;
      const ty = by + q.ny * s.toothH;
      d +=
        `M${svgPt(bx - q.tx * w0, by - q.ty * w0)}` +
        `L${svgPt(tx - q.tx * w1, ty - q.ty * w1)}` +
        `L${svgPt(tx + q.tx * w1, ty + q.ty * w1)}` +
        `L${svgPt(bx + q.tx * w0, by + q.ty * w0)}Z`;
    }
    s.teeth.setAttribute('d', d);
  } else {
    s.teeth.setAttribute('d', '');
  }

  // marks on the back of the belt so the motion is visible
  const step = L.L / s.marks;
  const inner = s.timing ? -s.pld : 0;
  const outer = inner + s.bodyW;
  let m = '';
  for (let k = 0; k < s.marks; k++) {
    const q = L.at(k * step + offset);
    m +=
      `M${svgPt(q.x - q.nx * (inner + s.bodyW * 0.25), q.y - q.ny * (inner + s.bodyW * 0.25))}` +
      `L${svgPt(q.x - q.nx * (outer - s.bodyW * 0.25), q.y - q.ny * (outer - s.bodyW * 0.25))}`;
  }
  s.markPath.setAttribute('d', m);
}

function frame(now) {
  const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
  lastTime = now;
  if (playing && fit && scene) {
    offset = (offset + (60 / fit.sc) * dt) % (scene.loop.L * 1000);
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
    if (!fit || !result?.valid) return;
    // geometric hit test: anywhere inside pulley 2 (or the target outline)
    const pt = toVB(e);
    const wx = (pt.x - fit.ox) / fit.sc;
    const wy = (fit.oy - pt.y) / fit.sc;
    const R = result.D2 / 2 + 2 / fit.sc;
    const hit = (cx) => Math.hypot(wx - cx, wy) <= R;
    if (!hit(result.Cactual) && !hit(state.C)) return;
    e.preventDefault();
    drag = { x0: toVB(e).x, C0: state.C };
    frozenFit = { ...fit };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('dragging');
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { sc, ox } = frozenFit;
    const rMax = Math.max(result.D1, result.D2) / 2;
    const maxC = (VB.w - 12 - ox) / sc - rMax;
    const minC = Math.abs(result.D2 - result.D1) / 2 + 0.5;
    let C = drag.C0 + (toVB(e).x - drag.x0) / sc;
    C = Math.min(maxC, Math.max(minC, C));
    state.C = Math.round(C * 10) / 10;
    resetManualTeeth();
    $('#C').value = state.C;
    $('#C-range').value = state.C;
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
  const el = $('#results');
  if (!r.valid) {
    el.innerHTML = '';
    return;
  }
  const timing = r.mode === 'timing';
  const cards = [];

  cards.push(card('Calculated belt length', fmt(r.L), 'mm', `approximate <b>${fmt(r.Lapprox)}</b> mm`, 'primary'));

  if (timing) {
    cards.push(card('Selected belt', `${r.teeth}`, 'teeth',
      `<b>${fmt(r.Lbelt, 1)}</b> mm · calculated <b>${fmt(r.teethExact)}</b>`));
    cards.push(card('Actual center distance', fmt(r.Cactual), 'mm',
      Math.abs(r.delta) < 0.005 ? 'same as target' : `<b>${signed(r.delta)}</b> mm from target`));
  }

  cards.push(card('Drive ratio', `1 : ${fmt(r.ratio)}`, '',
    timing ? `${r.z1}T → ${r.z2}T` : `Ø${fmt(r.D1, 1)} → Ø${fmt(r.D2, 1)}`));

  cards.push(card('Wrap on small pulley', fmt(toDeg(r.wrapSmall), 1), '°',
    timing ? `<b>${fmt(r.meshTeeth, 1)}</b> teeth in mesh` : `large pulley: <b>${fmt(toDeg(r.wrapLarge), 1)}</b>°`));

  cards.push(card('Free span', fmt(r.span), 'mm', 'between tangent points'));

  if (timing) {
    cards.push(card('Pitch diameters', `${fmt(r.D1)} / ${fmt(r.D2)}`, 'mm',
      `outside ≈ <b>${fmt(r.OD1)}</b> / <b>${fmt(r.OD2)}</b> mm`));
  }

  el.innerHTML = cards.join('');
}

function renderWarnings() {
  const icon =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2a1 1 0 0 1 .87.5l6.6 11.5a1 1 0 0 1-.87 1.5H1.4a1 1 0 0 1-.87-1.5L7.13 1.7A1 1 0 0 1 8 1.2zm0 4.3a.8.8 0 0 0-.8.8v3.4a.8.8 0 0 0 1.6 0V6.3a.8.8 0 0 0-.8-.8zm0 6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/></svg>';
  $('#warnings').innerHTML = result.warnings
    .map((w) => `<div class="warning ${w.level}">${icon}<span>${w.text}</span></div>`)
    .join('');
}

/* ---------- formulas ---------- */

function formulaList() {
  const r = result;
  const timing = r.mode === 'timing';
  const C = r.C;
  const mm = '\\,\\text{mm}';
  // each formula on separate rows: general form, values, result
  const al = (...rows) => `\\begin{aligned} ${rows.join(' \\\\[4pt] ')} \\end{aligned}`;
  const list = [];

  if (timing) {
    list.push({
      lbl: 'Pitch diameters',
      tex: al(
        `D_1 &= \\frac{z_1\\, p}{\\pi} = \\frac{${r.z1}\\cdot ${texP(r.p)}}{\\pi} = ${tex(r.D1)}${mm}`,
        `D_2 &= \\frac{z_2\\, p}{\\pi} = \\frac{${r.z2}\\cdot ${texP(r.p)}}{\\pi} = ${tex(r.D2)}${mm}`,
      ),
    });
  }

  if (!Number.isFinite(r.L)) return list;

  const phi = Math.asin((r.D2 - r.D1) / (2 * C));
  list.push({
    lbl: 'Span angle',
    tex: al(
      `\\varphi &= \\arcsin\\frac{D_2 - D_1}{2C}`,
      `&= \\arcsin\\frac{${tex(r.D2)} - ${tex(r.D1)}}{2\\cdot ${tex(C)}} = ${tex(phi, 4)}\\ \\text{rad}`,
    ),
  });
  list.push({
    lbl: 'Exact length',
    tex: al(
      `L &= 2C\\cos\\varphi + \\frac{\\pi\\,(D_1 + D_2)}{2} + \\varphi\\,(D_2 - D_1)`,
      `&= ${tex(2 * C * Math.cos(phi))} + ${tex(Math.PI * (r.D1 + r.D2) / 2)} + ${tex(phi * (r.D2 - r.D1))}`,
      `&= ${tex(r.L)}${mm}`,
    ),
  });
  list.push({
    lbl: 'Approximate length',
    tex: al(
      `L &\\approx 2C + \\frac{\\pi\\,(D_1 + D_2)}{2} + \\frac{(D_2 - D_1)^2}{4C}`,
      `&= ${tex(2 * C)} + ${tex(Math.PI * (r.D1 + r.D2) / 2)} + ${tex((r.D2 - r.D1) ** 2 / (4 * C))}`,
      `&= ${tex(r.Lapprox)}${mm}`,
    ),
  });

  if (timing && r.valid) {
    const b = 2 * r.Lbelt - Math.PI * (r.D1 + r.D2);
    list.push({
      lbl: 'Belt tooth count',
      tex: al(
        `N &= \\frac{L}{p} = \\frac{${tex(r.L)}}{${texP(r.p)}} = ${tex(r.teethExact)} \\;\\Rightarrow\\; N = ${r.teeth}`,
        `L_c &= N\\, p = ${r.teeth}\\cdot ${texP(r.p)} = ${tex(r.Lbelt, 1)}${mm}`,
      ),
    });
    list.push({
      lbl: 'Actual distance for the selected belt',
      tex: al(
        `b &= 2L_c - \\pi\\,(D_1 + D_2) = ${tex(b)}`,
        `C' &= \\frac{b + \\sqrt{b^2 - 8\\,(D_2 - D_1)^2}}{8} = ${tex(r.CactualApprox)}${mm}`,
      ),
    });
    list.push({
      lbl: 'Teeth in mesh on the small pulley',
      tex: al(
        `\\theta &= \\pi - 2\\,|\\varphi'| = ${tex(toDeg(r.wrapSmall), 1)}^\\circ`,
        `z_{\\text{mesh}} &= z_{\\min}\\,\\frac{\\theta}{2\\pi} = ${tex(r.meshTeeth, 1)}`,
      ),
    });
  } else if (!timing) {
    list.push({
      lbl: 'Wrap angles',
      tex: al(
        `\\theta_{\\text{small}} &= \\pi - 2\\,|\\varphi| = ${tex(toDeg(r.wrapSmall), 1)}^\\circ`,
        `\\theta_{\\text{large}} &= \\pi + 2\\,|\\varphi| = ${tex(toDeg(r.wrapLarge), 1)}^\\circ`,
      ),
    });
  }
  return list;
}

function renderFormulas() {
  const host = $('#formulas');
  const k = window.katex;
  host.innerHTML = formulaList()
    .map((f, i) => `<div class="formula"><div class="lbl">${f.lbl}</div><div class="math" data-i="${i}"></div></div>`)
    .join('');
  const list = formulaList();
  host.querySelectorAll('.math').forEach((el) => {
    const f = list[el.dataset.i];
    if (k) {
      try {
        k.render(f.tex, el, { displayMode: true, throwOnError: false });
        return;
      } catch {}
    }
    el.innerHTML = `<code>${f.tex.replace(/</g, '&lt;')}</code>`;
  });
}

/* ---------- startup ---------- */

try {
  const t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch {}

initControls();
syncInputs();
sizeStage();
update();
addEventListener('resize', () => sizeStage() && update());
requestAnimationFrame(frame);

// KaTeX comes from a CDN; if it loads after us, re-render the formulas
if (!window.katex) {
  window.addEventListener('load', () => window.katex && renderFormulas());
}
