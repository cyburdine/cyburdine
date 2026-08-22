#!/usr/bin/env bash
# Renders the gallery thumbnail plates to site/assets/images/articles/.
#
#   ./build.sh                 all plates
#   ./build.sh replay          just one (any number of slugs)
#
# Why a browser: there is no ImageMagick, Pillow or rembg on the build
# machine, and the plates need type set in the site's own fonts, real
# gradients, and a background knockout. Chrome already does all four, and
# it is the same engine the thumbnails will be looked at in.
#
# Why a server rather than file:// — matte.js reads pixels back out of a
# canvas, and a file:// image taints it, so getImageData throws.
#
# Output is site/assets/images/articles/<slug>-thumb.webp.
#
# NOTE ON RE-RUNS. Images ship stable names under `Cache-Control:
# max-age=604800`, deploy.sh only cache-busts /assets/{css,js}, and there
# is no Cloudflare purge in this pipeline. So the first build of a plate is
# free — `-thumb.webp` is a new URL — but RE-RENDERING one that is already
# live and deploying it in place will serve the old bytes from the edge for
# up to a week. If you change a plate after it has shipped, rename it
# (`-thumb2.webp`) and update index.html, exactly as the Таксофон plate
# had to. Rendering here does not do that for you, because doing it
# automatically would mean a new filename on every antialiasing wobble.
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
OUT="$ROOT/site/assets/images/articles"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8791

[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME" >&2; exit 1; }
command -v cwebp >/dev/null || { echo "cwebp not found (brew install webp)" >&2; exit 1; }

PLATES=("$@")
if [ ${#PLATES[@]} -eq 0 ]; then
  PLATES=()
  for f in plates/*.html; do PLATES+=("$(basename "$f" .html)"); done
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT/tools/thumbs/plate.css" -o /dev/null && break
  sleep 0.1
done

PROFILE="$(mktemp -d)"
trap 'kill $SERVER 2>/dev/null || true; rm -rf "$PROFILE"' EXIT

for slug in "${PLATES[@]}"; do
  [ -f "plates/$slug.html" ] || { echo "no plate for $slug" >&2; exit 1; }
  png="out/$slug.png"
  # --virtual-time-budget lets the page's own clock run ahead to idle, so
  # the shot waits on document.fonts.ready and the matte pass instead of
  # racing a fixed sleep.
  # Chrome writes the screenshot and then does not exit — in either headless
  # mode, and regardless of --virtual-time-budget. Waiting on the process
  # meant every plate cost the full budget in wall clock and the build
  # looked hung. So: run it detached, wait for the PNG to appear and stop
  # growing, then kill it. The file is the completion signal, not the exit
  # code.
  rm -f "$PWD/$png"
  "$CHROME" --headless=old --disable-gpu --hide-scrollbars \
    --user-data-dir="$PROFILE" \
    --window-size=1600,900 --force-device-scale-factor=1 \
    --virtual-time-budget=8000 \
    --screenshot="$PWD/$png" \
    "http://127.0.0.1:$PORT/tools/thumbs/plates/$slug.html" >/dev/null 2>&1 &
  chrome_pid=$!

  size=0; stable=0
  for _ in $(seq 1 300); do
    sleep 0.2
    if [ -f "$png" ]; then
      now=$(wc -c < "$png")
      if [ "$now" -gt 0 ] && [ "$now" -eq "$size" ]; then
        stable=$((stable + 1))
        [ "$stable" -ge 3 ] && break
      else
        stable=0
      fi
      size=$now
    fi
  done
  kill "$chrome_pid" 2>/dev/null || true
  wait "$chrome_pid" 2>/dev/null || true

  [ -s "$png" ] || { echo "render failed: $slug" >&2; exit 1; }

  # A plate that has already shipped cannot be re-rendered under its own
  # name — see the cache note above — so it declares the name it wants:
  #   <meta name="cy-thumb" content="periphony-thumb2.webp">
  # Keeping that in the plate rather than in a rename step here means the
  # next run writes the right file on its own instead of quietly rebuilding
  # a URL nothing points at any more.
  named="$(sed -n 's/.*<meta name="cy-thumb" content="\([^"]*\)".*/\1/p' "plates/$slug.html" | head -1)"
  webp="$OUT/${named:-$slug-thumb.webp}"
  cwebp -quiet -q 88 -m 6 "$png" -o "$webp"
  echo "$slug  ->  ${webp#$ROOT/}  ($(du -h "$webp" | cut -f1))"
done
