/* Background knockout for the gallery plates.
 *
 * Every plate wants the same thing: the subject standing on THE BOOTH's
 * field with nothing of its original surroundings left. There is no
 * ImageMagick, Pillow or rembg on the build machine, so the isolation
 * happens here, in a canvas, at render time.
 *
 * The method is a flood fill inward from the frame edges. That choice is
 * what makes one function cover subjects as different as a black camera on
 * a bright floor, a bright drive in a dark rack and a green-suited figure
 * on a green wall: in all three the BACKGROUND is the connected region
 * touching the border, whatever colour it happens to be. Keying on colour
 * instead would need a different key per image and would still cut holes in
 * any subject that shares a tone with its surroundings.
 *
 * Two tolerances, because one is never enough:
 *   tol      how far a pixel may drift from its already-accepted NEIGHBOUR.
 *            Small. This is what lets the fill ride a gradient — a lit
 *            wooden floor, a vignetted wall — without stopping halfway.
 *   hardTol  how far a pixel may drift from the SEED colour, ever. This is
 *            the leash on the above: without it a gradient walk eventually
 *            arrives at the subject and eats it.
 *
 * Then erode + feather. The erode exists because a flood fill stops one
 * pixel short of the true edge and leaves a rim of background colour that
 * reads as a halo once the subject is composited onto a darker field.
 */
window.CyMatte = (function () {
  'use strict';

  function idx(x, y, w) { return (y * w + x) * 4; }

  /* Squared distance keeps the inner loop free of Math.sqrt; every
     tolerance the callers pass is squared once, here, to match. */
  function dist2(d, a, b) {
    const dr = d[a] - d[b], dg = d[a + 1] - d[b + 1], db = d[a + 2] - d[b + 2];
    return dr * dr + dg * dg + db * db;
  }

  function dist2c(d, a, c) {
    const dr = d[a] - c[0], dg = d[a + 1] - c[1], db = d[a + 2] - c[2];
    return dr * dr + dg * dg + db * db;
  }

  /* Single-pass box blur over the alpha plane only. Separable, so it runs
     as a horizontal pass then a vertical one. */
  function blurAlpha(alpha, w, h, r) {
    /* Rounded because r indexes typed arrays directly: a fractional radius
       walks the window over indices like 0.5, which read back undefined and
       poison the whole plane with NaN. The failure is silent and total —
       every alpha lands on 0 and the subject vanishes completely — so it
       looks exactly like a tolerance that ate the image, and is not. */
    r = Math.round(r);
    if (r < 1) return alpha;
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    const div = r * 2 + 1;
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += alpha[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / div;
        sum -= alpha[y * w + Math.min(w - 1, Math.max(0, x - r))];
        sum += alpha[y * w + Math.min(w - 1, Math.max(0, x + r + 1))];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / div;
        sum -= tmp[Math.min(h - 1, Math.max(0, y - r)) * w + x];
        sum += tmp[Math.min(h - 1, Math.max(0, y + r + 1)) * w + x];
      }
    }
    return out;
  }

  /* Grow the background mask by `r` pixels. Called before the feather so
     the blur has clean opaque pixels to ramp from rather than the rim of
     background colour the fill leaves behind. */
  function erode(bg, w, h, r) {
    r = Math.round(r);
    let cur = bg;
    for (let pass = 0; pass < r; pass++) {
      const next = new Uint8Array(cur);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (cur[y * w + x]) continue;
          if ((x > 0 && cur[y * w + x - 1]) || (x < w - 1 && cur[y * w + x + 1]) ||
              (y > 0 && cur[(y - 1) * w + x]) || (y < h - 1 && cur[(y + 1) * w + x])) {
            next[y * w + x] = 1;
          }
        }
      }
      cur = next;
    }
    return cur;
  }

  /* opts:
   *   seeds     [[x,y], ...] in 0..1 of width/height. Default: the corners.
   *   seedEdges 'l','r','t','b' in any combination, e.g. 'lr'. Seeds EVERY
   *             pixel along those borders, each carrying its own reference
   *             colour. Use it when the background is several unrelated
   *             colours — a pale cloth, a wood floor, a shadow — that no
   *             single fill can cross between without a tolerance loose
   *             enough to also enter the subject. Name only the borders the
   *             subject does not touch: a seed that lands ON the subject
   *             fills it from the inside and deletes it.
   *   tol       drift allowed from an accepted neighbour (0-255 per channel)
   *   hardTol   drift allowed from the seed colour, ever
   *   erode     px of mask growth before feathering, to kill the edge halo
   *   feather   px of alpha blur
   *   crop      [x,y,w,h] in 0..1 of the source frame, applied BEFORE the
   *             fill. Some frames carry a second dark object touching the
   *             border that is nowhere near the background colour, so the
   *             fill leaves it floating; cropping it away is cheaper and
   *             more predictable than trying to widen a tolerance far
   *             enough to swallow it without also swallowing the subject.
   *   despill   0-1; pulls a colour cast out of the surviving edge pixels.
   *             Green-screen plates need it or the subject keeps a rim of
   *             wall colour that no amount of feathering hides.
   *   spillHue  'green' (only hue that needs it so far)
   */
  function knockout(img, opts) {
    opts = opts || {};
    const tol = (opts.tol != null ? opts.tol : 26);
    const hardTol = (opts.hardTol != null ? opts.hardTol : 90);
    const erodeR = Math.round(opts.erode != null ? opts.erode : 2);
    const featherR = Math.round(opts.feather != null ? opts.feather : 2);
    const despill = opts.despill || 0;

    const cr = opts.crop || [0, 0, 1, 1];
    const sx = Math.round(cr[0] * img.naturalWidth);
    const sy = Math.round(cr[1] * img.naturalHeight);
    const sw = Math.round(cr[2] * img.naturalWidth);
    const sh = Math.round(cr[3] * img.naturalHeight);

    const w = sw, h = sh;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const im = ctx.getImageData(0, 0, w, h);
    const d = im.data;

    const seedList = (opts.seeds || [[0, 0], [1, 0], [0, 1], [1, 1]]).slice();
    if (opts.seedEdges) {
      const e = opts.seedEdges;
      for (let y = 0; y < h; y++) {
        if (e.indexOf('l') >= 0) seedList.push([0, y / (h - 1)]);
        if (e.indexOf('r') >= 0) seedList.push([1, y / (h - 1)]);
      }
      for (let x = 0; x < w; x++) {
        if (e.indexOf('t') >= 0) seedList.push([x / (w - 1), 0]);
        if (e.indexOf('b') >= 0) seedList.push([x / (w - 1), 1]);
      }
    }
    const seeds = seedList.map(function (s) {
      return [
        Math.min(w - 1, Math.max(0, Math.round(s[0] * (w - 1)))),
        Math.min(h - 1, Math.max(0, Math.round(s[1] * (h - 1))))
      ];
    });

    const tol2 = tol * tol * 3;
    const hard2 = hardTol * hardTol * 3;

    const bg = new Uint8Array(w * h);
    /* A plain array used as a stack beats a queue here: depth-first keeps
       the working set small on the large uniform regions these plates have. */
    const stack = [];

    seeds.forEach(function (s) {
      const si = idx(s[0], s[1], w);
      const seedColor = [d[si], d[si + 1], d[si + 2]];
      const p0 = s[1] * w + s[0];
      if (!bg[p0]) { bg[p0] = 1; stack.push(p0, si); }
      while (stack.length) {
        const from = stack.pop();
        const p = stack.pop();
        const px = p % w, py = (p - px) / w;
        const nb = [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]];
        for (let k = 0; k < 4; k++) {
          const nx = nb[k][0], ny = nb[k][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (bg[np]) continue;
          const ni = np * 4;
          if (dist2(d, ni, from) > tol2) continue;
          if (dist2c(d, ni, seedColor) > hard2) continue;
          bg[np] = 1;
          stack.push(np, ni);
        }
      }
    });

    const grown = erodeR > 0 ? erode(bg, w, h, erodeR) : bg;

    let alpha = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = grown[i] ? 0 : 255;
    alpha = blurAlpha(alpha, w, h, featherR);

    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      d[o + 3] = alpha[i];
      if (despill && alpha[i] > 0) {
        /* Clamp green to the average of the other two channels and mix back
           by `despill`, which is the cheap standard fix and enough here. */
        const r = d[o], g = d[o + 1], b = d[o + 2];
        const cap = (r + b) / 2;
        if (g > cap) d[o + 1] = g + (cap - g) * despill;
      }
    }

    ctx.putImageData(im, 0, 0);
    return c;
  }

  /* Plates declare their subject as <img data-matte='{...}'> and this
     swaps in the cut-out. Returning a promise lets build.sh wait for a
     signal rather than guess at a delay. */
  function run() {
    const imgs = Array.prototype.slice.call(document.querySelectorAll('img[data-matte]'));
    return Promise.all(imgs.map(function (img) {
      return (img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise(function (res) { img.onload = res; img.onerror = res; })
      ).then(function () {
        if (!img.naturalWidth) return;
        const cut = knockout(img, JSON.parse(img.dataset.matte || '{}'));
        img.src = cut.toDataURL('image/png');
        return new Promise(function (res) { img.onload = res; });
      });
    }));
  }

  return { knockout: knockout, run: run };
})();
