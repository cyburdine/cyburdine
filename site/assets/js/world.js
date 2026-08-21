/*
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause

world.js — THE BOOTH's living layer.

Drives the four things that make the site feel like an instrument that is
still running rather than a page that has finished loading:

  · the UTC clock in the top rail
  · the status ticker in the bottom rail — the boot log does NOT die when the
    cinematic ends, it moves in here and keeps talking for the life of the page
  · parallax on the world layer (pointer + scroll), written as CSS variables
    so the compositing stays in CSS
  · the dust motes canvas

Everything here is an ENHANCEMENT. The page is complete and readable if this
file never loads: the rails render their static content, the world is a plain
gradient, and nothing below throws.

Start is idempotent and safe to call twice — boot.js calls it at the handoff,
and it self-starts on any load that arrives in clean mode directly.
*/
(function () {
  'use strict';

  var REDUCE = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var started = false;

  function $(sel) { return document.querySelector(sel); }

  /* ── UTC clock ──────────────────────────────────────────────────── */
  function startClock() {
    var el = $('.cy-clock');
    if (!el) return;
    function tick() {
      var d = new Date();
      function p(n) { return (n < 10 ? '0' : '') + n; }
      el.textContent = p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) +
                       ':' + p(d.getUTCSeconds()) + 'Z';
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ── Status ticker ──────────────────────────────────────────────────
     Same voice as the boot log, because it IS the boot log continuing.
     Lines are deliberately mundane machine chatter: the booth is idling,
     not performing. */
  var LINES = [
    ':: NET  beacon ................ ACTIVE',
    ':: MNT  /dev/consciousness .... ok',
    ':: MNT  /dev/forge ............ ok',
    ':: SEC  scanline integrity .... nominal',
    ':: BUS  node scan ............. 4 found [uplink beacon archive forge]',
    ':: CAL  phosphor green ........ 100%',
    ':: PWR  cell ................... 94% draw nominal',
    ':: ENV  particulate ........... elevated',
    ':: ENV  ambient ............... 4°C  wind 11kt NNE',
    ':: LNK  uplink ................ carrier locked',
    ':: LOG  visitor session ....... OPEN',
    ':: ALL SYSTEMS NOMINAL'
  ];

  function startTicker() {
    var host = $('.cy-ticker');
    if (!host) return;
    var line = document.createElement('span');
    line.className = 'cy-ticker__line';
    line.textContent = LINES[0];
    host.appendChild(line);

    /* Under reduced motion the ticker states one thing and stays put. */
    if (REDUCE) { line.textContent = LINES[LINES.length - 1]; return; }

    var i = 0;
    setInterval(function () {
      i = (i + 1) % LINES.length;
      line.style.opacity = '0';
      setTimeout(function () {
        line.textContent = LINES[i];
        line.style.opacity = '';
      }, 260);
    }, 4200);
    line.style.transition = 'opacity 260ms ease';
  }

  /* ── Parallax ───────────────────────────────────────────────────────
     Writes --wx/--wy on the world element and lets CSS decide how much
     each layer moves. Keeping the per-layer factors in CSS means the
     depth relationships live next to the art, not in here. */
  function startParallax() {
    var world = $('.cy-world');
    if (!world || REDUCE) return;

    var px = 0, py = 0, tx = 0, ty = 0, raf = 0;

    function frame() {
      /* ease toward the target so the world drifts rather than snaps */
      px += (tx - px) * 0.06;
      py += (ty - py) * 0.06;
      world.style.setProperty('--wx', px.toFixed(2) + 'px');
      world.style.setProperty('--wy', py.toFixed(2) + 'px');
      if (Math.abs(tx - px) > 0.1 || Math.abs(ty - py) > 0.1) {
        raf = requestAnimationFrame(frame);
      } else { raf = 0; }
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    window.addEventListener('pointermove', function (e) {
      var w = window.innerWidth || 1;
      tx = ((e.clientX / w) - 0.5) * -48;
      kick();
    }, { passive: true });

    window.addEventListener('scroll', function () {
      ty = Math.min(window.scrollY * 0.06, 60);
      kick();
    }, { passive: true });
  }

  /* ── Dust ───────────────────────────────────────────────────────────
     Follows the pattern video_glitch.js already establishes: one small
     canvas, a fixed particle budget, no library. */
  function startMotes() {
    var cv = $('.cy-world__motes');
    if (!cv || REDUCE || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var motes = [];
    var COUNT = 60;

    function size() {
      cv.width  = Math.floor(window.innerWidth * dpr);
      cv.height = Math.floor(window.innerHeight * dpr);
    }
    function seed() {
      motes.length = 0;
      for (var i = 0; i < COUNT; i++) {
        motes.push({
          x: Math.random() * cv.width,
          y: Math.random() * cv.height,
          r: (Math.random() * 1.4 + 0.3) * dpr,
          /* drifting with the wind, mostly sideways */
          vx: (Math.random() * 0.35 + 0.05) * dpr,
          vy: (Math.random() - 0.5) * 0.12 * dpr,
          a: Math.random() * 0.4 + 0.08
        });
      }
    }

    size(); seed();
    window.addEventListener('resize', function () { size(); seed(); }, { passive: true });

    (function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.x += m.vx; m.y += m.vy;
        if (m.x > cv.width + 4) { m.x = -4; m.y = Math.random() * cv.height; }
        if (m.y < -4) m.y = cv.height + 4;
        if (m.y > cv.height + 4) m.y = -4;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(214, 198, 170, ' + m.a + ')';
        ctx.fill();
      }
      requestAnimationFrame(draw);
    })();
  }

  function start() {
    if (started) return;
    started = true;
    startClock();
    startTicker();
    startParallax();
    startMotes();
  }

  window.CyWorld = { start: start };

  /* Start on the handoff into clean mode, whenever that happens.
     boot.js reaches clean mode by four different routes (cinematic, reduced
     motion, plain load, and the "D" replay), so watching the class is more
     robust than asking boot.js to call us from each of them — and it keeps the
     two files uncoupled. */
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }
  ready(function () {
    var root = document.documentElement;
    if (root.classList.contains('cy-clean')) { start(); return; }
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function () {
      if (root.classList.contains('cy-clean')) { obs.disconnect(); start(); }
    });
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
  });
})();
