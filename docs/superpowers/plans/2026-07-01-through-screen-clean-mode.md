# Through-the-Screen → Clean Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the first-visit CRT boot so the camera pushes through the monitor glass (growing scanlines/phosphor → electric static bloom) and emerges into a clean, readable, permanently-CRT-free version of the site.

**Architecture:** A single `html.cy-clean` class gates all rendering: when present, the CRT frame/scanlines/glow/glitch/scaled-stage are stripped and a centered readable column applies. Clean is the site's default; the CRT only appears during an active boot run. `boot.js` flips CRT → clean in-place at the end of the cinematic via a new push-through + static-bloom phase.

**Tech Stack:** Jekyll 4.4, vanilla CSS + JS (IIFEs, no frameworks/bundlers), self-hosted fonts.

## Global Constraints

- No frameworks, no bundlers, no CDN dependencies — vanilla CSS/JS only.
- CSP is strict: `font-src 'self'`, `script-src 'self'`, `img-src 'self'`. Any font must be self-hosted under `/assets/fonts/`.
- All JS is IIFEs loaded via `_layouts/default.html`; `boot.js` loads first and sets pre-paint guards on `<html>`.
- Respect `prefers-reduced-motion: reduce`.
- License header on new source files (SPDX BSD-3-Clause), matching existing files.
- No automated test suite — each task's verification is a manual browser check via `bundle exec jekyll serve` (localhost:4000). Use `?boot=1` to force the cinematic and `?boot=0`/localStorage to simulate a returning visitor.

---

### Task 1: Self-host IBM Plex Mono + register the body font

**Files:**
- Create: `assets/fonts/IBMPlexMono-Regular.woff2`, `assets/fonts/IBMPlexMono-Medium.woff2`
- Modify: `assets/css/style.css` (add `@font-face` blocks near the existing ones, ~line 22)

**Interfaces:**
- Produces: CSS font-family `'IBM Plex Mono'` (weights 400, 500) available for clean-mode body copy.

- [ ] **Step 1: Fetch the font files**

```bash
curl -fsSL -o assets/fonts/IBMPlexMono-Regular.woff2 \
  https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2
curl -fsSL -o assets/fonts/IBMPlexMono-Medium.woff2 \
  https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/complete/woff2/IBMPlexMono-Medium.woff2
```

If the download fails (offline/sandbox), FALLBACK: skip the files and register no `@font-face`; in Task 2 the body `font-family` becomes a system monospace stack: `'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`. The stack already lists IBM Plex Mono first, so adding the files later needs no CSS change.

- [ ] **Step 2: Add `@font-face` blocks** (only if files were fetched)

```css
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/assets/fonts/IBMPlexMono-Regular.woff2') format('woff2');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/assets/fonts/IBMPlexMono-Medium.woff2') format('woff2');
}
```

- [ ] **Step 3: Verify** — `bundle exec jekyll build` succeeds; the woff2 files are copied to `_site/assets/fonts/`.

- [ ] **Step 4: Commit**

```bash
git add assets/fonts/IBMPlexMono-*.woff2 assets/css/style.css
git commit -m "feat: self-host IBM Plex Mono for readable clean-mode body text"
```

---

### Task 2: Clean-mode stylesheet (`html.cy-clean`)

**Files:**
- Modify: `assets/css/style.css` (append a new `html.cy-clean` section at the end)

**Interfaces:**
- Consumes: `'IBM Plex Mono'` from Task 1.
- Produces: the class contract — when `html.cy-clean` is present, the page renders as a clean, readable, no-CRT column. Consumed by `boot.js` (Task 3+).

- [ ] **Step 1: Append clean-mode CSS** (end of `style.css`)

```css
/* ════════════════════════════════════════════════════════════════
   CLEAN MODE — the real site once you've come "through the screen".
   No CRT frame, scanlines, glow, or glitch. Readable centered column.
   Gated entirely behind html.cy-clean so CRT rules are untouched.
   ════════════════════════════════════════════════════════════════ */
html.cy-clean,
html.cy-clean body {
  height: auto;
  overflow: visible;
  background: #05070a;
  color: #7dffb0;                    /* softer, high-contrast green */
  font-family: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

/* Kill the fixed CRT stage + frame + scanlines + glitch */
html.cy-clean .terminal-frame,
html.cy-clean #glitchCanvas,
html.cy-clean .cy-egg,
html.cy-clean body::before,
html.cy-clean .terminal-screen::before { display: none !important; }

html.cy-clean .terminal-wrapper { height: auto !important; background: #05070a; overflow: visible; }
html.cy-clean .terminal-container {
  position: static;
  width: 100%;
  height: auto;
  transform: none !important;
  overflow: visible;
  z-index: auto;
}
html.cy-clean .terminal-screen {
  position: static;
  top: auto; left: auto;
  width: 100%;
  max-width: 72ch;
  height: auto;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  background: transparent;
  overflow: visible;
  font-size: 18px;                   /* no counter-scaling in clean mode */
  line-height: 1.6;
}

/* Strip all neon glow */
html.cy-clean .glow,
html.cy-clean .console,
html.cy-clean .project,
html.cy-clean .char,
html.cy-clean .char.foreign,
html.cy-clean a,
html.cy-clean a:hover { text-shadow: none !important; }

/* Readable links + accents (palette kept, glow removed) */
html.cy-clean a { color: #33ffcc; }
html.cy-clean a:hover { color: #ffffff; text-decoration: underline; }

/* Headings keep the VT323 identity */
html.cy-clean h1, html.cy-clean h2, html.cy-clean h3,
html.cy-clean .boot-logo-text {
  font-family: 'VT323', monospace;
  letter-spacing: 1px;
  color: #33ffcc;
}

/* Nav: keep the teal bar, drop the glow/box-shadow */
html.cy-clean nav.console {
  box-shadow: none;
  text-shadow: none;
  background-color: #0a3d3d;
}
html.cy-clean nav.console a { color: #d6fff2; }
html.cy-clean nav.console a:hover { color: #ffffff; }

/* Let long pre content wrap so it stays readable without horizontal scroll */
html.cy-clean pre,
html.cy-clean .console { white-space: pre-wrap; overflow-wrap: anywhere; }
```

- [ ] **Step 2: Verify (temporary)** — run `bundle exec jekyll serve`, open the console DevTools, and manually add the class: `document.documentElement.classList.add('cy-clean')`. Confirm: frame/scanlines/glow gone, content is a centered readable column, links readable, nav is a flat teal bar. Remove the class to confirm CRT returns.

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "feat: add clean-mode stylesheet gated on html.cy-clean"
```

---

### Task 3: Default to clean; CRT only during boot

**Files:**
- Modify: `assets/js/boot.js` (the "Wire up" block ~lines 390-402; `finish()` ~237; `revealSite()` ~210)
- Modify: `assets/js/responsive.js` (`applyScale` ~89 — no-op under clean)

**Interfaces:**
- Consumes: `html.cy-clean` contract (Task 2).
- Produces: on load, `.cy-clean` is on `<html>` before paint for every non-boot render; `boot.js` owns applying/removing it.

- [ ] **Step 1: Pre-paint clean guard in the wire-up block.** Replace the wire-up block so that when NOT booting, `.cy-clean` is set synchronously:

```javascript
  var force = param();
  var shouldBoot = force === true ||
                   (force !== false && isLanding() && !alreadyBooted());

  if (shouldBoot) {
    /* Claim the page synchronously so decode/glitch defer, and hide the
       container before responsive.js positions it (avoids a flash). */
    window.__CY_BOOT_PENDING__ = true;
    document.documentElement.classList.add('cy-booting');
    ready(function () { playBoot(false); });
  } else {
    /* Not booting → render the real (clean) site. Set before first paint so
       the CRT never flashes for returning visitors or deep links. */
    document.documentElement.classList.add('cy-clean');
  }
```

- [ ] **Step 2: Apply clean at the end of a boot run.** In `revealSite()`, add `.cy-clean` to `<html>` at the moment the site is brought up (this replaces reliance on the green CRT screen). For now keep the existing fade; the through-screen visuals come in Task 5:

```javascript
    function revealSite() {
      document.documentElement.classList.add('cy-clean');   /* become the real site */
      document.body.classList.remove('boot-active');
      consoleEl.classList.add('fading');
      setTimeout(function () { finish(consoleEl, off, flash); }, T.siteFade + 200);
    }
```

Remove the `triggerDecode()` call here (decode is a CRT effect — see Task 6).

- [ ] **Step 3: Guard responsive scaling under clean.** In `responsive.js`, make `applyScale` bail when clean so it never re-applies the CRT transform:

```javascript
  function applyScale() {
    if (locked) return;
    if (document.documentElement.classList.contains('cy-clean')) {
      container.style.transform = 'none';
      return;
    }
    var t = finalTransform();
    /* …unchanged… */
  }
```

- [ ] **Step 4: Verify**
  - `localhost:4000/?boot=0` (or after one boot): lands clean immediately, no CRT, no flash. `document.documentElement.classList` contains `cy-clean`.
  - `localhost:4000/blog` fresh (clear `cy_booted`): clean, no boot.
  - `localhost:4000/?boot=1`: CRT boot still plays and ends on a clean page (plain fade for now).
  - Resize the clean page: layout stays a static column (no transform snapping).

- [ ] **Step 5: Commit**

```bash
git add assets/js/boot.js assets/js/responsive.js
git commit -m "feat: render clean site by default; CRT only during boot run"
```

---

### Task 4: `throughTransform()` — the deeper push-in

**Files:**
- Modify: `assets/js/responsive.js` (add `throughTransform`, export it ~line 102)

**Interfaces:**
- Consumes: existing `GLASS_*` constants and the `finalTransform()` scale.
- Produces: `window.CyResponsive.throughTransform()` → `{ css }` — a transform that keeps pushing into the glass, centered on the glass, overshooting the viewport. Consumed by `boot.js` (Task 5).

- [ ] **Step 1: Add `throughTransform`.** It scales up hard, keeping the glass center pinned to the viewport center:

```javascript
  /* Push-through: continue past finalTransform, blowing the glass up so it
     overshoots the viewport, centered on the glass — the "right up to the
     monitor" move before we break through. */
  function throughTransform() {
    var base = finalTransform();
    var vw = window.innerWidth, vh = window.innerHeight;
    var PUSH = 6;                                  /* how far past resting we drive */
    var scale = base.scale * PUSH;
    /* Glass center in unscaled container coords. */
    var gcx = GLASS_LEFT + GLASS_WIDTH / 2;
    var gcy = GLASS_TOP + GLASS_HEIGHT / 2;
    var tx = vw / 2 - gcx * scale;
    var ty = vh / 2 - gcy * scale;
    return {
      scale: scale,
      css: 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')'
    };
  }
```

- [ ] **Step 2: Export it** in the `window.CyResponsive` object:

```javascript
  window.CyResponsive = {
    applyScale: applyScale,
    finalTransform: finalTransform,
    wideTransform: wideTransform,
    throughTransform: throughTransform,
    lock: function() { locked = true; },
    unlock: function() { locked = false; applyScale(); }
  };
```

- [ ] **Step 3: Verify** — in DevTools on a booting page (`?boot=1`), after the log finishes run `document.querySelector('.terminal-container').style.transform = CyResponsive.throughTransform().css`. Confirm the glass blows up and centers (overshoots the viewport) rather than drifting off-screen.

- [ ] **Step 4: Commit**

```bash
git add assets/js/responsive.js
git commit -m "feat: add throughTransform for the push-through-glass move"
```

---

### Task 5: The through-screen phase (push + phosphor mask + static bloom)

**Files:**
- Modify: `assets/js/boot.js` (`T` timeline ~54; `endSequence`/`revealSite` ~199-215; add `pushThroughGlass()`)
- Modify: `assets/css/style.css` (add `.crt-phosphor` overlay + `.crt-static` bloom styles near the boot section, ~line 470)

**Interfaces:**
- Consumes: `CyResponsive.throughTransform()` (Task 4); `.cy-clean` (Task 2/3); existing `--glass-*` vars.
- Produces: replaces the `blank → revealSite` tail with `hold → push → static bloom → clean emerge`.

- [ ] **Step 1: Add timeline constants** to the `T` object:

```javascript
    holdAfterBoot:  3200,   /* finished boot held before the push begins */
    pushDur:        1600,   /* push through the glass (scanlines/phosphor grow) */
    staticHold:      450,   /* electric static covers the frame at contact */
    cleanFade:       900    /* clean page fades up as the static clears */
```

(Keep existing constants; `blankHold`/`siteFade` are now unused by the new tail — leave them for reduced-motion path or remove if unreferenced.)

- [ ] **Step 2: Add phosphor + static CSS** (near the boot styles):

```css
/* Push-through: a phosphor/aperture mask + fat scanlines that grow in over the
   enlarging boot text as the camera drives into the glass. Confined to glass. */
.crt-phosphor {
  position: absolute;
  top: var(--glass-top); left: var(--glass-left);
  right: var(--glass-right); bottom: var(--glass-bottom);
  z-index: 90002;
  pointer-events: none;
  opacity: 0;
  background:
    repeating-linear-gradient(to bottom,
      rgba(0,0,0,0.55) 0, rgba(0,0,0,0.55) 2px,
      transparent 2px, transparent 6px),
    repeating-linear-gradient(to right,
      rgba(255,0,80,0.20) 0, rgba(255,0,80,0.20) 2px,
      rgba(0,255,120,0.20) 2px, rgba(0,255,120,0.20) 4px,
      rgba(60,120,255,0.20) 4px, rgba(60,120,255,0.20) 6px);
  background-size: 100% 100%, 6px 6px;
  transition: opacity 0.5s ease-in, background-size 1.6s cubic-bezier(0.5,0,0.9,1);
}
.crt-phosphor.grow {
  opacity: 1;
  /* fat scanlines + big phosphor cells as we push right up to the tube */
  background-size: 100% 22px, 42px 42px;
}

/* Electric static bloom canvas — fired at contact, then fades to reveal clean. */
.crt-static {
  position: absolute;
  top: var(--glass-top); left: var(--glass-left);
  right: var(--glass-right); bottom: var(--glass-bottom);
  z-index: 90003;
  pointer-events: none;
  opacity: 0;
}
.crt-static.fire { opacity: 1; }
.crt-static.clear { transition: opacity 0.9s ease-out; opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .crt-phosphor, .crt-static { display: none; }
}
```

- [ ] **Step 3: Build the static canvas + push logic.** Add a `pushThroughGlass()` and rewire `endSequence`. Replace the current `endSequence`/`revealSite` with:

```javascript
    /* Boot log finished → hold, then push the camera through the glass. */
    function endSequence() {
      setTimeout(pushThroughGlass, T.holdAfterBoot);
    }

    /* Drive the deeper zoom while the phosphor/scanline mask grows, then bloom
       into electric static and emerge onto the clean site. */
    function pushThroughGlass() {
      var R = window.CyResponsive;

      /* Phosphor + fat-scanline mask over the (enlarging) boot text. */
      var phosphor = el('div', 'crt-phosphor');
      screen.appendChild(phosphor);
      requestAnimationFrame(function () { phosphor.classList.add('grow'); });

      /* Keep driving the container transform deeper into the glass. */
      container.style.transition =
        'transform ' + T.pushDur + 'ms cubic-bezier(0.5, 0, 0.9, 1)';
      requestAnimationFrame(function () {
        if (R) container.style.transform = R.throughTransform().css;
      });

      /* At contact: fire the electric static, swap to clean underneath. */
      setTimeout(fireStatic, T.pushDur);
    }

    function fireStatic() {
      var canvas = el('canvas', 'crt-static');
      screen.appendChild(canvas);
      var raf = paintStatic(canvas);          /* animate noise */
      canvas.classList.add('fire');

      /* Swap the world to clean while the static is opaque. */
      setTimeout(function () {
        document.documentElement.classList.add('cy-clean');
        document.body.classList.remove('boot-active');
        if (consoleEl) consoleEl.style.display = 'none';
        canvas.classList.add('clear');        /* fade static → reveal clean */
        setTimeout(function () {
          if (raf) cancelAnimationFrame(raf.id);
          finish(consoleEl, off, flash);
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          if (document.querySelector('.crt-phosphor')) {
            var p = document.querySelector('.crt-phosphor');
            p.parentNode && p.parentNode.removeChild(p);
          }
        }, T.cleanFade);
      }, T.staticHold);
    }

    /* Electric stylized static: white-noise with blue-white + green flecks. */
    function paintStatic(canvas) {
      var ctx = canvas.getContext('2d');
      var rect = canvas.getBoundingClientRect();
      var w = canvas.width = Math.max(160, Math.floor(rect.width / 3));
      var h = canvas.height = Math.max(120, Math.floor(rect.height / 3));
      var handle = { id: 0 };
      (function frame() {
        var img = ctx.createImageData(w, h);
        var d = img.data;
        for (var i = 0; i < d.length; i += 4) {
          var v = (Math.random() * 255) | 0;
          var green = Math.random() < 0.08;        /* green flecks */
          d[i]     = green ? 40 : v;               /* R */
          d[i + 1] = green ? 255 : v;              /* G */
          d[i + 2] = green ? 120 : Math.min(255, v + 40); /* B tint → electric */
          d[i + 3] = 235;
        }
        ctx.putImageData(img, 0, 0);
        handle.id = requestAnimationFrame(frame);
      })();
      return handle;
    }
```

Note: `Math.random()` is used for the static — this runs in the browser (allowed), not in a Workflow script.

- [ ] **Step 4: Verify** (`localhost:4000/?boot=1`)
  - Boot log finishes → holds a beat → the view pushes into the glass while thick scanlines + phosphor cells grow over the swelling text.
  - At contact, an electric blue-white static (with green flecks) blooms over the screen.
  - Static fades → clean readable page underneath. No CRT frame remains.
  - `cy_booted` is set; reload → clean directly.

- [ ] **Step 5: Commit**

```bash
git add assets/js/boot.js assets/css/style.css
git commit -m "feat: push through the glass into electric static, emerge clean"
```

---

### Task 6: Gate CRT effects off in clean + D-key replay

**Files:**
- Modify: `assets/js/boot.js` (`finish()` ~237 — don't start glitch/decode in clean; add D-key handler in wire-up)
- Modify: `assets/js/decode.js` and `assets/js/video_glitch.js` (bail if `cy-clean`)

**Interfaces:**
- Consumes: `.cy-clean`, `window.CyBoot.replay()`.
- Produces: no CRT decode/glitch in clean mode; **D** key replays the cinematic from clean.

- [ ] **Step 1: Don't restart CRT effects in clean.** In `finish()`, guard the tail effects:

```javascript
    if (!document.documentElement.classList.contains('cy-clean')) {
      if (window.CyGlitch && window.CyGlitch.start) window.CyGlitch.start();
      triggerDecode();
    }
    running = false;
```

- [ ] **Step 2: Bail decode/glitch under clean.** At the top of the start path in each of `decode.js` and `video_glitch.js`, add an early return when clean. For `video_glitch.js`'s `start()` and `decode.js`'s `start()`/`replay()`:

```javascript
  if (document.documentElement.classList.contains('cy-clean')) return;
```

(Place inside the exposed `start`/`replay` functions so the deferred-until-boot path is unaffected.)

- [ ] **Step 3: D-key replay from clean.** In `boot.js` wire-up, add:

```javascript
  ready(function () {
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (e.key === 'd' || e.key === 'D') {
        document.documentElement.classList.remove('cy-clean');
        playBoot(true);
      }
    });
  });
```

- [ ] **Step 4: Verify**
  - Clean page: no glitch lines, no decode scramble on load.
  - Press **D** on a clean page → CRT reappears and the full cinematic replays, ending clean again.
  - Typing `d` inside a text field does NOT trigger replay (test on `/blog` search box).

- [ ] **Step 5: Commit**

```bash
git add assets/js/boot.js assets/js/decode.js assets/js/video_glitch.js
git commit -m "feat: disable CRT effects in clean mode; add D-key replay"
```

---

### Task 7: Reduced-motion path + final verification sweep

**Files:**
- Modify: `assets/js/boot.js` (`reducedReveal` ~229 — go straight to clean)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Reduced-motion goes straight to clean.** In `reducedReveal`, apply clean and skip cinematics:

```javascript
  function reducedReveal(consoleEl, off, flash) {
    document.documentElement.classList.add('cy-clean');
    if (off) off.parentNode && off.parentNode.removeChild(off);
    if (flash) flash.parentNode && flash.parentNode.removeChild(flash);
    if (consoleEl) consoleEl.parentNode && consoleEl.parentNode.removeChild(consoleEl);
    finish();
  }
```

- [ ] **Step 2: Full verification sweep** (`bundle exec jekyll serve`):
  - First visit `/` (clear `cy_booted`): full cinematic → push → static → clean.
  - Reload `/`: clean immediately, no flash.
  - `/blog`, `/projects`, `/about` fresh: clean, readable, no CRT.
  - `?boot=1`: forces cinematic even when booted; ends clean.
  - DevTools → emulate `prefers-reduced-motion: reduce`, `?boot=1`: no push/static, lands clean.
  - Phone width (DevTools responsive, ~390px): clean column readable; boot (if forced) still pushes through.
  - Press **D** on clean: replays.

- [ ] **Step 3: Commit**

```bash
git add assets/js/boot.js
git commit -m "feat: reduced-motion goes straight to clean mode"
```

---

## Self-Review Notes

- **Spec coverage:** extended hold (T5), push-through with growing scanlines/phosphor (T4/T5), electric static bloom (T5), emerge clean (T3/T5), clean = whole-site default (T2/T3), IBM Plex Mono body (T1), VT323 headings (T2), D-key replay (T6), reduced-motion (T7), no-flash returning visitor (T3), decode/glitch gated off (T6). All spec sections mapped.
- **Type/name consistency:** `throughTransform` used identically in responsive.js (T4) and boot.js (T5); `.cy-clean`, `.crt-phosphor`, `.crt-static` names consistent across CSS and JS.
- **Fallback captured:** font download failure degrades to a system monospace stack with no CSS change (T1).
