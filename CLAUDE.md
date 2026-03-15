# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cyburdine.com is a personal portfolio and blog site for Justin Burdine, built with a cyberpunk retro-terminal aesthetic. The entire site renders inside a CRT monitor frame image with scanlines, glitch effects, and a Japanese character "decryption" animation on page load.

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

- `_layouts/default.html` — Master layout. Wraps all content in `.terminal-container` > `.terminal-screen` with the CRT frame overlay (`terminal-full.webp`). Loads all three JS files.
- `_layouts/post.html` — Blog post layout, inherits from `default`. Wraps content in `.console` class.
- `_layouts/project.html` — Project page layout, inherits from `default`. Wraps content in `.console` class.

### Collections

- `_posts/` — Blog posts (standard Jekyll, uses `post` layout)
- `_projects/` — Custom collection configured in `_config.yml` with `output: true` and permalink `/projects/:path/`

### Pages

- `index.md` — Landing page with terminal-style "handshake" text
- `blog.md` — Post listing with client-side search/tag filtering
- `projects.md` — Project listing with client-side search/tag filtering
- `about.md` — Bio/profile page

### Visual Effects (JavaScript)

All three scripts are IIFEs loaded on every page via `default.html`:

- `assets/js/decode.js` — On page load, randomly replaces ~30% of visible characters with Japanese glyphs, then "decrypts" them back to original text with a staggered animation (750ms delay, 8ms per character).
- `assets/js/video_glitch.js` — Canvas-based effect drawing random horizontal glitch lines with fade in/out and occasional slice-shift distortion at ~30fps. Configuration constants at the top of the file.
- `assets/js/visitor_metadata.js` — Creates a draggable, closeable "Connection Info" widget showing browser/platform/timezone data, positioned inside `.terminal-screen`.

### CSS Design

`assets/css/style.css` — Single stylesheet. Key design decisions:
- Terminal container is fixed at 3000x1688px (matches the CRT frame image)
- `.terminal-screen` is absolutely positioned within the frame at specific pixel offsets
- Scanlines via `::before` pseudo-elements with repeating gradients
- Neon glow via `text-shadow` on `.glow` and `.console` classes
- Color palette: `#15ff00` (green text), `#33ffcc` (cyan links), `#ff33cc` (pink accents), `#008080` (teal nav bar)

## Content Style

All content uses a cyberpunk terminal aesthetic with `::` prefixes, `//` comments, and monospace formatting. Blog posts and project pages should maintain this voice. Posts use front matter tags for the filtering system on `blog.md`.

## Responsive Design

The site uses CSS `transform: scale()` to shrink the fixed 3000x1688px terminal container to fit any viewport. `assets/js/responsive.js` computes the scale factor on load/resize. Font sizes inside `.terminal-screen` are counter-scaled via media queries so text stays readable. Three breakpoints: desktop (1024px+), tablet (768-1023px), mobile (<768px). The visitor widget is hidden on mobile.

## Deployment

Push to `main` triggers the GitHub Actions workflow which builds with Jekyll and deploys to GitHub Pages. No manual deployment needed.
