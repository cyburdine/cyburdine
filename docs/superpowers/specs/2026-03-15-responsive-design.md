# Responsive Design for cyburdine.com

## Summary

Make cyburdine.com work on mobile, tablet, and desktop while preserving the CRT frame image on all devices. Use CSS `transform: scale()` to uniformly shrink the fixed-dimension terminal container to fit any viewport width, with counter-scaled font sizes to keep text readable.

## Constraints

- CRT frame must be visible on all devices
- All visual effects (glitch canvas, decode animation, scanlines) stay active on all devices
- Visitor metadata widget hidden on mobile (<768px)
- No new dependencies — vanilla JS only

## Breakpoints

| Tier    | Width        | Scale factor range | Notes |
|---------|--------------|--------------------|-------|
| Desktop | 1024px+      | ~0.34–1.0          | Current layout, minimal changes |
| Tablet  | 768–1023px   | ~0.26–0.34         | Frame scales down, text counter-scaled |
| Mobile  | <768px       | ~0.125–0.26        | Widget hidden, text aggressively counter-scaled |

## Architecture

### Core Scaling Mechanism

The `.terminal-container` retains its native 3000x1688px dimensions and all absolute pixel positioning within it. A new `.terminal-wrapper` div wraps it and constrains the visible height.

A small inline-free JS file (`assets/js/responsive.js`) computes the scale factor on load and resize:

```
scaleFactor = Math.min(window.innerWidth / 3000, 1)
container.style.transform = `scale(${scaleFactor})`
container.style.transformOrigin = 'top left'
wrapper.style.height = `${1688 * scaleFactor}px`
```

The scale factor is capped at 1.0 so viewports wider than 3000px don't upscale. This preserves pixel-perfect alignment between the CRT frame overlay and the screen area at any viewport size.

### Font Counter-Scaling

Inside `.terminal-screen`, font-size is set via media queries to compensate for the container shrink:

- Desktop (1024px+): base size, no compensation needed (~16-20px)
- Tablet (768–1023px): ~24-28px (compensates for ~0.3 scale)
- Mobile (<768px): ~32-40px (compensates for ~0.125-0.26 scale)

Concrete formula: `font-size = baseSize / scaleFactor`. Since scaleFactor is `viewportWidth / 3000`, this simplifies to `font-size = baseSize * 3000 / viewportWidth`. Using `vw` units: `1vw = viewportWidth / 100`, so `font-size: calc(3000px / 100 * baseVW)` achieves smooth scaling. Target: text renders at ~16px effective screen size across all viewports.

Line-height should also be set explicitly (1.4–1.6) to maintain readability at counter-scaled sizes.

### Viewport Meta Tag

Add to `<head>` in `default.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

### Component Adjustments

**Nav bar (`nav.console`):**
- Current: `padding-left: 2rem`, `gap: 0.25rem`, links have `margin-right: 20px`
- Mobile (<768px): `padding-left: 0.5rem`, link `margin-right: 8px`
- Tablet (768–1023px): `padding-left: 1rem`, link `margin-right: 12px`
- Font size inherits counter-scaling from `.terminal-screen`

**Visitor widget (`.user-widget`):**
- `display: none` below 768px

**Project text (`.project`):**
- Change `width: 1020px` to `max-width: 100%` (works at all sizes, no breakpoint needed)

**Glitch canvas (`#glitchCanvas`):**
- Bug fix required: `video_glitch.js` currently sizes the canvas to `window.innerWidth/Height`, but the canvas is a child of `.terminal-screen` (1469x1069px). Under the scale transform, using window dimensions causes the canvas to extend beyond the screen area. Fix: size the canvas to its parent `.terminal-screen` dimensions instead (`parentElement.clientWidth/clientHeight`). This also fixes existing behavior on viewports smaller than the terminal screen.

**Decode effect (`decode.js`):**
- No changes — operates on DOM text nodes regardless of scale

**Scrolling:**
- `.terminal-screen` already has `overflow-y: auto` — content scrolls within the screen area
- Touch scrolling works natively in the overflow region

## Files Changed

| File | Change |
|------|--------|
| `_layouts/default.html` | Add viewport meta tag, wrap `.terminal-container` in `.terminal-wrapper`, load `responsive.js` |
| `assets/css/style.css` | Add `.terminal-wrapper` styles, three-tier media queries for font counter-scaling, widget hiding, nav compacting, project width fix |
| `assets/js/responsive.js` | New file — scale computation on load/resize |

## Files NOT Changed

- `assets/js/decode.js` — DOM-based, scale-independent
- `assets/js/visitor_metadata.js` — hidden by CSS on mobile, no JS changes

## Files With Bug Fixes

| File | Fix |
|------|-----|
| `assets/js/video_glitch.js` | Size canvas to parent `.terminal-screen` dimensions instead of `window.innerWidth/Height` |

## Testing

- Verify CRT frame is visible and aligned at: 375px (iPhone SE), 390px (iPhone 14), 768px (iPad portrait), 1024px (iPad landscape), 1440px+ (desktop)
- Verify text is readable without pinch-zoom at each size
- Verify all effects run (scanlines, glitch, decode) at each size
- Verify widget is hidden below 768px and visible above
- Verify nav links don't overflow on mobile
- Verify scrolling works within terminal screen on touch devices
