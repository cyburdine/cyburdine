# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cyburdine.com is a personal portfolio site for Justin Burdine, built with a cyberpunk retro-terminal aesthetic. The entire site renders inside a CRT monitor frame image with scanlines, glitch effects, and a Japanese character "decryption" animation on page load. On first visit to the landing page, a cinematic CRT boot sequence plays (zoom into the monitor → power-on → Cyburdine Systems boot log → fade into the site).

## Tech Stack

- **Jekyll 4.4** static site generator (Ruby)
- **GitHub Pages** deployment via GitHub Actions (`.github/workflows/jekyll.yml`)
- Vanilla CSS + JavaScript (no frameworks, no bundlers)
- Self-hosted fonts: VT323 (primary monospace), Noto Sans JP subset (decode effect only, 15 glyphs)
- BSD-3-Clause license

## Build & Serve Commands

```bash
bundle install                    # install dependencies
bundle exec jekyll serve          # local dev server at localhost:4000
bundle exec jekyll build          # production build to _site/
```

## Architecture

### Layout System

- `_layouts/default.html` — Master layout. Wraps all content in `.terminal-container` > `.terminal-screen` with the CRT frame overlay (`terminal-full.webp`). Loads all JS files (boot.js first). Also contains the invisible `.cy-egg` easter-egg link over the "4" key.
- `_layouts/project.html` — Project page layout, inherits from `default`. Wraps content in `.console` class.

### Collections

- `_projects/` — Custom collection configured in `_config.yml` with `output: true` and permalink `/projects/:path/`

### Pages

- `index.md` — Landing page with terminal-style "handshake" text
- `projects.md` — Project listing with client-side search/tag filtering
- `about.md` — Bio/profile page

### Visual Effects (JavaScript)

All scripts are IIFEs loaded on every page via `default.html` (boot.js first, so it can set `window.__CY_BOOT_PENDING__` to defer the others):

- `assets/js/boot.js` — The first-visit CRT boot sequence (landing page only, gated by a `cy_booted` localStorage flag). Orchestrates the timeline in `playBoot()`: cold start → wide shot → zoom into the monitor → power-on flash → centered logo warm-up → boot log → blank → fade the site in. Exposes `window.CyBoot.replay()` (wired to the `.cy-egg` easter egg) and coordinates with decode/glitch via `window.CyDecode`/`window.CyGlitch`. Timeline constants live in the `T` object; the boot overlays are confined to the CRT glass via the `--glass-*` CSS variables.
- `assets/js/decode.js` — Randomly replaces ~30% of visible characters with Japanese glyphs, then "decrypts" them back (750ms delay, 8ms per character). Deferred when a boot is pending; exposes `CyDecode.start()`/`CyDecode.replay()`.
- `assets/js/video_glitch.js` — Canvas-based random horizontal glitch lines at ~30fps. Deferred when a boot is pending (no lines until the monitor powers on); exposes `CyGlitch.start()`. Config constants at the top.

### CSS Design

`assets/css/style.css` — Single stylesheet. Key design decisions:
- Terminal container is fixed at 3000x1688px (matches the CRT frame image)
- `.terminal-screen` is absolutely positioned within the frame; it is wider than the visible (transparent) CRT glass, so boot overlays use the `--glass-*` inset variables to line up with the actual screen
- Screen background is the phosphor-green `--crt-bg` gradient (shared by the boot console and the live site)
- Scanlines via `::before` pseudo-elements with repeating gradients
- Neon glow via `text-shadow` on `.glow` and `.console` classes
- Color palette: `#15ff00` (green text), `#33ffcc` (cyan links), `#ff33cc` (pink accents), `#008080` (teal nav bar)

## Content Style

All content uses a cyberpunk terminal aesthetic with `::` prefixes, `//` comments, and monospace formatting. Project pages should maintain this voice.

## Responsive Design

`assets/js/responsive.js` computes a `transform: scale()` that "contains" the monitor in the viewport, pinned to the top-left, so the whole monitor is always visible (the keypad fills surplus width on wide screens). It publishes the live scale as `--cy-scale`; `.terminal-screen` font size counter-scales off it (`min(16px / var(--cy-scale), 52px)` — the cap keeps long lines on-screen on phones). When the scaled console is shorter than the viewport (phones in portrait), it centers vertically (letterbox) instead of pinning top. `responsive.js` exposes `CyResponsive.finalTransform()/wideTransform()/lock()/unlock()`, which `boot.js` drives during the zoom.

## Deployment

Push to `main` triggers the GitHub Actions workflow which builds with Jekyll and deploys to GitHub Pages. No manual deployment needed.
