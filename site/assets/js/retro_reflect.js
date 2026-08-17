/* Active green screen — the retro-reflection explainer.
   ────────────────────────────────────────────────────────────────
   Not global. Loaded inline by projects/active-green-screen/ only,
   immediately after its markup, so the DOM is settled. Like
   project_rotate.js it NO-OPS instead of throwing when its elements
   are absent, so it is harmless if it ever loads on another page.

   The diagram makes one argument, and every piece of it exists to
   serve that argument: retro-reflective fabric sends light back
   toward THE SOURCE, not toward the camera. Those are the same place
   only when the LED ring and the lens are co-located. Slide the ring
   off the lens axis and the returning light goes back to where the
   ring now is — past the lens, which sees nothing.

   The scene is drawn top-down. The return is drawn as a narrow cone
   centred on the path back to the ring; the lens either falls inside
   that cone or it does not, which is the whole effect made visible.

   HONEST EXAGGERATION: real 3M retro-reflective sheeting has an
   observation-angle acceptance of roughly a degree. Drawn at true
   scale the cone would be invisible, so it is opened up to about 7°.
   The falloff MATH uses the same widened angle the drawing shows, so
   the picture and the numbers always agree with each other — the
   curve is honest about itself, just gentler than the real material.
   The caption says so.
   ──────────────────────────────────────────────────────────────── */
(() => {
"use strict";

const root = document.getElementById('retro');
if (!root) return;                       // not this page — do nothing

const $  = s => root.querySelector(s);
const $$ = s => [...root.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const el = (n, a) => { const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, a[k]); return e; };

const scene = $('#rrScene'), cam = $('#rrCam'), bead = $('#rrBead');
if (!scene || !cam || !bead) return;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Geometry, in scene viewBox units (640 × 380) ──────────────── */
const AXIS   = 190;      // the optical axis, horizontal
const LENS_X = 126;      // the lens aperture — the camera never moves
const RING_X = 132;      // the ring sits just in front of the glass
const FAB_X  = 556;      // face of the retro-reflective fabric
const RING_R = 15;       // ring radius, drawn edge-on from above
const SUBJ   = {x: 420, y: 190, r: 26};
const D      = FAB_X - RING_X;

/* Acceptance half-angle of the return cone. Shared by the drawing and
   the falloff, so they can never disagree. See the note above. */
const THETA0 = 0.13;
const MAX_D  = 120;      // furthest the ring slides off axis

/* Where the fan lands on the fabric. Odd count so one ray runs the axis. */
const TARGETS = [55, 82, 109, 136, 163, 190, 217, 244, 271, 298, 325];

/* Chroma green and chroma blue, nudged brighter so they read against
   the terminal's near-black ground. "off" is the fabric's true colour:
   the unremarkable grey everyone in the room actually sees. */
const KEYS = {
  green: {lit:'#19e05f'},
  blue:  {lit:'#2b6cff'},
  off:   {lit:'#66727c'}
};

let keyName = 'green';
let offset  = 0;          // ring displacement off the lens axis, in units
let keyed   = false;      // "pull the key" toggle

/* ── Brightness ─────────────────────────────────────────────────
   The observation angle is the angle, measured at the fabric,
   between the ray back to the ring and the ray to the lens. With the
   ring displaced by `offset` at distance D that is atan(offset / D).
   Retro-reflective return falls off as a Gaussian in that angle. */
function brightness(off){
  const theta = Math.atan(off / D);
  return Math.exp(-((theta / THETA0) ** 2));
}

/* Does a segment from A to B clip the subject? Used so rays stop at
   the person instead of drawing straight through them. */
function hitSubject(ax, ay, bx, by){
  const dx = bx - ax, dy = by - ay;
  const fx = ax - SUBJ.x, fy = ay - SUBJ.y;
  const a = dx*dx + dy*dy;
  const b = 2 * (fx*dx + fy*dy);
  const c = fx*fx + fy*fy - SUBJ.r*SUBJ.r;
  const disc = b*b - 4*a*c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2*a);
  if (t < 0 || t > 1) return null;
  return {x: ax + t*dx, y: ay + t*dy};
}

/* ── Build the scene once ──────────────────────────────────────── */
const gCones = el('g', {}), gOut = el('g', {}), gBack = el('g', {}),
      gDots  = el('g', {});
const gStatic = el('g', {});
scene.append(gCones, gOut, gBack, gDots, gStatic);

// Fabric, subject and camera are static furniture.
gStatic.append(
  el('rect', {class:'rr-fabric', x:FAB_X, y:36, width:13, height:308}),
  el('rect', {class:'rr-cam-body', x:34, y:164, width:70, height:52, rx:4}),
  el('rect', {class:'rr-cam-lens', x:104, y:176, width:22, height:28, rx:2})
);
const subjEl = el('circle', {class:'rr-subject', cx:SUBJ.x, cy:SUBJ.y, r:SUBJ.r});
gStatic.append(subjEl);

const lensDot = el('circle', {class:'rr-lens-dot', cx:LENS_X, cy:AXIS, r:4.5});
gStatic.append(lensDot);

// Labels
const mkText = (x, y, t, cls, anchor) => {
  const n = el('text', {class:'rr-label ' + (cls||''), x, y, 'text-anchor':anchor||'middle'});
  n.textContent = t; return n;
};
gStatic.append(
  mkText(69, 236, 'CAMERA', ''),
  mkText(SUBJ.x, 246, 'SUBJECT', ''),
  mkText(FAB_X + 7, 28, 'RETRO-REFLECTIVE FABRIC', '', 'end')
);

// The ring: a mount arm back to the camera, plus the two edge-on ends.
const mount = el('line', {class:'rr-mount', x1:LENS_X, y1:AXIS, x2:RING_X, y2:AXIS});
const ringLine = el('line', {class:'rr-ring'});
const ringA = el('circle', {class:'rr-led', r:5});
const ringB = el('circle', {class:'rr-led', r:5});
const ringLbl = mkText(0, 0, 'LED RING', 'rr-label--ring', 'start');
gStatic.append(mount, ringLine, ringA, ringB, ringLbl);

// One cone + outgoing ray + return ray + travelling dot per target.
const rays = TARGETS.map(ty => {
  const cone = el('path', {class:'rr-cone'});
  const out  = el('line', {class:'rr-out'});
  const back = el('line', {class:'rr-back'});
  // Born hidden and unplaced. frame() is what gives these a position, and
  // under prefers-reduced-motion frame() never runs — without this they
  // would all paint at the origin as a knot of white dots in the corner.
  const dot  = el('circle', {class:'rr-dot', r:3, opacity:0});
  gCones.append(cone); gOut.append(out); gBack.append(back); gDots.append(dot);
  return {ty, cone, out, back, dot};
});

/* ── Camera view ────────────────────────────────────────────────
   What the sensor actually records: the fabric filling the frame, the
   subject in front of it, and — once the ring is off axis — a shadow
   edge creeping out from behind the subject. At offset zero the light
   and the lens share a sightline, so the subject's shadow falls
   exactly behind the subject and the camera cannot see it. That is
   the real reason you can stand close to this screen. */
const camBg     = $('#rrCamBg');
const camShadow = $('#rrCamShadow');
const camKeyed  = $('#rrCamKeyed');
const camNoise  = $('#rrCamNoise');
const camNote   = $('#rrCamNote');

// Speckle pool for the "dirty key" look when the return is weak.
const NOISE = 130;
const noiseEls = [];
for (let i = 0; i < NOISE; i++){
  // Deterministic scatter — no Math.random at module scope, so the
  // figure looks identical on every load and diffs stay quiet.
  const x = ((i * 97) % 311) / 311 * 320;
  const y = ((i * 53) % 179) / 179 * 180;
  const n = el('rect', {x: x.toFixed(1), y: y.toFixed(1),
                        width: 1 + (i % 3), height: 1 + ((i * 7) % 3),
                        class: 'rr-speck'});
  camNoise.append(n); noiseEls.push(n);
}

/* ── Bead zoom ──────────────────────────────────────────────────
   Real refraction, not a hand-drawn squiggle. A ray enters a glass
   sphere, bends, mirrors off the metallised back, bends again on the
   way out — and leaves very nearly antiparallel to how it arrived.
   That near-antiparallel exit IS retro-reflection; a high index
   (~1.9, which is why these are specialist beads and not window
   glass) puts the focus on the back surface and makes it work.
   Beside it, the same ray on a matte surface, scattering everywhere. */
const IOR = 1.9;
const V = {
  sub:(a,b)=>({x:a.x-b.x, y:a.y-b.y}),
  add:(a,b)=>({x:a.x+b.x, y:a.y+b.y}),
  mul:(a,s)=>({x:a.x*s, y:a.y*s}),
  dot:(a,b)=>a.x*b.x + a.y*b.y,
  norm:a=>{const l=Math.hypot(a.x,a.y); return {x:a.x/l, y:a.y/l};}
};
function refract(u, n, eta){
  const cosi = -V.dot(n, u);
  const k = 1 - eta*eta*(1 - cosi*cosi);
  if (k < 0) return null;                       // total internal reflection
  return V.norm(V.add(V.mul(u, eta), V.mul(n, eta*cosi - Math.sqrt(k))));
}
// Exit point of a ray from inside a sphere (centre C, radius R).
function exitSphere(p, u, C, R){
  const m = V.sub(p, C);
  const b = V.dot(m, u);
  const c = V.dot(m, m) - R*R;
  const t = -b + Math.sqrt(Math.max(0, b*b - c));
  return V.add(p, V.mul(u, t));
}

function buildBead(){
  const C = {x: 84, y: 86}, R = 44;
  const gPath = $('#rrBeadPath');
  if (!gPath) return null;

  /* The entry is aimed at a point well off the bead's centre — 240° round
     the rim — on purpose. A ray that hits dead centre retro-reflects
     perfectly but draws as a single line doubled back on itself, which
     teaches nothing. Off-centre opens the internal path into a visible V
     while still coming back out very nearly antiparallel, which is the
     claim the picture has to support. */
  const ENTRY_DEG = 240;
  const a = ENTRY_DEG * Math.PI / 180;
  const P1 = {x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a)};
  const u0 = V.norm({x: 0.80, y: 0.60});
  const start = V.sub(P1, V.mul(u0, 40));
  const n1 = V.norm(V.sub(P1, C));

  // refract() wants the normal facing AGAINST the ray. Entering the bead
  // from outside, that is the outward normal as-is; leaving it again, the
  // ray is travelling outward so the normal has to be flipped. Getting
  // either of these backwards collapses the path to a single point.
  const u1 = refract(u0, n1, 1 / IOR);
  if (!u1) return null;
  const P2 = exitSphere(P1, u1, C, R);          // the mirrored back
  const n2 = V.norm(V.sub(P2, C));
  // Specular reflection off the metallised rear face.
  const u2 = V.norm(V.sub(u1, V.mul(n2, 2 * V.dot(u1, n2))));
  const P3 = exitSphere(P2, u2, C, R);
  const n3 = V.norm(V.sub(P3, C));
  const u3 = refract(u2, V.mul(n3, -1), IOR) || V.mul(u0, -1);
  // Walk the exit out until it is about to leave the panel, so the return
  // is as long as the frame allows without being clipped.
  let run = 46;
  while (run > 8){
    const t = V.add(P3, V.mul(u3, run));
    if (t.x > 6 && t.y > 6 && t.x < 160 && t.y < 172) break;
    run -= 2;
  }
  const P4 = V.add(P3, V.mul(u3, run));

  const pts = [start, P1, P2, P3, P4];
  gPath.setAttribute('d', 'M' + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L'));

  // The exit is redrawn on top in white. The whole argument of this panel
  // is "it leaves the way it came in", and that only lands if the reader
  // can tell which strand is the return.
  const outMark = $('#rrBeadOut');
  if (outMark) outMark.setAttribute('d',
    `M${P3.x.toFixed(1)} ${P3.y.toFixed(1)}L${P4.x.toFixed(1)} ${P4.y.toFixed(1)}`);

  const tag = (id, p, dx, dy) => {
    const n = $(id);
    if (n){ n.setAttribute('x', (p.x + dx).toFixed(1)); n.setAttribute('y', (p.y + dy).toFixed(1)); }
  };
  tag('#rrBeadInLbl',  start, -4, -8);
  tag('#rrBeadOutLbl', P4,    -4, -8);

  return {pts, total: pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x-pts[i].x, p.y-pts[i].y), 0)};
}
const beadPath = buildBead();

// The diffuse half: one ray in, a fan of scatter out.
(function buildDiffuse(){
  const g = $('#rrDiffuse');
  if (!g) return;
  const O = {x: 248, y: 130};
  g.append(el('path', {class:'rr-bead-in', d:`M${O.x-58} ${O.y-54}L${O.x} ${O.y}`}));
  for (let i = 0; i < 9; i++){
    const a = -Math.PI + (i + 0.5) * (Math.PI / 9);
    g.append(el('line', {class:'rr-scatter',
      x1:O.x, y1:O.y,
      x2:(O.x + Math.cos(a) * 52).toFixed(1),
      y2:(O.y + Math.sin(a) * 52).toFixed(1)}));
  }
})();

/* ── Render ────────────────────────────────────────────────────── */
function render(){
  const col = KEYS[keyName].lit;
  const on  = keyName !== 'off';
  const B   = on ? brightness(offset) : 0;

  root.style.setProperty('--rr-key', col);
  root.style.setProperty('--rr-b', B.toFixed(3));

  const S = {x: RING_X, y: AXIS + offset};

  // Ring furniture follows the offset.
  ringLine.setAttribute('x1', S.x); ringLine.setAttribute('y1', S.y - RING_R);
  ringLine.setAttribute('x2', S.x); ringLine.setAttribute('y2', S.y + RING_R);
  ringA.setAttribute('cx', S.x); ringA.setAttribute('cy', S.y - RING_R);
  ringB.setAttribute('cx', S.x); ringB.setAttribute('cy', S.y + RING_R);
  mount.setAttribute('x2', S.x); mount.setAttribute('y2', S.y);
  ringLbl.setAttribute('x', S.x + 14);
  ringLbl.setAttribute('y', S.y + RING_R + 20);

  for (const r of rays){
    const T = {x: FAB_X, y: r.ty};
    const blocked = hitSubject(S.x, S.y, T.x, T.y);
    const end = blocked || T;

    r.out.setAttribute('x1', S.x); r.out.setAttribute('y1', S.y);
    r.out.setAttribute('x2', end.x.toFixed(1)); r.out.setAttribute('y2', end.y.toFixed(1));
    r.out.setAttribute('opacity', on ? 0.75 : 0.12);

    if (blocked || !on){
      r.cone.setAttribute('d', '');
      r.back.setAttribute('opacity', 0);
      r.dot.setAttribute('opacity', 0);
      continue;
    }
    // frame() owns the dots, and it never runs under reduced motion.
    if (reduced) r.dot.setAttribute('opacity', 0);

    // The return cone: centred on the path back to the RING, not the lens.
    const ang = Math.atan2(S.y - T.y, S.x - T.x);
    const len = Math.hypot(S.x - T.x, S.y - T.y) * 1.04;
    const a1 = ang - THETA0, a2 = ang + THETA0;
    r.cone.setAttribute('d',
      `M${T.x} ${T.y}` +
      `L${(T.x + len*Math.cos(a1)).toFixed(1)} ${(T.y + len*Math.sin(a1)).toFixed(1)}` +
      `L${(T.x + len*Math.cos(a2)).toFixed(1)} ${(T.y + len*Math.sin(a2)).toFixed(1)}Z`);

    // The part of that cone that actually reaches the glass.
    r.back.setAttribute('x1', T.x); r.back.setAttribute('y1', T.y);
    r.back.setAttribute('x2', LENS_X); r.back.setAttribute('y2', AXIS);
    r.back.setAttribute('opacity', (0.10 + 0.85 * B).toFixed(3));
  }

  // ── Camera view
  camBg.setAttribute('fill', on ? col : '#2c3238');
  camBg.setAttribute('opacity', on ? (0.18 + 0.82 * B).toFixed(3) : 1);

  // Shadow slides out from behind the subject as the ring leaves the axis.
  const slip = (offset / MAX_D) * 46;
  camShadow.setAttribute('transform', `translate(${slip.toFixed(1)},0)`);
  camShadow.setAttribute('opacity', on ? Math.min(0.5, offset / MAX_D * 0.9).toFixed(3) : 0);

  camKeyed.setAttribute('opacity', keyed ? 1 : 0);

  // A weak return makes a filthy key: speckle in proportion to the miss.
  const dirt = keyed ? Math.max(0, 1 - B) : 0;
  camNoise.setAttribute('opacity', dirt.toFixed(3));
  const lit = Math.round(dirt * NOISE);
  noiseEls.forEach((n, i) => n.setAttribute('display', i < lit ? '' : 'none'));

  const pct = Math.round(B * 100);
  camNote.textContent = !on
    ? 'RING OFF — PLAIN GREY FABRIC'
    : keyed
      ? (B > 0.85 ? `KEY CLEAN · RETURN ${pct}%`
        : B > 0.4  ? `KEY BREAKING UP · RETURN ${pct}%`
                   : `KEY FAILED · RETURN ${pct}%`)
      : `RETURN ${pct}%`;

  const read = $('#rrReadout');
  if (read){
    const deg = (Math.atan(offset / D) * 180 / Math.PI).toFixed(2);
    read.textContent = `OFFSET ${Math.round(offset / MAX_D * 100)}%  ·  OBSERVATION ANGLE ${deg}°  ·  RETURN ${pct}%`;
  }
}

/* ── The travelling light ──────────────────────────────────────── */
let t0 = null;
function frame(ts){
  if (t0 === null) t0 = ts;
  const t = (ts - t0) / 1000;
  const on = keyName !== 'off';
  const B  = on ? brightness(offset) : 0;
  const S  = {x: RING_X, y: AXIS + offset};

  rays.forEach((r, i) => {
    if (!on || r.cone.getAttribute('d') === ''){ r.dot.setAttribute('opacity', 0); return; }
    const T = {x: FAB_X, y: r.ty};
    const p = ((t * 0.42) + i * 0.055) % 1;
    let x, y, a;
    if (p < 0.5){                                  // outbound: always full
      const k = p / 0.5;
      x = S.x + (T.x - S.x) * k; y = S.y + (T.y - S.y) * k; a = 0.95;
    } else {                                       // return: only what gets home
      const k = (p - 0.5) / 0.5;
      x = T.x + (LENS_X - T.x) * k; y = T.y + (AXIS - T.y) * k;
      a = 0.15 + 0.85 * B;
    }
    r.dot.setAttribute('cx', x.toFixed(1));
    r.dot.setAttribute('cy', y.toFixed(1));
    r.dot.setAttribute('opacity', a.toFixed(3));
  });

  // The bead's photon, on the same clock.
  if (beadPath){
    const dot = $('#rrBeadDot');
    if (dot){
      const p = (t * 0.3) % 1;
      let want = p * beadPath.total;
      const pts = beadPath.pts;
      for (let i = 1; i < pts.length; i++){
        const L = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
        if (want <= L || i === pts.length - 1){
          const k = L > 0 ? Math.min(1, want / L) : 0;
          dot.setAttribute('cx', (pts[i-1].x + (pts[i].x - pts[i-1].x) * k).toFixed(1));
          dot.setAttribute('cy', (pts[i-1].y + (pts[i].y - pts[i-1].y) * k).toFixed(1));
          break;
        }
        want -= L;
      }
      dot.setAttribute('opacity', 1);
    }
  }
  requestAnimationFrame(frame);
}

/* ── Controls ──────────────────────────────────────────────────── */
const slider = $('#rrOffset');
if (slider){
  slider.addEventListener('input', () => {
    offset = (+slider.value / 100) * MAX_D;
    render();
  });
}
$$('.rr-key-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    keyName = btn.dataset.key;
    $$('.rr-key-btn').forEach(b =>
      b.setAttribute('aria-pressed', String(b === btn)));
    render();
  });
});
const keyToggle = $('#rrKeyed');
if (keyToggle) keyToggle.addEventListener('change', () => { keyed = keyToggle.checked; render(); });

root.classList.add('cy-retro--live');    // reveal the controls now JS is up
render();
if (!reduced) requestAnimationFrame(frame);

})();
