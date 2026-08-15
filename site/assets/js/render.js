/* SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause

   Per-page "render" effect — runs on every page load (clean mode).
   On a black terminal, a cursor types the page's real <main> content as
   katakana; as the caret reaches each new line the finished line converts to
   the real letters, each glyph glitching during the flip. Lands on the clean
   site. On the first visit boot.js drives the cinematic and calls play() at the
   black-screen handoff; on every other load boot.js flags cy-rendering pre-paint
   and calls play() on ready. Supersedes the old decode.js reveal.
*/
(function () {
  'use strict';

  /* Katakana/hiragana subset — must match the Noto Sans JP font subset so no
     glyph renders as tofu. (Moved here from decode.js.) */
  var GLYPHS = ['あ','い','う','え','お','カ','キ','ク','ケ','コ','タ','チ','ツ','テ','ト'];
  document.documentElement.style.setProperty('--foreign-font', "'Noto Sans JP', monospace");

  var REDUCE = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Tuning. Typing is TIME-based (chars are revealed by elapsed time, not per
     frame) so the speed is constant and smooth on any refresh rate, and a
     dropped frame is caught up rather than stalling. Fast: ~3ms/char, and a
     long page's whole <main> still finishes by MAX_TOTAL_MS. */
  var MS_PER_CHAR = 3;        /* base typing cadence (ms per character) */
  var MAX_TOTAL_MS = 1200;    /* cap: long pages speed up to land within this */
  var CONVERT_STAGGER = 6;    /* ms between glyphs flipping in a converting line */
  var FLIP_SCRAMBLES  = 2;    /* kana flickers before a glyph settles */
  var FLIP_STEP_MS    = 24;
  var FLIP_HOLD_MS    = 200;  /* .cy-flip glow duration (keep in sync with CSS) */

  var running = false;

  var BLOCK = { DIV:1, P:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1, UL:1, OL:1, LI:1,
    PRE:1, BLOCKQUOTE:1, SECTION:1, ARTICLE:1, HEADER:1, FOOTER:1, NAV:1, MAIN:1,
    FIGURE:1, FIGCAPTION:1, TABLE:1, THEAD:1, TBODY:1, TR:1, TD:1, TH:1, HR:1, BR:1 };

  function rand(a) { return a[Math.floor(Math.random() * a.length)]; }
  function isVisibleChar(c) { return /\S/.test(c); }

  /* Nearest block-level ancestor of a node (for line grouping). */
  function blockAncestor(node, root) {
    var e = node.parentNode;
    while (e && e !== root.parentNode) {
      if (e.nodeType === 1 && BLOCK[e.tagName]) return e;
      e = e.parentNode;
    }
    return root;
  }
  function insidePre(node, root) {
    var e = node.parentNode;
    while (e && e !== root.parentNode) {
      if (e.nodeType === 1 && e.tagName === 'PRE') return true;
      e = e.parentNode;
    }
    return false;
  }

  /* Wrap every character of `root` in a <span class="char"> (started empty, so
     the page is blank/black), grouped into lines. A "line" ends at a `\n` (kept
     as a text node so <pre> layout survives) or at a block boundary. Returns an
     array of lines; each line is an array of the char-spans it contains. */
  function tokenize(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      var p = n.parentNode;
      if (!p || /^(SCRIPT|STYLE)$/.test(p.nodeName)) continue;
      /* Skip collapsible structural whitespace (indentation between tags), but
         keep whitespace inside <pre> where it is significant. */
      if (!/\S/.test(n.nodeValue) && !insidePre(n, root)) continue;
      nodes.push(n);
    }

    var lines = [], cur = [], lastBlock = null;
    function endLine() { lines.push(cur); cur = []; }

    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k];
      var blk = blockAncestor(node, root);
      if (lastBlock !== null && blk !== lastBlock && cur.length) endLine();
      lastBlock = blk;

      var value = node.nodeValue;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < value.length; i++) {
        var ch = value[i];
        if (ch === '\n') { frag.appendChild(document.createTextNode('\n')); endLine(); continue; }
        var span = document.createElement('span');
        span.className = 'char';
        span.setAttribute('data-original', ch);
        span.textContent = '';           /* hidden until typed */
        frag.appendChild(span);
        cur.push(span);
      }
      node.parentNode.replaceChild(frag, node);
    }
    if (cur.length) endLine();
    return lines;
  }

  /* Convert one finished line: each glyph flickers through a couple of kana then
     settles to its real letter, staggered a few ms apart. */
  function convertLine(line) {
    var delay = 0;
    for (var i = 0; i < line.length; i++) {
      var span = line[i];
      var orig = span.getAttribute('data-original');
      if (!isVisibleChar(orig)) continue;   /* spaces are already correct */
      (function (span, orig, delay) {
        setTimeout(function () {
          var k = 0;
          (function flip() {
            if (k < FLIP_SCRAMBLES) { span.textContent = rand(GLYPHS); k++; setTimeout(flip, FLIP_STEP_MS); return; }
            span.textContent = orig;
            span.classList.remove('foreign');
            span.classList.add('cy-flip');
            setTimeout(function () { span.classList.remove('cy-flip'); }, FLIP_HOLD_MS);
          })();
        }, delay);
      })(span, orig, delay);
      delay += CONVERT_STAGGER;
    }
  }

  /* Drop a blinking cursor after the last non-space character (resting look for
     reduced-motion / fallback paths). */
  function placeEndCursor(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var last = null, node;
    while ((node = walker.nextNode())) { if (/\S/.test(node.nodeValue)) last = node; }
    var cursor = document.createElement('span');
    cursor.className = 'cy-cursor';
    cursor.textContent = '█';
    if (last) {
      last.nodeValue = last.nodeValue.replace(/\s+$/, '');
      if (last.nextSibling) last.parentNode.insertBefore(cursor, last.nextSibling);
      else last.parentNode.appendChild(cursor);
    } else { root.appendChild(cursor); }
  }

  /* Restore <main> to plain text — undo a previous render's spans/cursor so a
     replay (D key / easter egg) can tokenize cleanly instead of double-wrapping.
     No-op on a fresh page. */
  function unrender(root) {
    var cur = root.querySelector('.cy-cursor');
    if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
    var spans = root.querySelectorAll('span.char');
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i];
      var orig = s.getAttribute('data-original');
      s.parentNode.replaceChild(document.createTextNode(orig != null ? orig : s.textContent), s);
    }
    root.normalize();   /* merge the char + "\n" text nodes back into whole lines */
  }

  /* Reveal chrome (nav + footer) with a soft fade once the body has rendered. */
  function revealChrome() {
    ['header', 'footer'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = '0';
      requestAnimationFrame(function () {
        el.style.transition = 'opacity 600ms ease';
        el.style.opacity = '1';
        setTimeout(function () { el.style.transition = el.style.opacity = ''; }, 660);
      });
    });
  }

  function finishRender() {
    running = false;
    document.documentElement.classList.remove('cy-rendering');
    revealChrome();
  }

  /* Reveal the page immediately (reduced motion / no work to do). */
  function revealInstant(main) {
    document.documentElement.classList.remove('cy-rendering');
    if (main) { main.style.visibility = 'visible'; placeEndCursor(main); }
    running = false;
  }

  function play() {
    if (running) return;
    var main = document.querySelector('main');
    if (!main) { finishRender(); return; }
    unrender(main);   /* clean slate if this page was rendered before (replay) */
    if (REDUCE) { revealInstant(main); return; }
    running = true;

    var lines = tokenize(main);
    main.style.visibility = 'visible';   /* spans are empty → still black */

    /* Cursor follows the caret. */
    var cursor = document.createElement('span');
    cursor.className = 'cy-cursor';
    cursor.textContent = '█';

    /* Flatten to a reveal stream: type each char, convert at each line end. */
    var ops = [];
    var total = 0;
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      for (var ci = 0; ci < line.length; ci++) { ops.push({ t: 'c', span: line[ci] }); total++; }
      ops.push({ t: 'e', line: line });
    }

    /* Constant, smooth cadence; long pages speed up to fit MAX_TOTAL_MS. */
    var perChar = Math.min(MS_PER_CHAR, MAX_TOTAL_MS / Math.max(1, total));
    var idx = 0, revealed = 0, startT = null;

    function revealChar(span) {
      var orig = span.getAttribute('data-original');
      if (isVisibleChar(orig)) { span.textContent = rand(GLYPHS); span.classList.add('foreign'); }
      else { span.textContent = orig; }
      span.parentNode.insertBefore(cursor, span.nextSibling);   /* caret rides along */
    }

    /* Reveal however many chars the elapsed time calls for — decoupled from the
       frame rate, so the speed is steady and a slow frame just catches up. */
    function frame(now) {
      if (startT === null) startT = now;
      var target = Math.floor((now - startT) / perChar);
      while (idx < ops.length && (revealed < target || ops[idx].t === 'e')) {
        var op = ops[idx++];
        if (op.t === 'c') { revealChar(op.span); revealed++; }
        else { convertLine(op.line); }   /* line end — convert as soon as it's typed */
      }
      if (idx < ops.length) { requestAnimationFrame(frame); }
      else { finishRender(); }
    }
    requestAnimationFrame(frame);
  }

  window.CyRender = { play: play };
})();
