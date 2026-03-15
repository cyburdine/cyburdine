# Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cyburdine.com's CRT terminal layout work on mobile, tablet, and desktop using CSS `transform: scale()` with counter-scaled fonts.

**Architecture:** The 3000x1688px terminal container keeps its fixed dimensions. A wrapper div constrains visible height. A new JS file computes `scaleFactor = viewportWidth / 3000` and applies `transform: scale()`. Media queries counter-scale font sizes so text stays readable at any viewport width.

**Tech Stack:** Vanilla CSS, vanilla JS, Jekyll (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-03-15-responsive-design.md`

---

## File Structure

| File | Role | Action |
|------|------|--------|
| `_layouts/default.html` | Master layout | Modify: add viewport meta, wrapper div, responsive.js script tag |
| `assets/css/style.css` | Stylesheet | Modify: add wrapper styles, media queries, project width fix |
| `assets/js/responsive.js` | Scale computation | Create: computes and applies scale factor on load/resize |
| `assets/js/video_glitch.js` | Glitch canvas effect | Modify: size canvas to parent instead of window |

---

## Chunk 1: Core Scaling Infrastructure

### Task 1: Fix glitch canvas sizing bug

This is a pre-existing bug that will become more visible with responsive scaling. Fix it first.

**Files:**
- Modify: `assets/js/video_glitch.js:10-16`

- [ ] **Step 1: Update canvas resize function to use parent dimensions**

In `assets/js/video_glitch.js`, replace the `resize()` function (lines 11-14):

```javascript
// resize canvas to match terminal screen
function resize() {
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
}
```

- [ ] **Step 2: Verify file is correct**

Run: `cat -n assets/js/video_glitch.js | head -20`
Expected: lines 11-14 show `parent.clientWidth` / `parent.clientHeight`

- [ ] **Step 3: Commit**

```bash
git add assets/js/video_glitch.js
git commit -m "fix: size glitch canvas to parent terminal-screen instead of window"
```

---

### Task 2: Add viewport meta tag to default.html

**Files:**
- Modify: `_layouts/default.html:8`

- [ ] **Step 1: Add viewport meta tag after charset**

In `_layouts/default.html`, add after line 8 (`<meta charset="UTF-8">`):

```html
  <meta name="viewport" content="width=device-width, initial-scale=1">
```

- [ ] **Step 2: Verify**

Run: `grep -n "viewport" _layouts/default.html`
Expected: shows the new meta tag

- [ ] **Step 3: Commit**

```bash
git add _layouts/default.html
git commit -m "feat: add viewport meta tag for mobile rendering"
```

---

### Task 3: Add terminal-wrapper div to default.html

**Files:**
- Modify: `_layouts/default.html:14,25`

- [ ] **Step 1: Wrap `.terminal-container` in `.terminal-wrapper`**

In `_layouts/default.html`, replace:

```html
  <div class="terminal-container">
```

with:

```html
  <div class="terminal-wrapper">
  <div class="terminal-container">
```

And replace:

```html
  </div>


<!-- site javascripts -->
```

with:

```html
  </div>
  </div>


<!-- site javascripts -->
```

- [ ] **Step 2: Add responsive.js script tag**

In `_layouts/default.html`, add after the visitor_metadata.js script tag:

```html
  <script src="{{ '/assets/js/responsive.js' | relative_url }}"></script>
```

- [ ] **Step 3: Verify structure**

Run: `grep -n "terminal-wrapper\|terminal-container\|responsive.js" _layouts/default.html`
Expected: wrapper opens before container, closes after container, responsive.js is loaded

- [ ] **Step 4: Commit**

```bash
git add _layouts/default.html
git commit -m "feat: add terminal-wrapper div and responsive.js script tag"
```

---

### Task 4: Create responsive.js

**Files:**
- Create: `assets/js/responsive.js`

- [ ] **Step 1: Write the scaling script**

Create `assets/js/responsive.js`:

```javascript
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
```

- [ ] **Step 2: Verify file exists and syntax is valid**

Run: `cat -n assets/js/responsive.js`
Expected: file contents match above

- [ ] **Step 3: Commit**

```bash
git add assets/js/responsive.js
git commit -m "feat: add responsive scaling script for terminal container"
```

---

## Chunk 2: CSS Media Queries and Component Adjustments

### Task 5: Add wrapper CSS and font counter-scaling media queries

**Files:**
- Modify: `assets/css/style.css` (append to end)

- [ ] **Step 1: Add wrapper styles and responsive media queries**

Append to `assets/css/style.css`:

```css
/* ─── RESPONSIVE WRAPPER ─── */

.terminal-wrapper {
  width: 100%;
  overflow: hidden;
  background: #000;
}

/* ─── RESPONSIVE FONT COUNTER-SCALING ─── */
/* Font size formula: baseSize * (3000 / viewportWidth)
   Using vw: 1vw = viewportWidth/100, so we use calc(30 * Xvw)
   to achieve an effective ~16px at any scale.
   30 = 3000/100, the constant multiplier. */

/* Tablet: 768px–1023px (scale ~0.26–0.34) */
@media (max-width: 1023px) {
  .terminal-screen {
    font-size: calc(30 * 0.55vw);
    line-height: 1.5;
  }

  nav.console {
    padding-left: 1rem;
  }

  nav.console a {
    margin-right: 12px;
  }
}

/* Mobile: <768px (scale ~0.125–0.26) — more aggressive counter-scaling */
@media (max-width: 767px) {
  .terminal-screen {
    font-size: calc(30 * 0.75vw);
    line-height: 1.5;
  }

  nav.console {
    padding-left: 0.5rem;
  }

  nav.console a {
    margin-right: 8px;
  }

  .user-widget {
    display: none;
  }
}
```

- [ ] **Step 2: Verify media queries were appended**

Run: `grep -n "@media" assets/css/style.css`
Expected: two `@media` rules at the end of the file

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "feat: add responsive wrapper and font counter-scaling media queries"
```

---

### Task 6: Fix project text width

**Files:**
- Modify: `assets/css/style.css:321`

- [ ] **Step 1: Change fixed project width to max-width**

In `assets/css/style.css`, in the `.project` rule, replace:

```css
  width: 1020px;
```

with:

```css
  max-width: 100%;
```

- [ ] **Step 2: Verify**

Run: `grep -A5 "\.project {" assets/css/style.css | head -8`
Expected: shows `max-width: 100%` instead of `width: 1020px`

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "fix: use max-width for project text to support responsive layout"
```

---

### Task 7: Manual testing across viewports

No code changes — verification only.

- [ ] **Step 1: Start Jekyll dev server**

Run: `bundle exec jekyll serve`

- [ ] **Step 2: Test in browser dev tools at each breakpoint**

Open `http://localhost:4000` and use Chrome/Firefox responsive mode to test:

| Viewport | What to check |
|----------|---------------|
| 375px (iPhone SE) | CRT frame visible, text readable without zoom, nav fits, widget hidden, all effects run |
| 390px (iPhone 14) | Same as above |
| 768px (iPad portrait) | CRT frame visible, text readable, widget hidden at exactly 767px, visible at 768px |
| 1024px (iPad landscape) | Full layout, widget visible, nav spacing normal |
| 1440px (desktop) | Layout matches pre-change behavior |
| 3200px (ultrawide) | Scale capped at 1.0, no upscaling |

- [ ] **Step 3: Test touch scrolling**

In responsive mode, verify scrolling works within the terminal screen area on simulated touch devices.

- [ ] **Step 4: Test all pages**

Navigate to `/`, `/blog`, `/projects`, `/about` and verify each renders correctly at mobile and tablet widths.

- [ ] **Step 5: If fixes needed, apply and commit**

Fix any issues found during testing. Each fix gets its own commit.

---

## Chunk 3: Final Verification

### Task 8: Update CLAUDE.md with responsive info

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add responsive section to CLAUDE.md**

Add a brief section documenting the responsive approach:

```markdown
## Responsive Design

The site uses CSS `transform: scale()` to shrink the fixed 3000x1688px terminal container to fit any viewport. `assets/js/responsive.js` computes the scale factor on load/resize. Font sizes inside `.terminal-screen` are counter-scaled via media queries so text stays readable. Three breakpoints: desktop (1024px+), tablet (768-1023px), mobile (<768px). The visitor widget is hidden on mobile.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add responsive design section to CLAUDE.md"
```
