/*
Desc: This displays random sized/placed video glitches on the screen (see configuration section below)
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
*/
    (function() {
      const canvas = document.getElementById('glitchCanvas');
      const ctx = canvas.getContext('2d');

      // resize canvas to match viewport
      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      window.addEventListener('resize', resize);
      resize();

      // CONFIGURATION
      const MAX_SPAWN_PER_FRAME = 3;   // up to this many new lines each frame (0–MAX)
      const MIN_LINE_HEIGHT = 5;        // px
      const MAX_LINE_HEIGHT = 20;        // px
      const TARGET_OPACITY = 0.12;      // max opacity per line
      const BLUR_RADIUS = 1.5;          // px
      const FRAME_INTERVAL = 5000 / 30; // ~30fps

      let lastTime = 0;
      const activeLines = [];

      function spawnLines() {
        // choose how many new lines to add (0 .. MAX_SPAWN_PER_FRAME)
        const count = Math.floor(Math.random() * (MAX_SPAWN_PER_FRAME + 1));
        for (let i = 0; i < count; i++) {
          const y = Math.random() * canvas.height;
          const h = MIN_LINE_HEIGHT + Math.random() * (MAX_LINE_HEIGHT - MIN_LINE_HEIGHT);
          const shade = 200 + Math.floor(Math.random() * 56); // 200–255

          // determine fade-in, visible, fade-out durations (in frames)
          const fadeIn = 1 + Math.floor(Math.random() * 2);   // 1 or 2 frames
          const visible = Math.floor(Math.random() * 2);      // 0 or 1 frame
          const fadeOut = 1 + Math.floor(Math.random() * 2);  // 1 or 2 frames

          activeLines.push({
            y, h, shade,
            fadeIn, visible, fadeOut,
            age: 0,
            lifespan: fadeIn + visible + fadeOut
          });
        }
      }

      function drawGlitch(timestamp) {
        if (timestamp - lastTime < FRAME_INTERVAL) {
          requestAnimationFrame(drawGlitch);
          return;
        }
        lastTime = timestamp;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // maybe spawn new lines this frame
        spawnLines();

        // draw and update each line
        for (let i = activeLines.length - 1; i >= 0; i--) {
          const line = activeLines[i];
          const { age, fadeIn, visible, fadeOut, lifespan, y, h, shade } = line;

          // compute opacity based on age
          let opacity = 0;
          if (age < fadeIn) {
            opacity = TARGET_OPACITY * ((age + 1) / fadeIn);
          } else if (age < fadeIn + visible) {
            opacity = TARGET_OPACITY;
          } else if (age < fadeIn + visible + fadeOut) {
            const t = age - (fadeIn + visible);
            opacity = TARGET_OPACITY * (1 - ((t + 1) / fadeOut));
          }

          if (opacity > 0) {
            ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${opacity})`;
            ctx.filter = `blur(${BLUR_RADIUS}px)`;
            ctx.fillRect(0, y, canvas.width, h);
            ctx.filter = 'none';
          }

          line.age++;
          if (line.age >= lifespan) {
            activeLines.splice(i, 1);
          }
        }

        // occasional slice shift
        if (Math.random() < 0.25) {
          const sliceHeight = 8 + Math.random() * 24; // 8–32px
          const sliceY = Math.random() * (canvas.height - sliceHeight);
          const offset = (Math.random() - 0.5) * 40;   // ±20px

          const imgData = ctx.getImageData(0, sliceY, canvas.width, sliceHeight);
          ctx.clearRect(0, sliceY, canvas.width, sliceHeight);
          ctx.globalAlpha = 0.5;
          ctx.putImageData(imgData, offset, sliceY);
          ctx.globalAlpha = 1;
        }

        requestAnimationFrame(drawGlitch);
      }

      requestAnimationFrame(drawGlitch);
    })();