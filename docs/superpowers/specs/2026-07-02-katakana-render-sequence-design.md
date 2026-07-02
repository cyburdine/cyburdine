# Katakana "render" sequence — design

Date: 2026-07-02
Status: approved

## Goal

Replace the current landing finale (clear boot log → redraw the site in the tube
→ zoom into a heading letter → land clean) with a new two-part identity:

1. **First-visit cinematic** — after the boot log runs it **holds**, the camera
   **zooms into the Cyburdine Systems logo** using the existing "through the CRT
   screen" pass-through FX, then the screen goes **black**.
2. **Per-page render** — on a black terminal, a cursor **types the page's real
   content as katakana**, and as the cursor reaches each new line the finished
   line **converts to the real letters**, each glyph glitching during the flip.
   Lands on today's clean site. This render runs on **every page load**.

## Decisions (from brainstorming)

- Typed layout = the page's **real structure** with katakana glyphs substituted,
  converting line-by-line to real text (not generic filler).
- Render environment = **clean black terminal** (green VT323, no CRT frame). The
  CRT/bezel appears **only** in the first-visit boot. Final look = today's clean
  page.
- Render scope = **`<main>` only**. Nav + footer fade in. Long posts type their
  whole `<main>` body.
- A "line" = a newline-delimited run (`\n` inside `<pre>`) or a block boundary —
  not a wrapped visual line. Matches "cursor reaches the next line."
- Typing speed stays fast (~20ms/char) so long pages render in a few seconds.
- `prefers-reduced-motion` → skip typing/cinematics, reveal clean page at once.

## Components

### `assets/js/render.js` (new) — the per-page materialize effect

- Owns the katakana glyph set (the 15-glyph Noto Sans JP subset, moved here from
  `decode.js`) and `--foreign-font`.
- `CyRender.play(opts)`:
  1. Tokenize `<main>` into ordered **lines**, each a list of char-spans. Walk
     text nodes in DOM order; split each on `\n`; treat block-element and `<br>`
     boundaries as line breaks. Preserve `\n` text nodes so `<pre>` layout holds.
  2. Wrap each visible char in `<span class="char">` (data-original), start empty
     so `<main>` is blank (black screen).
  3. **Typewriter:** reveal chars one at a time; non-space chars show as a random
     katakana glyph (`.char.foreign`, white). A block cursor (`.cy-cursor`)
     follows the caret.
  4. **Per-line convert:** when the caret finishes a line and moves to the next,
     flip the finished line's kana → real latin, each glyph doing a short
     scramble/flicker (`.cy-flip`), staggered a few ms apart. Overlaps typing of
     the next line.
  5. On completion: leave the cursor at the end (today's resting look), drop
     `cy-rendering`, fade nav + footer in.
- Reduced motion / missing DOM → reveal `<main>` real text immediately + place
  the end cursor; no typing.

### `assets/js/boot.js` (rewired first-visit cinematic)

- Unchanged through the boot log. Boot log finishes and **holds** (log + logo
  stay on screen).
- New `zoomIntoLogoThenBlack()` replaces `loadSiteInTube` / `charZoom` /
  `landCleanChar`: reuse the continuous exponential-scale + eased-time zoom
  frames and the pass-through FX (`.cy-scanbloom`, `.cy-bloom-in`, `.cy-flash`,
  noise) — focal target is the **logo** — then fade to **black**.
- Hand off: add `cy-clean cy-rendering`, tear down the boot console + FX, call
  `CyRender.play()` to type the landing page.
- Non-boot loads (navigation / returning): add `cy-clean cy-rendering`
  pre-paint, then `ready()` → `CyRender.play()`.
- Easter egg (`.cy-egg`) and **D** key still replay the full cinematic.

### `assets/js/decode.js` (retired)

The render supersedes the old "scramble 30% then decrypt" reveal, which only ran
in a live CRT state that no longer exists. Remove it from `default.html` /
`preview.html`, drop `CyDecode` calls from `boot.js`, delete the file. Glyph set
+ `--foreign-font` move to `render.js`. `video_glitch.js` stays (used in boot).

### CSS (`assets/css/style.css`)

- `html.cy-rendering` → black background; hide `header` + `footer` (fade in on
  finish). Reuse `.cy-cursor` for the typing caret and `.char.foreign` for kana.
- New `.cy-flip` glitch animation for the kana→latin conversion — works in clean
  mode (brightness/RGB-split flick; not text-shadow dependent).

## Timeline changes (`T`)

- Keep: `coldFade zoomStart zoomDur pauseAfterZoom powerFlash warmupDelay
  logoShowHold slideDur preTextGap holdAfterBoot zoomInDur crossRamp`.
- Drop: `clearDur clearBlank redrawDur sitePrehold zoomOutDur` (no clear/redraw/
  zoom-out).
- Add: `blackHold` (beat on black before the render types).

## Verification

No local Jekyll — serve repo root with `python3 -m http.server` and open
`/preview.html` (`?boot=1` replays; `?boot=0` renders without the cinematic).
Watch: first visit = boot → logo zoom → black → katakana type → per-line convert
→ clean page. Navigation = black → type → convert → clean page. Reduced motion =
instant clean page.
