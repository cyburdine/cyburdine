/* SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
*/
(function () {
  const foreignFonts = ["'Noto Sans JP', monospace"];
  const selectedFont = foreignFonts[0];
  const primaryFont = "'VT323', monospace";
  // A small set of Japanese characters (hiragana and katakana)
  const japaneseChars = ['あ','い','う','え','お','カ','キ','ク','ケ','コ','タ','チ','ツ','テ','ト'];

  // Set CSS variable for foreign font
  document.documentElement.style.setProperty('--foreign-font', selectedFont);

  function wrapCharacters() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];

    // Collect all text nodes (excluding SCRIPT/STYLE)
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.trim() && node.parentNode &&
         !['SCRIPT', 'STYLE'].includes(node.parentNode.nodeName)) {
        textNodes.push(node);
      }
    }

    textNodes.forEach(node => {
      const parent = node.parentNode;
      const chars = node.nodeValue.split('');
      const fragment = document.createDocumentFragment();

      chars.forEach(char => {
        const span = document.createElement('span');
        span.classList.add('char');
        // Keep original letter for later
        span.setAttribute('data-original', char);

        // For about 30% of non-space chars, mark as foreign
        if (Math.random() < 0.3 && /\S/.test(char)) {
          span.classList.add('foreign');
          // Replace displayed letter with random Japanese glyph
          const rand = japaneseChars[Math.floor(Math.random() * japaneseChars.length)];
          span.textContent = rand;
        } else {
          span.textContent = char;
        }
        fragment.appendChild(span);
      });

      parent.replaceChild(fragment, node);
    });
  }

  function decryptCharacters() {
    const allChars = Array.from(document.querySelectorAll('.char.foreign'));
    let delay = 0;
    allChars.forEach(char => {
      setTimeout(() => {
        // Restore the original letter
        const original = char.getAttribute('data-original');
        char.textContent = original;
        char.classList.remove('foreign');
        char.classList.add('decrypting');
        // Remove glow class after animation
        setTimeout(() => {
          char.classList.remove('decrypting');
        }, 400);
      }, delay);
      delay += 8; // next character changes slightly later
    });
  }

  // Run the wrap + decrypt cycle. Exposed so boot.js can trigger the
  // decode reveal *after* the boot sequence finishes, instead of letting
  // it play hidden underneath the boot console. Idempotent — safe to call
  // from more than one boot path.
  var hasRun = false;
  function runDecode() {
    if (hasRun) return;
    hasRun = true;
    wrapCharacters();
    // Pause Xms before starting the decrypt effect
    setTimeout(decryptCharacters, 750);
  }

  // Re-scramble the already-wrapped characters (without re-wrapping the DOM)
  // and decrypt again — used by the easter-egg boot replay so the text
  // re-materialises. Falls back to a first run if decode hasn't run yet.
  function replayDecode() {
    if (!hasRun) { runDecode(); return; }
    document.querySelectorAll('.char').forEach(span => {
      const original = span.getAttribute('data-original');
      if (original == null) return;
      span.classList.remove('decrypting');
      if (Math.random() < 0.3 && /\S/.test(original)) {
        span.classList.add('foreign');
        span.textContent = japaneseChars[Math.floor(Math.random() * japaneseChars.length)];
      } else {
        span.classList.remove('foreign');
        span.textContent = original;
      }
    });
    setTimeout(decryptCharacters, 750);
  }

  window.CyDecode = { start: runDecode, replay: replayDecode };

  window.addEventListener('load', () => {
    // If the boot sequence is going to play, it owns the timing and will
    // call CyDecode.start() during its handoff. Otherwise, run normally.
    if (window.__CY_BOOT_PENDING__) return;
    runDecode();
  });
})();