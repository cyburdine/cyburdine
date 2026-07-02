/* SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause

   CRT boot sequence — landing page, first visit only.
   Cold start (black) → wide shot of the whole console → zoom into the
   monitor → CRT power-on flash → Cyburdine Systems boot log → hands the
   page off to the live site (and its decode effect).

   Loaded BEFORE decode.js so __CY_BOOT_PENDING__ is set before decode's
   load handler runs.
*/
(function () {
  'use strict';

  /* ── Should the boot play? ─────────────────────────────────────────
     Landing page + first visit, unless overridden by ?boot=1 / ?boot=0
     (handy for re-watching during development). */
  var STORAGE_KEY = 'cy_booted';

  function param() {
    var m = /[?&]boot=([^&]*)/.exec(window.location.search);
    if (m) return m[1] === '0' ? false : true;
    if (/[?&]boot(?=&|$)/.test(window.location.search)) return true;
    if (window.__CY_FORCE_BOOT__ === true) return true;
    return null;
  }

  function isLanding() {
    var p = window.location.pathname;
    return p === '/' || p === '/index.html' ||
           /\/preview\.html$/.test(p);   /* local static preview harness */
  }

  function alreadyBooted() {
    try { return window.localStorage.getItem(STORAGE_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markBooted() {
    try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  var REDUCE = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var running = false;        /* a boot run is in progress */
  var replaying = false;      /* this run is an easter-egg replay, not first load */
  var decodeTriggered = false;

  /* ── Timeline (ms) ─────────────────────────────────────────────────
     black → wide shot → push-in → (pause) → power-on → boot log →
     (pause) → screen blank → (pause) → site fades in. The end of the boot
     log chains the rest via a callback, so it stays in sync with the log. */
  var T = {
    coldFade:       1000,   /* black → wide shot fades in */
    zoomStart:      1000,   /* begin push-in */
    zoomDur:        1500,   /* push-in duration (ends at 2500) */
    pauseAfterZoom: 1000,   /* hold on the dark, fully zoomed-in monitor */
    powerFlash:      300,   /* flash bloom before the screen reads "on" */
    warmupDelay:    2000,   /* monitor on (empty) → logo warms in */
    logoShowHold:   2000,   /* logo centered (incl. warm-up) before it slides up */
    slideDur:        600,   /* logo slide-to-top duration */
    preTextGap:     1000,   /* logo reaches top → boot text begins */
    holdAfterBoot:  1400,   /* finished boot log held before the screen clears */
    /* ── Old-computer CLEAR + REDRAW (no dissolve) ── */
    clearDur:        550,   /* erase the boot log top→down */
    clearBlank:      280,   /* blank screen beat after the clear */
    redrawDur:       800,   /* draw the site back in, line-by-line */
    sitePrehold:    1200,   /* site shown in the tube before we zoom into a char */
    /* ── Continuous zoom into the glow → pass through → zoom out (charZoom) ── */
    zoomInDur:      3800,   /* SLOW continuous zoom the whole way into the glow */
    crossRamp:      1400,   /* before the apex: scanlines glow+blur to immense */
    zoomOutDur:     2600,   /* continuous zoom back out to the full clean page */
    blankHold:      1000,   /* (legacy) tube blank hold — reduced-motion path */
    siteFade:        900    /* (legacy) main-page fade-in */
  };

  /* ── DOM helpers ───────────────────────────────────────────────── */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* Put a blinking cursor inline right after the LAST character of the page
     content — hugging the last line, as if it was just typed. */
  function placeCursor() {
    var main = document.querySelector('main');
    if (!main) return;
    var old = main.querySelector('.cy-cursor');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
    var last = null, node;
    while ((node = walker.nextNode())) { if (/\S/.test(node.nodeValue)) last = node; }

    var cursor = document.createElement('span');
    cursor.className = 'cy-cursor';
    cursor.textContent = '█';                 /* █ */
    if (last) {
      last.nodeValue = last.nodeValue.replace(/\s+$/, '');   /* drop trailing whitespace so it hugs the text */
      if (last.nextSibling) last.parentNode.insertBefore(cursor, last.nextSibling);
      else last.parentNode.appendChild(cursor);
    } else {
      main.appendChild(cursor);
    }
  }

  /* ── Run one boot sequence (initial load or easter-egg replay). ──── */
  function playBoot(isReplay) {
    if (running) return;            /* ignore overlapping triggers */
    running = true;
    replaying = !!isReplay;
    decodeTriggered = false;
    document.documentElement.classList.add('cy-booting');   /* hide before wide shot */

    var wrapper   = document.querySelector('.terminal-wrapper');
    var container = document.querySelector('.terminal-container');
    var screen    = document.querySelector('.terminal-screen');

    if (!wrapper || !container || !screen) { finish(); return; }

    document.body.classList.add('boot-active');

    /* Build the boot console, the black "off" sheet, and the flash. */
    var consoleEl = buildConsole();
    var off   = el('div', 'crt-off');
    var flash = el('div', 'crt-flash');
    screen.appendChild(consoleEl);
    screen.appendChild(off);
    screen.appendChild(flash);

    if (REDUCE) { reducedReveal(consoleEl, off, flash); return; }

    var R = window.CyResponsive;

    /* Lock the responsive scaler and pin the stage to the full viewport
       so the wide shot isn't clipped. */
    if (R) R.lock();
    wrapper.style.height = window.innerHeight + 'px';

    /* Position the wide shot instantly, still invisible. Commit it with a
       reflow BEFORE arming the transition, otherwise the browser treats the
       final→wide jump as a pending change and animates it during the fade. */
    if (R) {
      var wide = R.wideTransform();
      container.style.transformOrigin = 'top left';
      container.style.transform = wide.css;
    }
    void container.offsetWidth;                 /* commit the wide baseline */

    /* Arm a single transition that covers BOTH the cold fade (opacity) and
       the push-in (transform). Declaring transform here is what makes the
       zoom animate — an inline `transition: opacity` alone would override
       any CSS transform-transition and the zoom would snap. */
    container.style.transition =
      'opacity ' + T.coldFade + 'ms ease-out, ' +
      'transform ' + T.zoomDur + 'ms cubic-bezier(0.45, 0.05, 0.25, 1)';

    /* Drive the timeline. Starts only once the frame image has decoded, so
       the fade-up doesn't pop when the bezel suddenly finishes loading. */
    function runTimeline() {
      /* Cold start: fade the wide shot in from black (next frame so the
         transition has a rendered opacity:0 to start from). */
      requestAnimationFrame(function () { container.style.opacity = '1'; });

      /* Zoom in to the monitor. */
      setTimeout(function () {
        if (R) container.style.transform = R.finalTransform().css;
      }, T.zoomStart);

      var zoomEnd  = T.zoomStart + T.zoomDur;
      var powerAt  = zoomEnd + T.pauseAfterZoom;   /* wait a beat after zoom */
      var revealAt = powerAt + T.powerFlash;

      /* After the zoom stops and a 1s pause, power the CRT on. */
      setTimeout(function () { flash.classList.add('fire'); }, powerAt);

      /* Screen reads "on": drop the black sheet, flicker the tube, and ONLY NOW
         let the glitch lines run — no random lines on a dark/off monitor. The
         screen sits empty (warming) for a beat before the logo appears. */
      setTimeout(function () {
        off.style.display = 'none';
        consoleEl.classList.add('powered');
        if (window.CyGlitch && window.CyGlitch.start) window.CyGlitch.start();
      }, revealAt);

      /* After the warm-up delay, the logo fades in centered (like the tube
         warming up). */
      setTimeout(function () {
        consoleEl.classList.add('logo-in');
      }, revealAt + T.warmupDelay);

      /* The logo slides up to the top — before any boot text appears. */
      var slideAt = revealAt + T.warmupDelay + T.logoShowHold;
      setTimeout(slideLogoToTop, slideAt);

      /* A beat after it reaches the top, the boot text starts loading. */
      setTimeout(startBootText, slideAt + T.slideDur + T.preTextGap);
    }

    /* Slide the centered logo to the top (FLIP). The boot body stays hidden. */
    function slideLogoToTop() {
      var logo = consoleEl.querySelector('.boot-logo-wrap');
      var firstTop = logo.offsetTop;                 /* local (unscaled) coords */
      consoleEl.classList.remove('intro');           /* center → top (body still hidden) */
      var lastTop = logo.offsetTop;
      var dy = firstTop - lastTop;
      if (dy) {
        logo.style.transition = 'none';
        logo.style.transform = 'translateY(' + dy + 'px)';
        requestAnimationFrame(function () {
          logo.style.transition = 'transform ' + T.slideDur + 'ms ease';
          logo.style.transform = 'translateY(0)';
        });
      }
    }

    /* Reveal the BIOS header + log under the logo; when the log finishes, run
       the blank → site handoff. */
    function startBootText() {
      consoleEl.classList.add('show-body');
      runBootLog(consoleEl, endSequence);
    }

    /* Boot log finished → hold, then load the real site INTO the tube. */
    function endSequence() {
      setTimeout(loadSiteInTube, T.holdAfterBoot);
    }

    /* Stage 1 — CLEAR then REDRAW (old-computer style, NOT a dissolve). The
       finished boot log is erased top→down, the screen holds blank a beat, then
       the real site is drawn back in line-by-line. */
    function loadSiteInTube() {
      if (consoleEl) consoleEl.classList.add('cy-clearing');   /* erase the boot log */
      setTimeout(function () {
        if (consoleEl && consoleEl.parentNode) consoleEl.parentNode.removeChild(consoleEl);
      }, T.clearDur);

      setTimeout(function () {
        /* Draw the site back in (CRT skin on, clean font so nothing re-typesets). */
        document.documentElement.classList.add('cy-reveal', 'cy-redraw');
        document.body.classList.remove('boot-active');
        setTimeout(function () {
          document.documentElement.classList.remove('cy-redraw');
        }, T.redrawDur + 80);
        setTimeout(charZoom, T.redrawDur + T.sitePrehold);
      }, T.clearDur + T.clearBlank);
    }

    /* Stage 2 — ZOOM INTO A CHARACTER OF THE REAL PAGE, distort it electronically
       ("through the screen"), then zoom back out to the clean site. It's ONE
       continuous container move: whole site → deep into one glyph → (glitch +
       de-skin at the hold) → back out to the clean column. The clean layout is
       applied at rest (landCleanChar), so no reflow happens mid-motion. */
    function charZoom() {
      var R = window.CyResponsive;
      var content = screen.querySelector('main') || screen;
      var ft = R ? R.finalTransform() : { scale: 1, x: 0, y: 0 };

      /* Focal character = first glyph of the heading, wrapped so we can measure it. */
      var heading = screen.querySelector('h1, h2, h3') || content;
      var focal = wrapFirstChar(heading) || content;
      var charTube = focal.getBoundingClientRect();

      /* Measure main in the tube (now) and in the clean column (toggle cy-clean
         synchronously — no paint between, so no flash). */
      var mainTube = content.getBoundingClientRect();
      document.documentElement.classList.add('cy-clean');
      var keepT = container.style.transform, keepTr = container.style.transition;
      container.style.transition = 'none';
      container.style.transform  = 'none';
      var mainClean = content.getBoundingClientRect();
      document.documentElement.classList.remove('cy-clean');
      container.style.transition = keepTr;
      container.style.transform  = keepT;

      /* Container transform (top-left origin, tube basis) landing main at a rect. */
      var Lx = (mainTube.left - ft.x) / ft.scale, Ly = (mainTube.top - ft.y) / ft.scale;
      function place(TL, TT, W) {
        var S = ft.scale * (W / mainTube.width);
        return 'translate(' + (TL - S * Lx) + 'px,' + (TT - S * Ly) + 'px) scale(' + S + ')';
      }
      var landT  = place(mainClean.left, mainClean.top, mainClean.width);/* clean column at rest */

      /* Pin the letter's TOP-LEFT corner where it is and scale ABOUT it (see
         about() below), so the upper-left stays fixed as we zoom into the glyph
         — its green glow grows from that corner to fill the screen rather than
         the page panning to re-centre. The anchor sits ON the glyph's stroke
         (near its upper-left) so the glow fills around the fixed point, not an
         empty bounding-box corner. */
      var apx = charTube.left + charTube.width * 0.2;
      var apy = charTube.top  + charTube.height * 0.42;
      /* So deep the glyph is ~5.5× the viewport tall → its glow fills the space. */
      var Sdeep = ft.scale * (5.5 * window.innerHeight / charTube.height);

      var zin = T.zoomInDur, zout = T.zoomOutDur, ramp = T.crossRamp;
      var total = zin + zout, offApex = zin / total;

      /* ONE continuous move, FINELY sampled for smoothness. Two ideas:
         · scale changes EXPONENTIALLY (constant ratio) so the zoom is
           perceptually steady rather than rushing then crawling;
         · time is eased (smoothstep) so it starts from rest, glides through the
           apex turnaround at ~0 velocity (hidden by the glow), and settles onto
           the page — no abrupt start and no velocity kink at the seam.
         Many small steps mean the linear tween between them reads as one smooth
         curve. */
      function tstr(st) { return 'translate(' + st.Tx + 'px,' + st.Ty + 'px) scale(' + st.S + ')'; }
      function about(sc) {
        return { S: sc, Tx: apx - sc * (apx - ft.x) / ft.scale, Ty: apy - sc * (apy - ft.y) / ft.scale };
      }
      function ss(x) { return x * x * (3 - 2 * x); }                 /* smoothstep */
      function lerp(a, b, e) {
        return { S: a.S + (b.S - a.S) * e, Tx: a.Tx + (b.Tx - a.Tx) * e, Ty: a.Ty + (b.Ty - a.Ty) * e };
      }

      var S1 = ft.scale * (mainClean.width / mainTube.width);        /* landing scale */
      var land  = { S: S1, Tx: mainClean.left - S1 * Lx, Ty: mainClean.top - S1 * Ly };
      var apexS = about(Sdeep);

      var frames = [], Nin = 22, Nout = 18;
      /* zoom IN: whole page → deep into the glow (exponential scale, eased time). */
      for (var i = 0; i <= Nin; i++) {
        var u = i / Nin;
        var sc = ft.scale * Math.pow(Sdeep / ft.scale, ss(u));
        frames.push({ transform: tstr(about(sc)), offset: offApex * u, easing: 'linear' });
      }
      /* zoom OUT: deep glow → clean column (exponential scale via g, eased time). */
      for (var j = 1; j <= Nout; j++) {
        var v = j / Nout;
        var scv = Sdeep * Math.pow(S1 / Sdeep, ss(v));
        var g = (S1 - Sdeep) !== 0 ? (scv - Sdeep) / (S1 - Sdeep) : v;
        frames.push({ transform: tstr(lerp(apexS, land, g)), offset: offApex + (1 - offApex) * v, easing: 'linear' });
      }

      container.style.willChange = 'transform';
      container.style.transition = 'none';
      container.animate(frames, { duration: total, fill: 'forwards' });

      /* Approaching the apex: CRT scanlines glow + blur more and more, and the
         letter's glow surges immense — "passing through the screen". */
      setTimeout(function () {
        var sb = el('div', 'cy-scanbloom');
        document.body.appendChild(sb);
        content.classList.add('cy-bloom-in');
        setTimeout(function () {
          if (sb.parentNode) sb.parentNode.removeChild(sb);
          content.classList.remove('cy-bloom-in');
          content.style.filter = '';
        }, 2700);
      }, zin - ramp);

      /* At the apex (inside the immense glow): melt the CRT skin so we emerge to
         a clean letter, with a light burst + a burst of digital noise — like
         passing INTO the monitor. */
      setTimeout(function () {
        document.documentElement.classList.add('cy-dissolve');
        var flash = el('div', 'cy-flash');
        document.body.appendChild(flash);
        setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 900);
        var noise = fireNoise();
        setTimeout(function () {
          noise.stop = true;
          if (noise.id) cancelAnimationFrame(noise.id);
          if (noise.el.parentNode) noise.el.parentNode.removeChild(noise.el);
        }, 820);
      }, zin);

      /* The chrome (nav) re-lays-out between the tube and the clean column, so
         fade it out over the end of the zoom-out; only `main` (which lands
         exactly) carries through the swap, then the chrome fades back in. This
         is what turns the landing from a jump-cut into a seamless arrival. */
      setTimeout(function () {
        var nav = screen.querySelector('header');
        if (nav) { nav.style.transition = 'opacity 450ms ease'; nav.style.opacity = '0'; }
      }, total - 480);

      setTimeout(function () { landCleanChar(landT); }, total + 60);   /* zoom-out done → clean layout at rest */
    }

    /* Motion has stopped at the column. Swap to the real clean layout at rest so
       the reflow can't drop frames and the content is already in place. */
    function landCleanChar(landT) {
      container.style.transition = 'none';
      container.style.transform  = landT;
      if (container.getAnimations) {
        container.getAnimations().forEach(function (a) { a.cancel(); });
      }
      var g = screen.querySelector('.cy-glitch');
      if (g) { g.classList.remove('cy-glitch'); g.style.filter = g.style.transform = g.style.opacity = ''; }
      document.documentElement.classList.add('cy-clean');
      document.documentElement.classList.remove('cy-reveal', 'cy-dissolve');
      container.style.transform  = 'none';
      container.style.willChange = '';

      /* Fade the chrome (nav + footer) into their clean positions so their
         layout change is never a visible jump. */
      var nav = screen.querySelector('header');
      var foot = document.querySelector('footer');
      [nav, foot].forEach(function (n) {
        if (!n) return;
        n.style.transition = 'none';
        n.style.opacity = '0';
        requestAnimationFrame(function () {
          n.style.transition = 'opacity 700ms ease';
          n.style.opacity = '1';
          setTimeout(function () { n.style.transition = n.style.opacity = ''; }, 760);
        });
      });

      finish(consoleEl, off, flash);
    }

    /* Wrap the first non-space character of `elm` in a <span> and return it, so
       its box can be measured as the zoom focal point. */
    function wrapFirstChar(elm) {
      var walker = document.createTreeWalker(elm, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var i = node.nodeValue.search(/\S/);
        if (i >= 0) {
          var rest = node.splitText(i);
          var span = document.createElement('span');
          span.textContent = rest.nodeValue.charAt(0);
          rest.nodeValue = rest.nodeValue.slice(1);
          rest.parentNode.insertBefore(span, rest);
          return span;
        }
      }
      return null;
    }

    /* A full-screen canvas of animated digital noise (TV static) — fired with the
       flash so the pass-through feels like plunging INTO the monitor. */
    function fireNoise() {
      var cv = el('canvas', 'cy-noise');
      document.body.appendChild(cv);
      var ctx = cv.getContext('2d');
      var w = cv.width  = Math.max(200, Math.floor(window.innerWidth  / 4));
      var h = cv.height = Math.max(150, Math.floor(window.innerHeight / 4));
      var handle = { id: 0, stop: false, el: cv };
      (function frame() {
        if (handle.stop) return;
        var img = ctx.createImageData(w, h), d = img.data;
        for (var i = 0; i < d.length; i += 4) {
          var v = (Math.random() * 255) | 0;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = (Math.random() * 255) | 0;
        }
        ctx.putImageData(img, 0, 0);
        handle.id = requestAnimationFrame(frame);
      })();
      return handle;
    }

    var frame = document.querySelector('.terminal-frame');
    if (frame && typeof frame.decode === 'function') {
      frame.decode().then(runTimeline, runTimeline);
    } else if (frame && !frame.complete) {
      frame.addEventListener('load', runTimeline, { once: true });
      frame.addEventListener('error', runTimeline, { once: true });
    } else {
      runTimeline();
    }
  }

  /* ── Reduced motion: skip the cinematics, reveal immediately. ───── */
  function reducedReveal(consoleEl, off, flash) {
    document.documentElement.classList.add('cy-clean');   /* straight to the real site */
    if (off) off.parentNode && off.parentNode.removeChild(off);
    if (flash) flash.parentNode && flash.parentNode.removeChild(flash);
    if (consoleEl) consoleEl.parentNode && consoleEl.parentNode.removeChild(consoleEl);
    finish();
  }

  /* ── Tear down boot UI and start the live site. ────────────────── */
  function finish(consoleEl, off, flash) {
    [consoleEl, off, flash].forEach(function (n) {
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
    document.documentElement.classList.remove('cy-booting', 'cy-reveal', 'cy-dissolve');
    document.body.classList.remove('boot-active');
    document.documentElement.style.height = '';
    document.body.style.height = '';

    /* Remove any leftover through-the-screen FX / character stage. */
    var fx = document.querySelectorAll('.cy-fx, .cy-charfx, .cy-flash, .cy-scanbloom, .cy-noise');
    for (var f = 0; f < fx.length; f++) {
      if (fx[f].parentNode) fx[f].parentNode.removeChild(fx[f]);
    }

    var container = document.querySelector('.terminal-container');
    if (container) {
      container.style.transition = '';
      container.style.opacity = '';
    }

    if (window.CyResponsive) window.CyResponsive.unlock();   /* final layout */
    markBooted();

    /* Ensure the live CRT effects are running — but NOT in clean mode, where
       glow/scanlines/glitch/decode are all stripped. Covers the reduced-motion
       / missing-DOM paths. */
    if (!document.documentElement.classList.contains('cy-clean')) {
      if (window.CyGlitch && window.CyGlitch.start) window.CyGlitch.start();
      triggerDecode();
    } else {
      placeCursor();       /* landed clean → drop the cursor at the end of the text */
    }

    running = false;       /* allow the easter egg to replay */
  }

  /* Fire the decode reveal once per run — replay() on an easter-egg run so the
     text re-scrambles, start() on first load. */
  function triggerDecode() {
    if (decodeTriggered) return;
    decodeTriggered = true;
    if (replaying && window.CyDecode && window.CyDecode.replay) {
      window.CyDecode.replay();
    } else if (window.CyDecode && window.CyDecode.start) {
      window.CyDecode.start();
    }
  }

  /* ── Boot console DOM ──────────────────────────────────────────────
     Starts in `.intro`: only the logo, centered in the monitor. After the
     hold, `startBoot()` reveals `.boot-body` (BIOS header + log) below it. */
  function buildConsole() {
    var c = el('div', 'boot-console intro');

    /* Logo — shown centered on power-on, then slid to the top. */
    var logo = el('div', 'boot-logo-wrap');
    var img = el('img', 'boot-logo-img');
    img.alt = 'CYBURDINE SYSTEMS';
    img.style.display = 'none';
    var text = el('div', 'boot-logo-text',
      'CYBURDINE<small>S Y S T E M S</small>');
    /* Swap to the green-baked logo if/when it exists. */
    img.onload  = function () { img.style.display = ''; text.style.display = 'none'; };
    img.onerror = function () { img.style.display = 'none'; };
    img.src = '/assets/images/cyburdine-logo-green.png';
    logo.appendChild(img);
    logo.appendChild(text);
    c.appendChild(logo);

    /* Boot body (BIOS header + log) — hidden until the logo hold ends. */
    var body = el('div', 'boot-body');
    body.appendChild(el('div', 'boot-bios',
      'CYBURDINE SYSTEMS  <span class="hl">CY-BIOS v4.77</span>  (C) 1999-2026\n' +
      'NODE: cyburdine.local   ARCH: CY-9 NEURAL   FW: phosphor-green'));
    body.appendChild(el('div', 'boot-log'));
    c.appendChild(body);

    return c;
  }

  /* ── Boot log engine ───────────────────────────────────────────── */
  function pad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
  function dots(label, width) {
    var d = width - label.length;
    return label + ' ' + (d > 0 ? new Array(d).join('.') : '');
  }
  function bar(pct) {
    var total = 22, filled = Math.round(total * pct / 100);
    var s = '';
    for (var i = 0; i < total; i++) s += i < filled ? '█' : '░';
    return '[<span class="bar">' + s.slice(0, filled) + '</span>' +
           s.slice(filled) + '] ' + pad(Math.floor(pct), 3) + '%';
  }

  function runBootLog(consoleEl, onDone) {
    var log = consoleEl.querySelector('.boot-log');
    var queue = [];
    function add(wait, fn) { queue.push({ wait: wait, fn: fn }); }

    function line(html) {
      var prev = log.querySelector('.boot-cursor');
      if (prev) prev.classList.remove('boot-cursor');
      var d = el('div', 'boot-cursor', html);
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }

    /* A line whose tail updates in place (mem count-up, progress bars). */
    function live(prefix) {
      var d = line(prefix + '');
      return {
        set: function (tail) { d.innerHTML = prefix + tail; log.scrollTop = log.scrollHeight; }
      };
    }

    function animate(prefix, dur, render, done) {
      var l = live(prefix);
      var start = performance.now();
      (function frame(now) {
        var t = Math.min((now - start) / dur, 1);
        l.set(render(t));
        if (t < 1) requestAnimationFrame(frame);
        else if (done) done();
      })(start);
    }

    /* Script the sequence. Each step waits `wait` ms after the previous. */
    add(0,   function () { line(dots(':: POST', 30) + ' [<span class="ok">OK</span>]'); });
    add(90,  function () { line(dots(':: CPU  CY-9 NEURAL CORE', 30) + ' 8 threads <span class="ok">ONLINE</span>'); });
    add(110, function () {
      animate(':: MEM  ', 700, function (t) {
        var kb = Math.floor(t * 65536);
        return dots(pad(kb, 5) + ' KB', 22).slice(8) + ' ' + (t < 1 ? 'testing' : '<span class="ok">OK</span>');
      });
    });
    add(760, function () { line(dots(':: BUS  node scan', 30) + ' 4 found <span class="dim">[uplink beacon archive forge]</span>'); });
    add(120, function () { line(dots(':: MNT  /dev/consciousness', 30) + ' <span class="ok">ok</span>'); });
    add(90,  function () { line(dots(':: MNT  /dev/forge', 30) + ' <span class="ok">ok</span>'); });
    add(120, function () {
      animate(':: LD   neon.kernel ........... ', 760, function (t) { return bar(t * 100); });
    });
    add(820, function () { line(dots(':: LD   glitch.driver', 30) + ' <span class="ok">ok</span>'); });
    add(80,  function () { line(dots(':: LD   decrypt.module', 30) + ' <span class="ok">ok</span>'); });
    add(110, function () { line(dots(':: NET  handshake cyburdine.local', 30) + ' <span class="ok">AUTH VALID</span>'); });
    add(110, function () { line(dots(':: NET  beacon', 30) + ' <span class="ok">ACTIVE</span>'); });
    add(100, function () { line(dots(':: SEC  scanline integrity', 30) + ' <span class="warn">nominal</span>'); });
    add(120, function () {
      animate(':: CAL  phosphor green ........ ', 700, function (t) { return bar(t * 100); });
    });
    add(760, function () { line('<span class="ok">:: ALL SYSTEMS NOMINAL</span>'); });
    add(140, function () { line(':: LAUNCHING INTERFACE ...').classList.add('boot-cursor'); });

    /* Drive the queue, then signal completion. */
    var i = 0;
    (function next() {
      if (i >= queue.length) { if (onDone) onDone(); return; }
      var s = queue[i++];
      setTimeout(function () { s.fn(); next(); }, s.wait);
    })();
  }

  /* ── Wire up ─────────────────────────────────────────────────────── */
  var force = param();
  var shouldBoot = force === true ||
                   (force !== false && isLanding() && !alreadyBooted());

  if (shouldBoot) {
    /* Claim the page synchronously, before decode/glitch register their load
       handlers, so they defer; and hide the container before responsive.js
       positions it, to avoid a flash of the final view. */
    window.__CY_BOOT_PENDING__ = true;
    document.documentElement.classList.add('cy-booting');
    ready(function () { playBoot(false); });
  } else {
    /* Not booting → render the real (clean) site. Set before first paint so the
       CRT never flashes for returning visitors or first-time deep links. */
    document.documentElement.classList.add('cy-clean');
    ready(placeCursor);
  }

  /* Easter eggs: invisible links over keypad keys replay the sequence. Also
     exposed as window.CyBoot.replay(). Available on every page/visit. */
  window.CyBoot = { replay: function () { playBoot(true); } };
  ready(function () {
    var eggs = document.querySelectorAll('.cy-egg');
    for (var i = 0; i < eggs.length; i++) {
      eggs[i].addEventListener('click', function (e) {
        e.preventDefault();
        playBoot(true);
      });
    }

    /* In clean mode the keypad is hidden, so the "D" keyboard key replays the
       whole cinematic (drop back into the CRT, run boot, emerge clean again). */
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) ||
          (e.target && e.target.isContentEditable)) return;
      if (e.key === 'd' || e.key === 'D') {
        document.documentElement.classList.remove('cy-clean');
        playBoot(true);
      }
    });
  });
})();
