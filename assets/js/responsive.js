/* SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
*/
(function() {
  var container = document.querySelector('.terminal-container');
  var wrapper = document.querySelector('.terminal-wrapper');
  if (!container || !wrapper) return;

  var NATIVE_WIDTH = 3000;
  var NATIVE_HEIGHT = 1688;

  function applyScale() {
    var scaleFactor = Math.min(window.innerWidth / NATIVE_WIDTH, 1);
    container.style.transform = 'scale(' + scaleFactor + ')';
    container.style.transformOrigin = 'top left';
    wrapper.style.height = (NATIVE_HEIGHT * scaleFactor) + 'px';
  }

  window.addEventListener('resize', applyScale);
  applyScale();
})();
