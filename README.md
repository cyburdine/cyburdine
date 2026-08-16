[![Claude Code token usage](https://tokenator.cyburdine.com/cyburdine/badges/tokens.svg)](https://tokenator.cyburdine.com)

# cyburdine.com

Personal portfolio site — cyberpunk retro-terminal aesthetic, rendered inside a
CRT monitor frame.

**Plain static HTML. No build step.** `site/` is the nginx document root and is
deployed verbatim. Open `site/index.html` in a browser and it works.

## Preview locally

```bash
cd site && python3 -m http.server 8099   # http://localhost:8099/
```

`python3 -m http.server` has no `try_files`, so browse `/about.html` rather than
`/about` locally. nginx resolves the extensionless URLs in production.

## Deploy

```bash
./deploy.sh              # publish site/ as a new release on cyb-proto4
./deploy.sh --rollback   # revert to the previous release
./deploy.sh --list       # show releases, marking the live one
```

Deploying is manual and does not go through CI — pushing to `main` publishes
nothing. See `CLAUDE.md` for the server layout and TLS details.

## Adding a project

Dropping the build step means the project list is no longer generated from a
collection. Adding a project is **two edits**, and it is easy to forget the
second:

**1. Create the page.** Copy an existing detail page and edit it. Copying is
what keeps `<html data-cy-render="off">` on the new page — that attribute
disables the katakana render effect, which is a wait rather than a flourish on
a long article. All existing detail pages carry it, so a copy inherits it:

```bash
cp -r site/projects/spirefall-ghost-code site/projects/<new-slug>
$EDITOR site/projects/<new-slug>/index.html
```

**2. Add its card to `site/projects.html`.** Jekyll used to generate this from
the `_projects` collection; now it is written by hand. Add an `<article>` inside
`.cy-tiles`, copying the shape of the ones already there — the markup is
identical for every project, hero included:

```html
<article class="cy-project cy-tile" data-slug="<new-slug>">
  <div class="cy-project__media"> … </div>
  <div class="cy-project__body">
    <span class="cy-project__eyebrow cy-meta">// featured build</span>
    <a class="cy-project__title" href="/projects/<new-slug>/">Title</a>
    <p class="cy-project__desc">…</p>
    <div class="cy-project__meta cy-meta">// tag &middot; tag</div>
  </div>
</article>
```

Keep the eyebrow even on a tile — it is hidden by CSS there, and it has to be
present for the card to work if `project_rotate.js` ever promotes it to the
hero. Add `data-cy-rotate` to put the project into the featured rotation; leave
it off to pin the card to the grid. Give the `<img>` its intrinsic `width` and
`height` so the grid does not reflow as images load.

**If the project has its own portal site**, close the write-up with a visit
block after the `:: get it` label — one `<a>` wrapping the screenshot and the
label, so the thumbnail and the text are a single click target:

```html
<a class="cy-visit" href="https://<slug>.cyburdine.com" target="_blank" rel="noopener">
  <img class="cy-visit__shot" src="/assets/images/articles/<slug>-portal.webp"
       alt="…" width="1280" height="720" loading="lazy" decoding="async">
  <span class="cy-visit__label">
    <span class="cy-visit__cta">visit website</span>
    <span class="cy-visit__host"><slug>.cyburdine.com</span>
  </span>
</a>
```

Thumbnails are captured at a 16:9 crop and encoded to 1280x720 webp so they read
as a matched set. If the portal is not live yet, swap the `<img>` for
`<span class="cy-shot-placeholder">site not live yet</span>` — **do not ship a
mocked-up screenshot of a site that does not exist.**

There is no tag filter and no `data-tags` any more — the search box and
dropdown were removed in August 2026, so a new tag needs no third edit.

Then `./deploy.sh`.

## Editing shared page furniture

There are no layouts or includes — the `<head>`, nav, footer and script tags are
duplicated across all 10 pages. **Any change to those must be made in every file
in `site/`.** The `:: open channel` contact block is the exception: it lives on
`index.html`, `about.html` and `404.html` only, not on the project posts. See the duplication rule in `CLAUDE.md`.

## License

BSD-3-Clause. See `LICENSE`.
