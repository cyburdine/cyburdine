#!/usr/bin/env bash
#
# deploy.sh — publish cyburdine.com to cyb-proto4.
#
# The site is plain static HTML in site/; there is no build step. This script
# rsyncs site/ into a new timestamped release directory and atomically flips the
# `current` symlink that nginx's `root` points at. nginx resolves the symlink per
# request, so no reload is needed and no request ever sees a half-copied tree.
#
#   ./deploy.sh              deploy site/ as a new release
#   ./deploy.sh --rollback   re-point `current` at the previous release
#   ./deploy.sh --list       show releases and which one is live
#
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-10.0.22.35}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/cyburdine.com}"
VERIFY_URL="${VERIFY_URL:-https://new.cyburdine.com}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
LOCAL_SITE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/site"

die()  { printf '\n[deploy] ERROR: %s\n' "$*" >&2; exit 1; }
note() { printf '[deploy] %s\n' "$*"; }

# LogLevel=ERROR suppresses the host login banner so script output stays readable.
SSH_OPTS=(-o BatchMode=yes -o LogLevel=ERROR)
remote() { ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"; }

# ---------------------------------------------------------------- preflight ---
[ -d "$LOCAL_SITE" ]            || die "no site/ directory at $LOCAL_SITE"
[ -f "$LOCAL_SITE/index.html" ] || die "site/index.html missing — refusing to deploy an empty tree"
[ -f "$LOCAL_SITE/404.html" ]   || die "site/404.html missing — refusing to deploy without an error page"

remote true 2>/dev/null || die "cannot ssh to $SSH_TARGET"

# --------------------------------------------------------------------- list ---
list_releases() {
  remote "ls -1 '$REMOTE_ROOT/releases' 2>/dev/null | sort"
}
current_release() {
  remote "readlink '$REMOTE_ROOT/current' 2>/dev/null | xargs -r basename" || true
}

if [ "${1:-}" = "--list" ]; then
  cur="$(current_release)"
  note "releases on $DEPLOY_HOST (newest last):"
  list_releases | while read -r r; do
    if [ "$r" = "$cur" ]; then printf '  %s  <- live\n' "$r"; else printf '  %s\n' "$r"; fi
  done
  exit 0
fi

# ----------------------------------------------------------------- rollback ---
if [ "${1:-}" = "--rollback" ]; then
  cur="$(current_release)"
  [ -n "$cur" ] || die "no current release to roll back from"

  prev="$(list_releases | { grep -v -x "$cur" || true; } | awk -v c="$cur" '$0 < c' | tail -1)"
  [ -n "$prev" ] || die "no earlier release than $cur to roll back to"

  note "current:  $cur"
  note "rollback: $prev"

  # Atomic flip: `ln -sfn` over an existing symlink is NOT atomic (it unlinks,
  # then re-links, leaving a window with no target). Create a fresh symlink under
  # a temp name and rename it over the old one instead — rename(2) is atomic.
  remote "set -euo pipefail
    ln -sfn '$REMOTE_ROOT/releases/$prev' '$REMOTE_ROOT/.current.tmp.\$\$'
    mv -Tf '$REMOTE_ROOT/.current.tmp.\$\$' '$REMOTE_ROOT/current'"

  note "rolled back to $prev"
  note "verify: curl -sI $VERIFY_URL/ | head -1"
  exit 0
fi

[ "${1:-}" = "" ] || die "unknown argument: $1 (expected --rollback, --list, or nothing)"

# ------------------------------------------------------------------- deploy ---
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE="$REMOTE_ROOT/releases/$STAMP"

note "deploying $LOCAL_SITE -> $SSH_TARGET:$RELEASE"

remote "mkdir -p '$RELEASE'"

# --delete so a release directory is an exact mirror of site/, never a merge.
rsync -az --delete \
      --exclude '.DS_Store' \
      -e 'ssh -o BatchMode=yes -o LogLevel=ERROR' \
      "$LOCAL_SITE/" "$SSH_TARGET:$RELEASE/"

# rsync'd files inherit the wrong SELinux label; without httpd_sys_content_t
# nginx gets usr_t and every request 403s. The fcontext rule is already
# registered for /opt/cyburdine.com/releases(/.*)? — this just applies it.
note "applying SELinux labels"
remote "sudo restorecon -R '$RELEASE'"

note "flipping current -> $STAMP"
remote "set -euo pipefail
  ln -sfn '$RELEASE' '$REMOTE_ROOT/.current.tmp.\$\$'
  mv -Tf '$REMOTE_ROOT/.current.tmp.\$\$' '$REMOTE_ROOT/current'"

# Prune oldest releases, always keeping the live one.
note "pruning to the last $KEEP_RELEASES releases"
remote "set -euo pipefail
  cd '$REMOTE_ROOT/releases'
  live=\$(readlink '$REMOTE_ROOT/current' | xargs basename)
  ls -1 | sort | { grep -v -x \"\$live\" || true; } | head -n -$((KEEP_RELEASES - 1)) | while read -r old; do
    [ -n \"\$old\" ] || continue
    echo \"  removing \$old\"
    rm -rf -- \"\$old\"
  done"

note "deployed $STAMP"
printf '\n[deploy] verify:\n'
printf '  curl -sI %s/ | head -1\n' "$VERIFY_URL"
printf '  curl -s -o /dev/null -w "%%{http_code}\\n" %s/projects\n' "$VERIFY_URL"
printf '  ./deploy.sh --rollback   # if something looks wrong\n'
