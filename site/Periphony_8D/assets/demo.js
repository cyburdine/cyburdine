/* Periphony 8D — demo transport, orbit ring, aurora and signup. */
(() => {
"use strict";

/* ─────────────────────────────────────────────────────────────
   Constants baked from the actual render.
   The engine reported these for the demo clip; ORBIT_HZ was then
   confirmed by measuring the modulation of the rendered file's
   L/R level difference (0.2667 Hz measured vs 0.2663 reported).
   ───────────────────────────────────────────────────────────── */
const ORBIT_HZ   = 0.2663352272727273;  // revolutions per second
const PHASE0_DEG = 300.938;             // orbit phase at the clip's first sample
const POSITIONS  = 36;                  // KEMAR azimuths the engine pre-convolves

/* Aurora stops, matching the conic gradient in the stylesheet so the lobe's
   colour is always the wheel's colour at the same bearing. */
const AURORA = [[0,77,255,176],[55,0,229,255],[110,46,123,255],[165,155,77,255],
                [220,255,61,219],[275,255,77,141],[320,255,171,61],[360,77,255,176]];

function auroraAt(deg){
  const d = ((deg % 360) + 360) % 360;
  for (let i = 1; i < AURORA.length; i++){
    const [d1,r1,g1,b1] = AURORA[i-1], [d2,r2,g2,b2] = AURORA[i];
    if (d <= d2){
      const t = (d - d1) / (d2 - d1);
      return [Math.round(r1+(r2-r1)*t), Math.round(g1+(g2-g1)*t), Math.round(b1+(b2-b1)*t)];
    }
  }
  return [59,240,169];
}

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('#year').textContent = new Date().getFullYear();

/* ── Ring: draw the 36-position measurement grid ───────────── */
const R_OUT = 178, R_IN = 162, CX = 200, CY = 200;
(function drawRing(){
  const svg = $('#ring');
  const ns = 'http://www.w3.org/2000/svg';
  const el = (n, a) => { const e = document.createElementNS(ns, n);
    for (const k in a) e.setAttribute(k, a[k]); return e; };

  svg.appendChild(el('circle', {class:'head', cx:CX, cy:CY, r:52}));

  // Track-progress arc sits just outside the ticks.
  const r = R_OUT + 13;
  svg.appendChild(el('circle', {class:'arc-bg', cx:CX, cy:CY, r}));
  const arc = el('circle', {class:'arc-fg', cx:CX, cy:CY, r,
    transform:`rotate(-90 ${CX} ${CY})`,
    'stroke-dasharray':2*Math.PI*r, 'stroke-dashoffset':2*Math.PI*r});
  arc.id = 'arc';
  svg.appendChild(arc);

  for (let i = 0; i < POSITIONS; i++){
    const a = (i * 360 / POSITIONS - 90) * Math.PI / 180;
    const t = el('line', {class:'tick',
      x1:CX + R_IN*Math.cos(a),  y1:CY + R_IN*Math.sin(a),
      x2:CX + R_OUT*Math.cos(a), y2:CY + R_OUT*Math.sin(a)});
    t.dataset.i = i;
    svg.appendChild(t);
  }

  for (const [txt, dx, dy] of [['FRONT',CX,CY-R_OUT-38],['BACK',CX,CY+R_OUT+45],
                               ['LEFT',CX-R_OUT-40,CY+4],['RIGHT',CX+R_OUT+40,CY+4]])
    { const n = el('text', {class:'label', x:dx, y:dy}); n.textContent = txt; svg.appendChild(n); }

  const src = el('circle', {class:'src', cx:CX, cy:CY-R_OUT, r:5.5}); src.id = 'src';
  svg.appendChild(src);
})();

const ticks = [...document.querySelectorAll('.tick')];

/* ── The beam ───────────────────────────────────────────────────
   A searchlight with its apex pinned at the centre of the ring,
   sweeping round with the source. It is a bundle of overlapping rays
   rather than one solid sector: each ray's reach and brightness come
   from a field evaluated at ABSOLUTE angle, so the striations sit
   still in space and the beam flows through them as it turns —
   the aurora-curtain look, rather than a rigid shape being rotated. */
const BEAM_HALF = 39;      // degrees either side of the bearing
const BEAM_LEN  = 336;     // reaches well past the tick ring, then falls off
const RAYS      = 20;      // wide enough to survive the blur, fine enough to flow

function striation(aRad, t){
  // High spatial frequency so several streaks fall across the cone; the time
  // terms let the curtain drift rather than merely sweep.
  return 0.50 * Math.sin(11 * aRad + 0.55 * t)
       + 0.30 * Math.sin(17 * aRad - 0.90 * t)
       + 0.20 * Math.sin(29 * aRad + 1.45 * t);
}

/* Rays are created once and only their geometry is rewritten per frame. */
const rayEls = (() => {
  const g = $('#rays'), ns = 'http://www.w3.org/2000/svg', out = [];
  for (let i = 0; i < RAYS; i++){
    const el = document.createElementNS(ns, 'path');
    g.appendChild(el); out.push(el);
  }
  return out;
})();

/* ── Sparks ─────────────────────────────────────────────────────
   Emitted at the centre inside the cone, then travelling along a FIXED
   radial line. Because each keeps the bearing and colour it was born
   with, the beam sweeps away from its own older particles and leaves a
   trailing spiral — the rotation reads even from the debris. They fade
   out past the tick ring, into darkness. */
const SPARKS     = 96;
const SPARK_MAX  = 330;     // gone by here
const SPARK_FADE = R_OUT;   // fading starts at the tick ring

const sparkEls = (() => {
  const g = $('#sparks'), ns = 'http://www.w3.org/2000/svg', out = [];
  for (let i = 0; i < SPARKS; i++){
    const el = document.createElementNS(ns, 'circle');
    g.appendChild(el); out.push(el);
  }
  return out;
})();
const sparks = Array.from({length: SPARKS}, () => ({r: -1}));
let lastPos = null;

function spawn(sp, deg){
  // Three uniforms averaged: a cheap bell, so emission clusters on the axis.
  const u = (Math.random() + Math.random() + Math.random()) / 3;
  const off = (u * 2 - 1) * BEAM_HALF;
  sp.a    = (deg + off) * Math.PI / 180;
  sp.r    = 5 + Math.random() * 12;
  sp.v    = 58 + Math.random() * 150;
  sp.size = 0.7 + Math.random() * 1.9;
  sp.tw   = 0.8 + Math.random() * 3.2;
  sp.ph   = Math.random() * 6.283;
  const [r, g, b] = auroraAt(deg + off);
  sp.col = `rgb(${r},${g},${b})`;
  return sp;
}

function drawSparks(deg, pos, dt){
  for (let i = 0; i < SPARKS; i++){
    const sp = sparks[i], el = sparkEls[i];
    if (sp.r < 0 || sp.r > SPARK_MAX){
      spawn(sp, deg);
      el.setAttribute('fill', sp.col);
      el.setAttribute('r', sp.size.toFixed(2));
    }
    sp.r += sp.v * dt;

    let a = Math.min(1, (sp.r - 5) / 22);                     // fade in at the apex
    if (sp.r > SPARK_FADE)
      a *= Math.max(0, 1 - (sp.r - SPARK_FADE) / (SPARK_MAX - SPARK_FADE));
    a *= 0.66 + 0.34 * Math.sin(pos * sp.tw + sp.ph);         // twinkle, never to zero

    el.setAttribute('cx', (CX + sp.r * Math.sin(sp.a)).toFixed(1));
    el.setAttribute('cy', (CY - sp.r * Math.cos(sp.a)).toFixed(1));
    el.setAttribute('opacity', Math.max(0, a).toFixed(3));
  }
}

function clearSparks(){
  lastPos = null;
  for (let i = 0; i < SPARKS; i++){ sparks[i].r = -1; sparkEls[i].setAttribute('opacity', '0'); }
}

function drawBeam(deg, t){
  const span = (BEAM_HALF * 2) / (RAYS - 1);
  const w = span * 1.45;                     // overlap, so the curtain flows
  for (let i = 0; i < RAYS; i++){
    const off = -BEAM_HALF + i * span;
    // Cosine envelope across the cone: bright on axis, nothing at the edges.
    const env = Math.cos((off / BEAM_HALF) * Math.PI / 2) ** 2;
    const abs = (deg + off) * Math.PI / 180;
    const n   = (striation(abs, t) + 1) / 2;                  // 0..1
    const len = BEAM_LEN * (0.62 + 0.38 * n) * (0.55 + 0.45 * env);
    const a1  = abs - (w * Math.PI / 180) / 2;
    const a2  = abs + (w * Math.PI / 180) / 2;
    const el  = rayEls[i];
    el.setAttribute('d',
      `M${CX} ${CY}L${(CX + len * Math.sin(a1)).toFixed(1)} ${(CY - len * Math.cos(a1)).toFixed(1)}` +
      `L${(CX + len * Math.sin(a2)).toFixed(1)} ${(CY - len * Math.cos(a2)).toFixed(1)}Z`);
    el.setAttribute('opacity', (env * (0.30 + 0.70 * n)).toFixed(3));
  }
}
const srcDot = $('#src'), arcEl = $('#arc');
const ARC_LEN = 2 * Math.PI * (R_OUT + 13);

/* ── Audio: two buffers, one clock, gain crossfade ─────────── */
const AC = window.AudioContext || window.webkitAudioContext;
let ctx, bufA, bufB, srcA, srcB, gA, gB;
let playing = false, started = false, is8D = false, startedAt = 0, dur = 30;

const readout = $('#readout'), hint = $('#hint');
const btnOrig = $('#btnOrig'), btn8d = $('#btn8d'), playBtn = $('#play');

async function load(){
  try{
    const [a, b] = await Promise.all([
      fetch('assets/demo-original.mp3').then(r => r.arrayBuffer()),
      fetch('assets/demo-8d.mp3').then(r => r.arrayBuffer())
    ]);
    ctx = new AC();
    [bufA, bufB] = await Promise.all([ctx.decodeAudioData(a), ctx.decodeAudioData(b)]);
    if (bufA.length !== bufB.length)
      console.warn('demo clips differ in length; the A/B switch assumes they match');
    dur = bufA.duration;
    btnOrig.disabled = btn8d.disabled = false;
    readout.textContent = 'READY';
  }catch(e){
    readout.textContent = 'AUDIO UNAVAILABLE';
    hint.textContent = 'The demo could not load. The download below still works.';
    playBtn.disabled = true;
  }
}
load();

function start(){
  if (!ctx || playing) return;

  if (started){                       // resuming a pause
    ctx.resume();
    playing = true;
    playIcon(true);
    setAura(is8D);
    requestAnimationFrame(frame);
    return;
  }

  gA = ctx.createGain(); gB = ctx.createGain();
  gA.gain.value = is8D ? 0 : 1;
  gB.gain.value = is8D ? 1 : 0;
  gA.connect(ctx.destination); gB.connect(ctx.destination);

  srcA = ctx.createBufferSource(); srcA.buffer = bufA; srcA.loop = true;
  srcB = ctx.createBufferSource(); srcB.buffer = bufB; srcB.loop = true;
  srcA.connect(gA); srcB.connect(gB);

  // One start time for both: this is what makes the switch seamless.
  // The context is created at load, so Chrome hands it back suspended;
  // this first user gesture is what is allowed to start its clock.
  if (ctx.state === 'suspended') ctx.resume();

  const t0 = ctx.currentTime + 0.06;
  srcA.start(t0); srcB.start(t0);
  startedAt = t0; playing = true; started = true;

  playIcon(true);
  setAura(is8D);          // first play straight into 8D must light up too
  requestAnimationFrame(frame);
}

function pause(){
  if (!playing) return;
  ctx.suspend();
  playing = false;
  playIcon(false);
  setAura(false);
  readout.textContent = 'PAUSED';
}

function playIcon(isPlaying){
  $('#playIcon').innerHTML = isPlaying
    ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
    : '<path d="M8 5v14l11-7z"/>';
  playBtn.setAttribute('aria-label', isPlaying ? 'Pause the demo' : 'Play the demo');
}

/* Equal-power crossfade — short enough to feel instant, long
   enough that the discontinuity never clicks. */
function setMode(to8D){
  is8D = to8D;
  btnOrig.setAttribute('aria-pressed', String(!to8D));
  btn8d.setAttribute('aria-pressed', String(to8D));
  hint.textContent = to8D
    ? 'The source is orbiting you now. Switch back and the room goes flat.'
    : 'This is the untouched original, at the same loudness.';

  if (playing){
    const t = ctx.currentTime, X = 0.015;
    for (const [g, v] of [[gA, to8D ? 0 : 1], [gB, to8D ? 1 : 0]]){
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(v, t + X);
    }
  }
  setAura(playing && to8D);
  if (!playing) start();
}

/* ── The aurora ────────────────────────────────────────────── */
const beamSvg = $('#beamSvg'), raysEl = $('#rays');
const beamStops = [...document.querySelectorAll('#beamGrad .bg')];
function setAura(on){
  beamSvg.classList.toggle('on', on);
  if (!on){
    ticks.forEach(t => t.style.stroke = '');
    srcDot.style.fill = '';
    srcDot.style.opacity = '';
    for (const el of rayEls){ el.removeAttribute('d'); el.removeAttribute('opacity'); }
    clearSparks();
  }
}

function frame(){
  if (!playing) return;
  const t = ctx.currentTime - startedAt;
  const pos = ((t % dur) + dur) % dur;

  // Screen bearing, clockwise from FRONT. Derived from the engine's own
  // clockwise azimuth sweep, offset by where the clip was cut.
  const deg = (PHASE0_DEG + pos * ORBIT_HZ * 360) % 360;
  const rad = deg * Math.PI / 180;
  const az  = (360 - deg) % 360;              // back to KEMAR azimuth
  const azR = az * Math.PI / 180;

  // Track position always advances; the source marker only travels in 8D,
  // because in the original nothing is moving and the ring must not imply it does.
  arcEl.setAttribute('stroke-dashoffset', ARC_LEN * (1 - pos / dur));

  if (is8D){
    srcDot.setAttribute('cx', CX + R_OUT * Math.sin(rad));
    srcDot.setAttribute('cy', CY - R_OUT * Math.cos(rad));
    srcDot.style.opacity = '1';

    // Brightness follows cos(azimuth), mirroring the engine's front-louder
    // envelope: the aurora lifts as the source comes round the front.
    const bright = 0.72 + 0.28 * Math.cos(azR);
    const [r, g, b] = auroraAt(deg);

    drawBeam(deg, reduced ? 0 : pos);

    // Advance sparks on the audio clock, so pausing freezes them and the
    // loop wrap does not fling every particle to the rim.
    let dt = 0;
    if (lastPos !== null){ const d = pos - lastPos; if (d > 0 && d < 0.25) dt = d; }
    lastPos = pos;
    if (!reduced) drawSparks(deg, pos, dt);
    const col = `rgb(${r},${g},${b})`;
    for (const st of beamStops) st.setAttribute('stop-color', col);
    beamSvg.style.opacity = '';
    raysEl.setAttribute('opacity', (0.74 + 0.26 * bright).toFixed(3));

    // The engine crossfades between adjacent measured positions; show that.
    const exact = deg / 10;
    ticks.forEach((tk, i) => {
      const d = Math.min(Math.abs(i - exact), POSITIONS - Math.abs(i - exact));
      tk.style.stroke = d < 1.6
        ? `rgba(${r},${g},${b},${((1 - d / 1.6) * 0.9 + 0.1).toFixed(3)})`
        : '';
    });
    srcDot.style.fill = `rgb(${r},${g},${b})`;
    readout.textContent = `${String(Math.round(az)).padStart(3,'0')}°`;
  } else {
    srcDot.setAttribute('cx', CX);          // parked at front, still
    srcDot.setAttribute('cy', CY - R_OUT);
    srcDot.style.opacity = '0.28';
    readout.textContent = 'STEREO — NOT MOVING';
  }
  requestAnimationFrame(frame);
}

playBtn.addEventListener('click', () => playing ? pause() : start());
btnOrig.addEventListener('click', () => setMode(false));
btn8d .addEventListener('click', () => setMode(true));

/* ── Signup ────────────────────────────────────────────────── */
const form = $('#signup'), msg = $('#formMsg'), sBtn = $('#signupBtn');
form.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#email').value.trim();
  msg.className = 'form-msg';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
    msg.classList.add('err');
    msg.textContent = 'That address doesn’t look right. Check it and try again.';
    return;
  }
  sBtn.disabled = true; msg.textContent = 'Sending…';
  try{
    const r = await fetch('api/signup', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email, company: $('#company').value})
    });
    if (!r.ok) throw new Error(r.status);
    msg.classList.add('ok');
    msg.textContent = 'Check your inbox — the confirmation link is on its way.';
    form.reset();
  }catch(err){
    msg.classList.add('err');
    msg.textContent = 'That didn’t send. Try again in a moment, or email justin@cyburdine.com.';
  }finally{ sBtn.disabled = false; }
});

/* ── Reveal ────────────────────────────────────────────────── */
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
}, {rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.rise').forEach(n => io.observe(n));

})();
