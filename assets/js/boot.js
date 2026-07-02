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

  /* The footer "reboot" link sets this one-shot flag then reloads; on the next
     load we consume it and force the full cinematic on ANY page. */
  function rebootRequested() {
    try {
      if (window.sessionStorage.getItem('cy_reboot') === '1') {
        window.sessionStorage.removeItem('cy_reboot');
        return true;
      }
    } catch (e) {}
    return false;
  }

  var REDUCE = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var running = false;        /* a boot run is in progress */

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
    holdAfterBoot:  1400,   /* finished boot log held before the camera pushes in */
    /* ── Continuous zoom into the LOGO → pass through the screen → black ── */
    zoomInDur:      3800,   /* SLOW continuous zoom the whole way into the logo */
    crossRamp:      1400,   /* before the apex: logo + scanlines glow to immense */
    blackHold:       900    /* beat on black before render.js types the page */
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

    /* Boot log finished → hold, then push the camera into the logo. */
    function endSequence() {
      setTimeout(zoomIntoLogoThenBlack, T.holdAfterBoot);
    }

    /* ONE continuous zoom INTO the Cyburdine Systems logo — its glow grows to
       fill the tube — then the "through the screen" FX (scanline bloom, light
       burst, digital noise) fire and the screen falls to BLACK. From black we
       hand off to render.js, which types the page in katakana. */
    function zoomIntoLogoThenBlack() {
      var R = window.CyResponsive;
      var ft = R ? R.finalTransform() : { scale: 1, x: 0, y: 0 };

      /* Focal = the logo (image if present, else the text lockup). */
      var focal = consoleEl.querySelector('.boot-logo-img');
      if (!focal || focal.style.display === 'none') focal = consoleEl.querySelector('.boot-logo-text');
      if (!focal) focal = consoleEl;
      var rect = focal.getBoundingClientRect();

      /* Anchor on the logo's centre and scale ABOUT it, so its glow grows from
         that fixed point to fill the screen rather than the view panning. */
      var apx = rect.left + rect.width * 0.5;
      var apy = rect.top  + rect.height * 0.5;
      var Sdeep = ft.scale * (6 * window.innerHeight / Math.max(1, rect.height));

      var zin = T.zoomInDur, ramp = T.crossRamp;
      function tstr(st) { return 'translate(' + st.Tx + 'px,' + st.Ty + 'px) scale(' + st.S + ')'; }
      function about(sc) {
        return { S: sc, Tx: apx - sc * (apx - ft.x) / ft.scale, Ty: apy - sc * (apy - ft.y) / ft.scale };
      }
      function ss(x) { return x * x * (3 - 2 * x); }                 /* smoothstep */

      /* Exponential scale (perceptually steady ratio) with eased time (starts
         from rest, glides into the apex). Many small linear steps read as one
         smooth curve. */
      var frames = [], N = 26;
      for (var i = 0; i <= N; i++) {
        var u = i / N;
        var sc = ft.scale * Math.pow(Sdeep / ft.scale, ss(u));
        frames.push({ transform: tstr(about(sc)), offset: u, easing: 'linear' });
      }

      container.style.willChange = 'transform';
      container.style.transition = 'none';
      container.animate(frames, { duration: zin, fill: 'forwards' });

      /* Approaching the apex: the logo + scanlines bloom to immense. */
      setTimeout(function () {
        document.body.appendChild(el('div', 'cy-scanbloom'));
        var logoWrap = consoleEl.querySelector('.boot-logo-wrap') || consoleEl;
        logoWrap.classList.add('cy-bloom-in');
      }, zin - ramp);

      /* At the apex: light burst + digital noise, then fall to black. */
      setTimeout(function () {
        var flash = el('div', 'cy-flash');
        document.body.appendChild(flash);
        setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 900);

        var noise = fireNoise();
        setTimeout(function () {
          noise.stop = true;
          if (noise.id) cancelAnimationFrame(noise.id);
          if (noise.el.parentNode) noise.el.parentNode.removeChild(noise.el);
        }, 700);

        var black = el('div', 'cy-black');
        document.body.appendChild(black);
        requestAnimationFrame(function () { black.classList.add('on'); });

        setTimeout(goRender, T.blackHold);
      }, zin);
    }

    /* On black: switch to the clean site in render mode (still black), then tear
       down the boot chrome under cover of black; finish() hands off to render.js
       to type the page in katakana. */
    function goRender() {
      document.documentElement.classList.add('cy-clean', 'cy-rendering');
      document.documentElement.classList.remove('cy-reveal', 'cy-dissolve');
      if (container.getAnimations) container.getAnimations().forEach(function (a) { a.cancel(); });
      container.style.transition = 'none';
      container.style.transform  = 'none';
      container.style.willChange = '';
      finish(consoleEl, off, flash);
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

    /* Remove any leftover through-the-screen FX / black cover. */
    var fx = document.querySelectorAll('.cy-fx, .cy-charfx, .cy-flash, .cy-scanbloom, .cy-noise, .cy-black');
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

    running = false;       /* allow the easter egg to replay */

    /* Hand off to the per-page render. In render mode (the cinematic's black
       handoff, or a normal load), render.js types the page in katakana; it
       clears cy-rendering when done. A plain clean landing (reduced motion /
       missing DOM) just drops the resting cursor. */
    if (document.documentElement.classList.contains('cy-rendering')) {
      if (window.CyRender && window.CyRender.play) window.CyRender.play();
      else document.documentElement.classList.remove('cy-rendering');
    } else if (document.documentElement.classList.contains('cy-clean')) {
      placeCursor();
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
  var reboot = rebootRequested();
  var shouldBoot = force === true || reboot ||
                   (force !== false && isLanding() && !alreadyBooted());

  if (shouldBoot) {
    /* Claim the page synchronously, before glitch registers its load handler,
       so it defers; and hide the container before responsive.js positions it,
       to avoid a flash of the final view. */
    window.__CY_BOOT_PENDING__ = true;
    document.documentElement.classList.add('cy-booting');
    ready(function () { playBoot(false); });
  } else if (REDUCE) {
    /* Reduced motion: no cinematics, no typing — the real clean site at once. */
    document.documentElement.classList.add('cy-clean');
    ready(placeCursor);
  } else {
    /* Every other load: the clean site materialises via the per-page render
       (black → type katakana → convert). Flag cy-rendering before first paint
       so the real text never flashes, then hand off to render.js on ready. */
    document.documentElement.classList.add('cy-clean', 'cy-rendering');
    ready(function () {
      if (window.CyRender && window.CyRender.play) window.CyRender.play();
      else document.documentElement.classList.remove('cy-rendering');
    });
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

    /* Footer "reboot" link: reload the page and replay the full cinematic. */
    var reboots = document.querySelectorAll('.cy-reboot');
    for (var b = 0; b < reboots.length; b++) {
      reboots[b].addEventListener('click', function (e) {
        e.preventDefault();
        try { window.sessionStorage.setItem('cy_reboot', '1'); } catch (_) {}
        window.location.reload();
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
        document.documentElement.classList.remove('cy-clean', 'cy-rendering');
        playBoot(true);
      }
    });
  });
})();
