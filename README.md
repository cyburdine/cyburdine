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
collection. Adding a project is **three edits**, and it is easy to forget the
second and third:

**1. Create the page.** Copy an existing detail page and edit it:

```bash
cp -r site/projects/spirefall-ghost-code site/projects/<new-slug>
$EDITOR site/projects/<new-slug>/index.html
```

**2. Add its card to `site/projects.html`.** Jekyll used to generate this from
the `_projects` collection; now it is written by hand. Add an `<article>` to the
`.cy-cards` list, copying the shape of the ones already there:

```html
<article class="project-item cy-card" data-tags="vfx,diy">
  ...
</article>
```

`data-tags` must be **comma-joined with no spaces** — `assets/js/project_filter.js`
matches each tag exactly. Add `cy-card--stub` alongside `cy-card` for a
placeholder entry. Never put an inline `display` style on a card; the filter
toggles `style.display` and relies on CSS for the default.

**3. If the project introduces a new tag, add it to the filter dropdown.** The
`<select id="projectTagFilter">` in `site/projects.html` has a literal `<option>`
per tag, kept in alphabetical order. A tag that exists only in `data-tags` will
filter correctly if selected but will never appear as a choice:

```html
<option value="newtag">newtag</option>
```

Then `./deploy.sh`.

## Editing shared page furniture

There are no layouts or includes — the `<head>`, nav, footer, contact block and
script tags are duplicated across all 10 pages. **Any change to those must be
made in every file in `site/`.** See the duplication rule in `CLAUDE.md`.

## License

BSD-3-Clause. See `LICENSE`.
