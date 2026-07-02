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
    holdAfterBoot:  1600,   /* boot log held before your site loads into the tube */
    revealFade:      900,   /* boot console fades out → your site shows in the tube */
    sitePrehold:    1300,   /* your site shown in the tube before we zoom the char */
    /* ── The single-character crossing (charZoom) ── */
    stageIn:         550,   /* dark stage + small glyph fade in (focus before moving) */
    zoomInDur:      1600,   /* glyph zooms up to fill the screen (slow, cinematic) */
    distortDur:      720,   /* electronic distortion — "going through the screen" */
    resolveDur:      420,   /* distortion settles into a clean letter */
    zoomOutDur:     1900,   /* gently zoom back out as the clean page emerges */
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

    /* Stage 1 — "load my site first": reveal the real homepage inside the tube,
       already in the clean font (so nothing re-typesets later) but still wearing
       the CRT skin (glow, scanlines, bezel). The boot console fades out over it. */
    function loadSiteInTube() {
      document.documentElement.classList.add('cy-reveal');   /* clean font, CRT skin on */
      document.body.classList.remove('boot-active');         /* real main/footer visible */
      if (consoleEl) {
        consoleEl.classList.add('fading');                   /* boot log fades away */
        setTimeout(function () {
          if (consoleEl.parentNode) consoleEl.parentNode.removeChild(consoleEl);
        }, T.revealFade + 120);
      }
      setTimeout(charZoom, T.revealFade + T.sitePrehold);
    }

    /* Stage 2 — THROUGH A SINGLE CHARACTER. Zoom up on one glyph, distort it
       electronically (going through the screen), resolve to a clean letter, then
       gently zoom back out to reveal the clean page. The glyph's scale is ONE
       continuous WAAPI animation (zoom in → hold → zoom out) with a hold in the
       middle for the distortion, so the motion never stops or jerks. */
    function charZoom() {
      var heading = screen.querySelector('h1, h2, h3');
      var ch = (heading && heading.textContent.trim().charAt(0)) || 'C';

      var stage = el('div', 'cy-charfx');
      var glyph = el('div', 'cy-glyph', ch);
      stage.appendChild(glyph);
      document.body.appendChild(stage);
      requestAnimationFrame(function () { stage.classList.add('in'); });   /* fade the stage in */

      var zin = T.zoomInDur, dist = T.distortDur, res = T.resolveDur, zout = T.zoomOutDur;
      var total = zin + dist + res + zout;
      var offIn   = zin / total;
      var offHold = (zin + dist + res) / total;

      /* Start the flight once the stage has faded in, so we're focused before we
         move. */
      setTimeout(function () {
        /* One continuous scale: small → fills the screen → (hold) → zoom out. */
        glyph.animate([
          { transform: 'scale(0.28)', easing: 'cubic-bezier(0.4, 0, 0.5, 1)' },      /* accelerate in */
          { transform: 'scale(1.4)',  offset: offIn,   easing: 'linear' },
          { transform: 'scale(1.4)',  offset: offHold, easing: 'cubic-bezier(0.35, 0, 0.15, 1)' }, /* hold, then ease out */
          { transform: 'scale(0.6)' }
        ], { duration: total, fill: 'forwards' });

        setTimeout(function () { glyph.classList.add('glitch'); }, zin);             /* distort */
        setTimeout(function () {                                                     /* resolve to clean letter */
          glyph.classList.remove('glitch');
          glyph.classList.add('clean');
        }, zin + dist);
        setTimeout(function () {                                                     /* reveal page as we zoom out */
          document.documentElement.classList.add('cy-clean');
          document.documentElement.classList.remove('cy-reveal', 'cy-dissolve');
          container.style.transition = 'none';
          container.style.transform  = 'none';
          if (consoleEl) consoleEl.style.display = 'none';
          stage.style.transition = 'opacity ' + zout + 'ms ease-in';
          stage.style.opacity = '0';                                                /* dark sheet + glyph fade → page emerges */
        }, zin + dist + res);
        setTimeout(function () {
          if (stage.parentNode) stage.parentNode.removeChild(stage);
          finish(consoleEl, off, flash);
        }, total + 150);
      }, T.stageIn);
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
    var fx = document.querySelectorAll('.cy-fx, .cy-charfx');
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
