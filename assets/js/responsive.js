/* SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
*/
(function() {
  var container = document.querySelector('.terminal-container');
  var wrapper = document.querySelector('.terminal-wrapper');
  if (!container || !wrapper) return;

  /* Bounding box of the CRT monitor within the 3000×1688 console image.
     Tunable: these decide what's guaranteed fully visible when zoomed in. */
  var MONITOR_WIDTH = 1580;
  var MONITOR_HEIGHT = 1200;
  var FRAME_WIDTH = 3000;   /* full console image, used by the boot wide shot */
  var FRAME_HEIGHT = 1688;

  var locked = false;       /* boot.js locks this while it drives the zoom */

  /* Final resting transform: pin the monitor to the top-left of the viewport
     and "contain"-fit it so the whole monitor is always visible (never cut
     off). On wide screens height drives the scale, so the monitor fills the
     height and the keypad/gauges in the image fill the surplus width — no
     black bars. The image was authored top-left exactly for this. */
  /* When the scaled console image is shorter than the viewport (e.g. phones in
     portrait, where the monitor fills the width but leaves space below), center
     it vertically so it letterboxes instead of dumping black at the bottom.
     On desktop the console is taller than the viewport, so this is 0 (the
     top-left pin is preserved). */
  function centerY(scale) {
    return Math.max(0, (window.innerHeight - FRAME_HEIGHT * scale) / 2);
  }

  function finalTransform() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = Math.min(vw / MONITOR_WIDTH, vh / MONITOR_HEIGHT);
    var ty = centerY(scale);
    return {
      scale: scale,
      x: 0,
      y: ty,
      css: 'translate(0px, ' + ty + 'px) scale(' + scale + ')',
      wrapperHeight: vh
    };
  }

  /* Wide shot: the entire console image fitted into the viewport, pinned left
     and vertically centered to match the final framing. */
  function wideTransform() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = Math.min(vw / FRAME_WIDTH, vh / FRAME_HEIGHT);
    var ty = centerY(scale);
    return {
      scale: scale,
      x: 0,
      y: ty,
      css: 'translate(0px, ' + ty + 'px) scale(' + scale + ')'
    };
  }

  function applyScale() {
    if (locked) return;
    var t = finalTransform();
    container.style.transform = t.css;
    container.style.transformOrigin = 'top left';
    wrapper.style.height = t.wrapperHeight + 'px';
    /* Publish the live scale so the in-screen font can counter-scale exactly. */
    document.documentElement.style.setProperty('--cy-scale', t.scale);
  }

  /* Public hooks for boot.js */
  window.CyResponsive = {
    applyScale: applyScale,
    finalTransform: finalTransform,
    wideTransform: wideTransform,
    lock: function() { locked = true; },
    unlock: function() { locked = false; applyScale(); }
  };

  window.addEventListener('resize', applyScale);
  applyScale();
})();
