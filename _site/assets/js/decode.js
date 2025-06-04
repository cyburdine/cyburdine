/* SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
*/
(function () {
  const foreignFonts = ["'Noto Sans JP', sans-serif"];
  const selectedFont = foreignFonts[0];
  const primaryFont = "'VT323', monospace";

  // Set CSS variable for foreign font
  document.documentElement.style.setProperty('--foreign-font', selectedFont);

  function wrapCharacters() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    // A small set of Japanese characters (hiragana and katakana)
    const japaneseChars = ['あ','い','う','え','お','カ','キ','ク','ケ','コ','タ','チ','ツ','テ','ト'];

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

  window.addEventListener('load', () => {
    wrapCharacters();
    // Pause 500ms before starting the decrypt effect
    setTimeout(decryptCharacters, 750);
  });
})();