# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cyburdine.com is a personal portfolio site for Justin Burdine, built with a cyberpunk retro-terminal aesthetic. The entire site renders inside a CRT monitor frame image with scanlines, glitch effects, and a katakana "render" animation on page load. On first visit to the landing page, a cinematic CRT boot sequence plays (zoom into the monitor → power-on → Cyburdine Systems boot log → through-screen handoff into the site).

## Tech Stack

**Plain static HTML. There is no build step — no Ruby, no Jekyll, no template language, no bundler.** Opening `site/index.html` in a browser shows the page.

- Vanilla CSS + JavaScript
- Self-hosted fonts: VT323 (primary monospace), IBM Plex Mono, Noto Sans JP subset (render effect only)
- Served by nginx on `cyb-proto4`; deployed with `./deploy.sh`
- BSD-3-Clause license

> The site was migrated off Jekyll + GitHub Pages in August 2026. If you find
> instructions anywhere referring to `bundle exec jekyll serve`, `_config.yml`,
> `_layouts/`, `_includes/`, or the `_projects` collection, they are stale —
> none of those exist any more. The last Jekyll-buildable commit is tagged
> `jekyll-final`.

## Local Preview

No toolchain required. Either open the files directly, or serve them so that root-relative `/assets/...` paths resolve:

```bash
cd site && python3 -m http.server 8099   # then visit http://localhost:8099/
```

Note that `python3 -m http.server` has no `try_files`, so extensionless URLs do
not resolve locally — browse `/about.html`, not `/about`. nginx handles those in
production (see below).

## Repository Layout

```
site/                 ← the nginx document root, deployed verbatim
  index.html  about.html  projects.html  404.html
  projects/<slug>/index.html      one directory per project
  .well-known/security.txt
  assets/{css,js,fonts,images}
deploy.sh             ← the only deploy path
docs/superpowers/     ← design specs/plans from earlier work; NOT served
```

`site/` is the document root, so anything placed there is public. `docs/` sits
outside it deliberately — those planning documents used to be served by Jekyll
and no longer are.

## THE DUPLICATION RULE — read before editing any page

There are no layouts and no includes. **The `<head>`, the nav header, the footer
and the script tags are copied literally into all 11 HTML files.** This is the
deliberate trade for having no build step.

That means: **a change to the nav, the footer, the CSP meta tag or the script
tags must be applied to every page in `site/`.** Changing one page only will
silently desynchronise the site.

The `:: open channel` contact block is the exception — it is **not** universal.
It lives on `index.html`, `about.html` and `404.html` only. The project posts
deliberately omit it and close on their own `:: get it` links, so a change to
those outbound links touches three files, not ten.

```bash
# after any such change, confirm the count matches the page count (11)
grep -rl '<nav class="glow">' site --include='*.html' | wc -l
```

The copyright year in the footer is now a literal (Jekyll used to stamp it from
the build date). It needs a manual bump each January, in every page.

## Adding a Project

See `README.md` — it is **three** edits, not one.

## Visual Effects (JavaScript)

All scripts are IIFEs loaded on every page, in this order (boot.js first, so it
can set `window.__CY_BOOT_PENDING__` to defer the others):

- `assets/js/boot.js` — The first-visit CRT boot sequence (landing page only, gated by a `cy_booted` localStorage flag). Orchestrates the timeline in `playBoot()`: cold start → wide shot → zoom into the monitor → power-on flash → centered logo warm-up → boot log → through-screen handoff. Exposes `window.CyBoot.replay()` (wired to the `.cy-egg` easter eggs and the `.cy-reboot` footer link). Timeline constants live in the `T` object; boot overlays are confined to the CRT glass via the `--glass-*` CSS variables.
- `assets/js/render.js` — The katakana render sequence that supersedes the old `decode.js`. Types each page in as Japanese glyphs, then resolves them to the real text, driving the site into "clean mode" (`html.cy-clean`). Sets `html.cy-rendering` while in progress and removes it on completion. Honours `prefers-reduced-motion: reduce` with an instant reveal. Exposes `window.CyRender.play()`. **A page can opt out with `<html data-cy-render="off">`**, which takes the same instant-reveal path — the effect types every visible character, so on a 12,000-character article it is a wait rather than a flourish. All seven project detail pages are opted out. This skips the *effect only*: `cy-clean` is added by `boot.js`, not here, so an opted-out page still lands in the real site normally.
- `assets/js/video_glitch.js` — Canvas-based random horizontal glitch lines at ~30fps. Deferred when a boot is pending. Exposes `CyGlitch.start()`.
- `assets/js/project_rotate.js` — **Not global.** Loaded inline by `projects.html` only, immediately after the card markup so the DOM is settled before `render.js` walks `<main>`. See the contract section below.
- `assets/js/responsive.js` — Computes the `transform: scale()` that contains the monitor in the viewport and publishes it as `--cy-scale`. Exposes `CyResponsive.finalTransform()/wideTransform()/lock()/unlock()`, which `boot.js` drives during the zoom.

**Verifying animations in a browser-automation tab does not work reliably** —
rAF is throttled there, so `render.js` can sit in `cy-rendering` indefinitely and
page text stays empty. That is an artifact of the automation tab, not a bug; the
live site behaves identically under it. Check animations in a normal window.

## The `project_rotate.js` Contract

`site/assets/js/project_rotate.js` runs only on `projects.html`. It replaced
`project_filter.js`, which was removed in August 2026 along with the search box
and tag dropdown it drove — there is **no filtering on the site any more**, so
`project-item`, `data-tags` and the `<option>` list are all gone too.

It rotates which project holds the hero slot, so the page leads with something
different each load. The contract:

- **Every project is authored with identical markup.** `cy-feature` (hero) vs
  `cy-tile` (grid cell) on the `<article>` is the *only* difference between
  them. That is what makes promotion a node move plus a class swap — so a CSS
  rule that only makes sense in one variant must be written under that variant,
  never on the shared `.cy-project__*` classes.
- **`data-cy-rotate` marks an article as eligible** for the hero slot. Exactly
  one article is `cy-feature` in the HTML; that is also the no-JS result, so the
  page is complete without the script. Currently RE:play and Periphony 8D
  rotate; drop the attribute to pin a project to the grid.
- The picked article is swapped **in place** with the current feature, so the
  featured build never also appears in the grid below.
- Unlike the script it replaced, it **no-ops instead of throwing** when its
  elements are absent, so it is harmless if it ever loads on another page.

## CSS Design

`assets/css/style.css` — single stylesheet. Key decisions:
- Terminal container is fixed at 3000x1688px (matches the CRT frame image)
- `.terminal-screen` is absolutely positioned within the frame; it is wider than the visible (transparent) CRT glass, so boot overlays use the `--glass-*` inset variables to line up with the actual screen
- Screen background is the phosphor-green `--crt-bg` gradient
- Scanlines via `::before` pseudo-elements with repeating gradients
- Neon glow via `text-shadow` on `.glow` and `.console` classes
- Palette: `#15ff00` (green text), `#33ffcc` (cyan links), `#ff33cc` (pink accents), `#008080` (teal nav bar)

## Content Style

All content uses a cyberpunk terminal aesthetic with `::` prefixes, `//` comments, and monospace formatting. Project pages should maintain this voice.

## Content Security Policy

Every page ships its own CSP in a `<meta http-equiv="Content-Security-Policy">`
tag, including `frame-src https://www.youtube-nocookie.com` for the Firepype
trailer embed. **nginx deliberately does not send a CSP header** — a second
policy would intersect with the meta one and break that embed. If you add an
embed from a new origin, update the meta tag on *every* page.

## Deployment

```bash
./deploy.sh              # rsync site/ to a new timestamped release, flip `current`
./deploy.sh --rollback   # re-point `current` at the previous release
./deploy.sh --list       # show releases, marking the live one
```

Deploys go from Justin's Mac to `deploy@10.0.22.35` (`cyb-proto4`) over SSH.
There is **no CI deploy** — SSH to proto4 is not reachable from GitHub's
runners. Pushing to `main` publishes nothing; only `./deploy.sh` does.

`deploy.sh` rewrites `/assets/{css,js}/…` references in the release copy to
carry `?v=<release timestamp>`. This is load-bearing: those files keep stable
names and ship `Cache-Control: max-age=604800`, so without the query string
Cloudflare serves a week-old `style.css` against new HTML and a restyle simply
never appears. There is no Cloudflare purge in this pipeline. The rewrite
touches the deployed copy only — never the working tree — so do not add
`?v=` by hand in `site/`.

Server details:
- Document root `/opt/cyburdine.com/current` → `releases/<UTC timestamp>/` (atomic symlink flip, so no request sees a half-copied tree; no nginx reload needed)
- vhost `/etc/nginx/conf.d/cyburdine.com.conf`
- TLS via the Cloudflare Origin CA wildcard cert (`*.cyburdine.com`, valid to 2041); Cloudflare SSL/TLS mode must stay **Full (strict)**
- SELinux is **enforcing**: releases must be labelled `httpd_sys_content_t` or every request 403s. `deploy.sh` runs `restorecon` for you; the fcontext rule is already registered.

Two nginx details worth knowing before editing the vhost:

- `try_files $uri $uri.html $uri/ =404;` — **`$uri.html` must come before `$uri/`**. `/projects` is both `projects.html` and the `projects/` directory of detail pages; checking `$uri/` first makes `/projects` 301 to `/projects/`, which has no index and 404s.
- No `Strict-Transport-Security` header. This vhost serves the apex, and HSTS there would apply to `cyburdine.com` itself with no easy client-side undo. HSTS is Cloudflare's to manage.

When reading server state, use `sudo nginx -T` (the loaded config) rather than
grepping `/etc/nginx/` — `conf.d` holds retired `.bak-<timestamp>` files that
nginx never loads and that have been mistaken for live config before.
