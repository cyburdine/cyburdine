# Through-the-Screen → Clean Mode — Design

**Date:** 2026-07-01
**Status:** Approved (design), ready for implementation planning

## Summary

Extend the first-visit CRT boot cinematic so that, after the boot log finishes,
the camera **pushes through the monitor glass** — Matrix-opening style, but by
zooming right up to a *real* CRT (scanlines and phosphor pixels growing huge)
rather than digital rain — then **blooms out into electric stylized static** and
**emerges on the other side into a clean, readable version of the site** with no
CRT frame, scanlines, glow, or glitch.

Clean mode becomes the site's real, permanent rendering. The CRT boot is
demoted to a one-time cinematic intro that you emerge from.

## Goals

1. Extend the opening: hold longer on the finished boot log, then a new
   "push through the glass" phase.
2. The push reads as zooming up to a physical monitor: scanlines thicken and
   spread, a phosphor/pixel mask grows in over the (enlarging) letters, so you
   see the dots that make up the text.
3. At contact, everything blooms into **electric stylized static** (blue-white
   with green flecks).
4. Emerge clean: the readable page, no CRT artifacts.
5. Clean mode is the site's default/permanent rendering after the first boot.

## Non-Goals

- Digital-rain / katakana tunnel (explicitly rejected in favor of the
  macro-into-a-real-tube look).
- Redesigning page content or information architecture.
- A user-facing light/CRT theme system beyond the single replay affordance.

## Decisions (locked)

- **Clean scope:** whole site, permanently. After the first boot, every page
  renders clean. The CRT appears only during an active boot run.
- **Transition:** macro push into the tube (growing scanlines + phosphor mask)
  → electric static bloom → emerge clean. No digital rain.
- **Clean look:** "cleaned-up terminal" — green-on-dark, crisp, no
  glow/scanlines/glitch/bezel; VT323 kept for headings/nav/accents; a clean
  self-hosted monospace for body copy.
- **Body font:** self-hosted **IBM Plex Mono** (CSP requires `font-src 'self'`).
- **Static tint:** electric blue-white with green flecks + a bloom flash.
- **Replay in clean mode:** keyboard shortcut (press **D**) replays the full
  boot → through-screen → clean.

## Architecture

### Clean mode is a class, not a layout

A single `html.cy-clean` class gates rendering. When present:

- The CRT frame image, both scanline `::before` overlays, `.glow`/`.console`/nav
  `text-shadow`, and the glitch canvas are removed.
- The scaled 3000×1688 stage (and `--cy-scale` counter-scaling driven by
  `responsive.js`) is neutralized.
- `.terminal-container` / `.terminal-screen` become normal document flow: a
  centered readable column (max-width ~72ch), comfortable padding, dark bg.

This keeps one set of Jekyll templates and content, and lets `boot.js` flip
CRT → clean in-place at the end of the cinematic. (A separate "clean" layout was
rejected: template duplication + a page reload mid-transition.)

### Clean is the default; CRT is only the cinematic

Rendering rule on load (any page):

- `shouldBoot = isLanding && !alreadyBooted` (plus existing `?boot=` / force
  overrides). Unchanged trigger for the cinematic.
- If `shouldBoot`: render the CRT as today, play the cinematic, and at the end
  apply `.cy-clean` + mark booted.
- Otherwise (returning visitor, or a first-time deep link to a non-landing
  page): apply `.cy-clean` **synchronously on `<html>` before first paint**
  (same pre-paint pattern as today's `cy-booting` guard), so there is no CRT
  flash and no boot.

Net effect: the CRT only ever appears as the boot cinematic on the landing
page's first visit; clean is the real site everywhere else.

## The "through the screen" effect

Driven from `boot.js`, replacing today's `endSequence` → `blank` → `revealSite`
tail. Three stacked pieces, all confined to the CRT glass via the existing
`--glass-*` insets:

1. **Extended hold.** Increase the hold on the finished boot log before the push
   begins (tune `T.holdAfterBoot`, or add a dedicated constant).

2. **Deeper push-in.** New `throughTransform()` in `responsive.js`: continues the
   container zoom well past `finalTransform()`, scaling up centered on the glass
   so the screen overshoots the viewport ("right up to the monitor"). `boot.js`
   animates `finalTransform → throughTransform` with an accelerating ease.

3. **Phosphor + scanline growth overlay.** A new overlay element over the boot
   glass whose scanline gap and a phosphor/aperture-grille dot mask (repeating
   gradients) start invisible/fine and animate to thick/large as the push
   accelerates. Because the boot text is real DOM, it enlarges naturally with the
   transform; the mask over it produces the "pixels making up the letters"
   reveal.

4. **Electric static bloom.** A canvas (or the reused glitch canvas) that snaps
   on at contact: animated white-noise static, electric blue-white tint with
   green flecks, plus a bloom flash, covering the frame glass. `.cy-clean` is
   applied underneath while the static is opaque; as the static fades out we
   emerge onto the clean page. Then tear down the boot overlays and CRT DOM.

### Timeline (conceptual)

```
... boot log finishes
  holdAfterBoot (extended)
  pushDur:  finalTransform → throughTransform, phosphor/scanline mask grows
  contact:  static bloom canvas fires (opaque)
            → apply html.cy-clean underneath, remove frame/scanlines/glow
  staticFade: static fades out, clean page fades up
  finish:   remove boot overlays, unlock responsive (no-op in clean), mark booted
```

## Clean-mode styling (`html.cy-clean`)

Additive overrides; existing CRT rules are untouched (they simply don't apply
under `.cy-clean`):

- **Removed:** `.terminal-frame` (display:none), `body::before` and
  `.terminal-screen::before` scanlines, `text-shadow` on `.glow`/`.console`/
  `nav.console`/`.char`, `#glitchCanvas`.
- **Layout:** `.terminal-container` and `.terminal-screen` reset to static
  positioning, auto size, centered max-width (~72ch) column with padding; the
  container transform is cleared and `--cy-scale` no longer applied.
- **Typography:** body uses IBM Plex Mono at a comfortable size with generous
  line-height and a softer high-contrast green on near-black; VT323 retained for
  headings, nav, and accent elements.
- **Colors:** keep the palette (`#33ffcc` links, `#ff33cc` pink, `#008080` teal
  nav) at readable contrast, without glow.

## Replay in clean mode

The on-frame "4"/"D" keypad hotspots are hidden in clean mode. Add a global
`keydown` handler: pressing **D** (when not typing in a field) removes
`.cy-clean` and calls `CyBoot.replay()`, running the full cinematic again and
re-entering clean at the end. The existing frame hotspots continue to work
during an active boot.

## Edge cases & accessibility

- **No CRT flash for returning/deep-link visitors:** `.cy-clean` set on `<html>`
  synchronously before paint (mirrors the `cy-booting` guard).
- **Reduced motion (`prefers-reduced-motion: reduce`):** skip the push and
  static entirely; go straight from the boot log to clean (and returning
  visitors go straight to clean, as they already do).
- **Decode/glitch effects:** in clean mode the decode "decrypt" reveal and the
  glitch lines are part of the CRT aesthetic; they should not run in clean mode.
  `boot.js` currently calls `triggerDecode()` / `CyGlitch.start()` on handoff —
  in the new flow these are gated so they don't run once clean.

## Files touched

- `assets/js/boot.js` — extended hold; new push-through + static-bloom phase;
  apply `.cy-clean` + mark booted at the end; pre-paint `.cy-clean` for the
  non-boot path; **D**-key replay in clean mode; gate decode/glitch off in clean.
- `assets/js/responsive.js` — `throughTransform()`; make `applyScale` a no-op (or
  clean-column-aware) under `.cy-clean`.
- `assets/css/style.css` — through-screen overlay + static styles; full
  `html.cy-clean` clean-mode stylesheet; `@font-face` for IBM Plex Mono.
- `assets/fonts/` — self-hosted IBM Plex Mono (subset if practical).
- `_layouts/default.html` — only if a new overlay/canvas element must be present
  in markup (preferred: create overlays from `boot.js`, as today).

## Testing / verification

- First visit to `/`: full cinematic → push → static → clean; `cy_booted` set.
- Reload `/`: lands clean immediately, no CRT, no flash.
- First-time deep link to `/blog`: clean, no boot.
- Press **D** on a clean page: replays cinematic, ends clean.
- `?boot=1`: forces the cinematic even when booted.
- `prefers-reduced-motion`: no push/static; clean reached directly.
- Readability: body text legible at desktop and phone widths; no glow/scanlines.
