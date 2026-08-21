# THE BOOTH — home page and shared chrome redesign

Date: 2026-08-21
Status: approved, implementing

## Problem

The CRT boot sequence is the most interesting thing on the site, and the site
does not inherit any of it. This is not an oversight — it is written into the
stylesheet. `style.css` opens clean mode with:

> CLEAN MODE — the real site once you've come "through the screen".
> **No CRT frame, scanlines, glow, or glitch.** Readable centered column.

…and then deletes the frame, the scanlines, the glitch canvas and the keypad.
The boot spends twelve seconds building a machine and the site's first act is to
throw all of it away. What is left is a competent centered editorial column that
could belong to anyone.

## Concept

cyburdine.com is a public terminal — a lit glass booth standing at dusk in an
empty landscape. The boot is you walking up to it and powering it on. When the
boot ends you are not taken somewhere else: the camera settles and you are at
the glass, operating it. The world stays visible behind the interface.

References: Blade Runner's Esper machine, Syd Mead's industrial precision,
Simon Stålenhag's mundane-landscape-plus-intrusive-machine. The current trend
this lands in is "Surveillance Design" — recognition boxes, crosshairs, system
logs, timestamps, hard grids, condensed type, oversized numbers.

## The three-layer stack

Every effect must belong to a layer, and the layer is the reason the effect
exists. This is what separates the design from decoration.

```
z2  INTERFACE   crisp HUD — rails, brackets, records, type. Never blurred.
z1  GLASS       the booth window — sheen, edge falloff, faint grime, vignette
z0  WORLD       dusk sky, horizon, far silhouettes, dust, parallax
```

The CRT signature survives on the **glass**, not on the content. Text stays
sharp; atmosphere lives behind it. This is the single most important rule in
the design — an effect applied to the interface layer is a bug.

## Tying the site to the boot

Three hooks, strongest first:

1. **The boot log becomes the status ticker.** Today `:: LAUNCHING INTERFACE ...`
   plays and then everything is destroyed. Instead the log shrinks into the
   bottom rail and keeps running for the life of the page. The machine never
   stops talking. This does more than any styling.
2. **Green becomes the machine's voice, not the site's skin.** Phosphor
   `#15ff00` is currently everything during boot and nothing after. New rule:
   green speaks only for *live* things — the LIVE dot, the clock, the ticker,
   the cursor. Rare and precious. Continuity without the readability cost of
   green body text.
3. **The handoff recedes instead of deleting.** Scanlines fade back into the
   glass layer, the world rises behind, and the HUD rails draw themselves on.

## Palette

Stålenhag's signature is a cold sky against warm dust at the horizon. The
existing cyan/amber interface colours survive; the world is new.

```
--w-sky-high   #101826   cold indigo zenith
--w-sky-mid    #24313c
--w-sky-low    #3d4a52   slate
--w-haze       #6b6152   warm dust at the horizon
--w-far        #1a222b   silhouette

--i-ink        #e8f1f5   interface text
--i-dim        #7d95a3   meta / labels          (unchanged)
--i-line       #22323f   rules and brackets
--i-signal     #4fd6d6   cyan, data + interactive (unchanged)
--i-alarm      #ffb020   amber, status only, sparingly (unchanged)
--i-live       #15ff00   phosphor — LIVE elements only
```

## Type

Add **IBM Plex Sans Condensed** (400, 600) as the display face. Same family
already self-hosted, so it is one vendor and ~40KB total. It buys the condensed
/ hard-grid / oversized-number language. Mono stays for labels and telemetry;
Plex Sans stays for body copy.

## Home page layout

Full-bleed and edge-anchored. No centered column.

- **Top rail** — `CYB//NODE`, a live `▪ LIVE` dot, live UTC clock, coordinates.
- **IDENT** — the three roles set large in condensed, tagline beneath, crosshair
  marks at the corners of the panel.
- **BUILD LOG** — the gallery as a machine index. Each project is a *record*:
  an oversized cropped number, a condensed title, a thumbnail that resolves from
  dithered to sharp on hover, mono tag chips.
- **Recognition box** — on hover/focus a surveillance bracket snaps around the
  record. Pure CSS.
- **Bottom rail** — nav, reboot, and the ticker carrying the boot log.

## Motion budget

- Record reveals: scroll-driven CSS (`animation-timeline: view()`) behind
  `@supports`, authored so the finished state is the default and the animation
  is the enhancement. No JS.
- World parallax: one `pointermove` + `scroll` handler writing CSS variables.
- Particulate: one small canvas, ~60 motes, following the existing
  `video_glitch.js` pattern.
- `prefers-reduced-motion: reduce` disables parallax and particulate and serves
  a static world.

## Scope

- `index.html` — full redesign.
- Shared chrome (rails, palette, type, footer, script tags) — all 10 nav-bearing
  pages. They are duplicated by design, so a chrome change touches all 10
  regardless. `site/Periphony_8D/index.html` is standalone and excluded.
- The 7 project articles, `about.html`, `404.html` — keep their reading measure.
  They inherit the rails and the glass, but the world dims and the particulate
  stops: a document open on the device, not a HUD to fight through. Over-designing
  a 12,000-character article is where this aesthetic dies.

## Constraints preserved

- No build step. Vanilla CSS + JS, self-hosted fonts.
- CSP unchanged — everything is same-origin, no new external hosts.
- `project_rotate.js`'s contract is untouched: records remain identical markup
  differing only by a variant class, so promotion is still a node move plus a
  class swap.
- `deploy.sh`'s `?v=` cache-busting covers the new JS and CSS automatically.
  A new font file is referenced from CSS, so it inherits the CSS bust.
- `render.js` opt-out (`data-cy-render="off"`) still applies to article pages.

## Decisions taken during the design

- **`cy-clean` is not renamed to `cy-live`.** The concept changes but the class
  is load-bearing across `style.css`, `boot.js` and `render.js`; renaming ~100
  occurrences is churn with no user-visible benefit. The comment block that
  defines it is rewritten instead.
- **No WebGL.** The Stålenhag look is atmospheric layering and value control,
  not shader work. CSS gradients, SVG silhouettes, blur and grain get there
  without putting a large dependency on a site whose identity is having no
  build step.
- **`CLAUDE.md`'s "CSS Design" section is stale** — it describes VT323, phosphor
  body text and a teal nav bar that the stylesheet already left behind. It is
  rewritten as part of this work.

## Success criteria

- The home page reads as one continuous machine with the boot, not a separate
  document that happens to follow it.
- Articles remain comfortable to read at length.
- Reduced-motion and keyboard paths are complete, not afterthoughts.
- Nav-bearing page count stays at 10 and all shared chrome stays in sync.
