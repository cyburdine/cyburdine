/* Таксофон — the rotary pulse explainer.
   ────────────────────────────────────────────────────────────────
   Not global. Loaded inline by projects/taksofon/ only, immediately
   after its markup, so the DOM is settled. Like retro_reflect.js and
   project_rotate.js it NO-OPS instead of throwing when its elements
   are absent, so it is harmless if it ever loads on another page.

   The diagram makes ONE argument: the pulses carry no information
   about where a digit ends. Seven clicks are seven clicks. "34" and
   "7" are the SAME SIGNAL on the same wire — the only thing that
   separates them is how long the gap in the middle is, measured
   against a timeout the software picks.

   So the control is the gap, and the readout is what the Pi decodes.
   Drag the gap under the threshold and 3-and-4 collapse into a 7 in
   front of you. That is the entire idea, and it is much easier to
   see than to describe.

   Timings are the real ones from phone.py: pulses arrive at about
   10/sec as the dial spring returns, the debounce window is 5ms, and
   the inter-digit timeout is 250ms.
   ──────────────────────────────────────────────────────────────── */
(() => {
"use strict";

const root = document.getElementById('dial');
if (!root) return;                     /* wrong page — do nothing */

const svg      = root.querySelector('.cy-dial__svg');
const gapInput = root.querySelector('#dpGap');
const readout  = root.querySelector('.cy-dial__readout');
const playBtn  = root.querySelector('.cy-dial__play');
if (!svg || !gapInput || !readout) return;

const NS = 'http://www.w3.org/2000/svg';
const REDUCE = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Real constants from the phone. */
const THRESHOLD  = 250;   /* ms of silence that ends a digit */
const PULSE_MS   = 100;   /* ~10 pulses/sec while the dial returns */
const GROUP_A    = 3;     /* first burst  */
const GROUP_B    = 4;     /* second burst */

/* Geometry */
const W = 720, H = 190, PAD = 46;
const BASE = 128;         /* the "low" rail of the square wave */
const TOP  = 64;          /* the "high" rail */

/* Build the pulse timeline for a given gap, in ms from t=0. */
function pulseTimes(gap) {
  const t = [];
  let now = 0;
  for (let i = 0; i < GROUP_A; i++) { t.push(now); now += PULSE_MS; }
  now += gap - PULSE_MS;                 /* the operator's finger travelling */
  for (let i = 0; i < GROUP_B; i++) { t.push(now); now += PULSE_MS; }
  return t;
}

/* What the Pi would decode from that timeline — the same rule as the
   firmware: split wherever the silence exceeds the timeout. */
function decode(times) {
  const digits = [];
  let count = 1;
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > THRESHOLD) { digits.push(count); count = 1; }
    else count++;
  }
  digits.push(count);
  return digits.map(n => (n >= 10 ? 0 : n)).join('');
}

function el(name, attrs) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

let playhead = null, rafId = 0;

function draw() {
  const gap   = Number(gapInput.value);
  const times = pulseTimes(gap);
  const total = times[times.length - 1] + PULSE_MS + 120;
  const x = ms => PAD + (ms / total) * (W - PAD * 2);

  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  /* Baseline rail */
  svg.appendChild(el('line', {
    x1: PAD, y1: BASE, x2: W - PAD, y2: BASE,
    stroke: 'var(--i-line)', 'stroke-width': 1
  }));

  /* The square wave: each pulse is a break in the circuit. */
  let d = `M ${x(0)} ${BASE}`;
  times.forEach(t => {
    const a = x(t), b = x(t + PULSE_MS * 0.45);
    d += ` L ${a} ${BASE} L ${a} ${TOP} L ${b} ${TOP} L ${b} ${BASE}`;
  });
  d += ` L ${W - PAD} ${BASE}`;
  svg.appendChild(el('path', {
    d, fill: 'none', stroke: 'var(--i-live)', 'stroke-width': 2,
    'stroke-linejoin': 'miter'
  }));

  /* The gap under measurement. */
  const gStart = times[GROUP_A - 1] + PULSE_MS * 0.45;
  const gEnd   = times[GROUP_A];
  const over   = gap > THRESHOLD;
  const gMid   = (x(gStart) + x(gEnd)) / 2;

  svg.appendChild(el('rect', {
    x: x(gStart), y: TOP - 10, width: Math.max(x(gEnd) - x(gStart), 1), height: BASE - TOP + 20,
    fill: over ? 'rgba(79,214,214,0.13)' : 'rgba(255,176,32,0.13)'
  }));
  svg.appendChild(el('line', {
    x1: x(gStart), y1: TOP - 10, x2: x(gStart), y2: BASE + 10,
    stroke: over ? 'var(--i-signal)' : 'var(--i-alarm)',
    'stroke-width': 1, 'stroke-dasharray': '3 3'
  }));
  svg.appendChild(el('line', {
    x1: x(gEnd), y1: TOP - 10, x2: x(gEnd), y2: BASE + 10,
    stroke: over ? 'var(--i-signal)' : 'var(--i-alarm)',
    'stroke-width': 1, 'stroke-dasharray': '3 3'
  }));

  const lbl = el('text', {
    x: gMid, y: BASE + 30, 'text-anchor': 'middle',
    fill: over ? 'var(--i-signal)' : 'var(--i-alarm)',
    'font-size': 12, 'font-family': 'var(--cy-font-mono)'
  });
  lbl.textContent = `${gap}ms`;
  svg.appendChild(lbl);

  const verdict = el('text', {
    x: gMid, y: BASE + 48, 'text-anchor': 'middle',
    fill: 'var(--i-dim)', 'font-size': 11, 'font-family': 'var(--cy-font-mono)'
  });
  verdict.textContent = over ? 'gap > 250ms — digit ends' : 'gap < 250ms — same digit';
  svg.appendChild(verdict);

  /* Pulse count marks. */
  times.forEach((t, i) => {
    const m = el('text', {
      x: x(t), y: TOP - 16, 'text-anchor': 'middle',
      fill: 'var(--i-dim)', 'font-size': 10, 'font-family': 'var(--cy-font-mono)'
    });
    m.textContent = String(i + 1);
    svg.appendChild(m);
  });

  playhead = el('line', {
    x1: PAD, y1: TOP - 26, x2: PAD, y2: BASE + 14,
    stroke: 'var(--i-ink)', 'stroke-width': 1, opacity: 0
  });
  svg.appendChild(playhead);

  /* Built as nodes rather than innerHTML. The only interpolated value is
     machine-generated digits, but a readout that never parses markup cannot
     grow an injection later either. */
  const digits = decode(times);
  while (readout.firstChild) readout.removeChild(readout.firstChild);
  const span = (cls, txt) => {
    const n = document.createElement('span');
    if (cls) n.className = cls;
    n.textContent = txt;
    return n;
  };
  readout.appendChild(span('cy-dial__k', times.length + ' pulses'));
  readout.appendChild(document.createTextNode(' on the wire '));
  readout.appendChild(span('cy-dial__arrow', '→'));
  readout.appendChild(document.createTextNode(' the Pi decodes '));
  const strong = document.createElement('strong');
  strong.textContent = digits;
  readout.appendChild(strong);
  readout.dataset.state = over ? 'split' : 'merged';

  return { times, total, x };
}

let state = draw();
gapInput.addEventListener('input', () => { cancelAnimationFrame(rafId); state = draw(); });

/* Sweep a playhead across in real time, so the pause is felt as a
   duration rather than read as a number. */
if (playBtn) {
  playBtn.addEventListener('click', () => {
    if (REDUCE) return;
    cancelAnimationFrame(rafId);
    const { total, x } = state;
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      if (!playhead) return;
      playhead.setAttribute('opacity', '0.85');
      playhead.setAttribute('x1', x(Math.min(t, total)));
      playhead.setAttribute('x2', x(Math.min(t, total)));
      if (t < total) rafId = requestAnimationFrame(frame);
      else playhead.setAttribute('opacity', '0');
    })(t0);
  });
  if (REDUCE) playBtn.hidden = true;
}

/* Controls stay hidden until the script is confirmed running, so a
   no-JS reader is never shown a slider that does nothing. */
root.classList.add('cy-dial--live');
})();
