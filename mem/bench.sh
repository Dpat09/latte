#!/usr/bin/env bash
# Build latte variants and prototypes, run each with a session active, and
# summarize memory. Run from the repo root after `bun install --frozen-lockfile`.
#
# usage: mem/bench.sh [seconds per variant, default 150] [variant ...]
# Output: mem/out/<variant>.log (samples) and a summary table on stdout.
#
# Each run starts a caffeinate session. Afterwards the script stops every
# caffeinate without "-w" in its arguments, so a `caffeinate -w <pid>` kept by
# another app survives.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DUR=${1:-150}; shift || true
OUT=mem/out; mkdir -p "$OUT"
ALL=(latte latte-minify latte-smol latte-nopoll latte-renderonly latte-spawnonly proto proto-effect proto-ink)
VARIANTS=("${@:-${ALL[@]}}")
PROD=(--define 'process.env.NODE_ENV="production"')

sign() { if command -v codesign >/dev/null; then codesign --force --sign - "$1" && codesign --verify --strict "$1"; fi; }

# Apply a Python string replacement to a source file; restored after the build.
patch_src() {
  python3 -I - "$1" "$2" "$3" <<'EOF'
import sys
path, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path).read()
assert s.count(old) == 1, f"patch target not found once in {path}"
open(path, "w").write(s.replace(old, new))
EOF
}

POLL_OLD='        void io.detect().then((info) => {
          if (sessionVersion === issued) writeSession(info && { info, at: io.now() })
        })'

build() {
  local v=$1 bin=$OUT/$1
  case $v in
    latte)            bun build ./src/index.ts --compile "${PROD[@]}" --outfile "$bin" ;;
    latte-minify)     bun build ./src/index.ts --compile --minify "${PROD[@]}" --outfile "$bin" ;;
    latte-smol)       bun build ./src/index.ts --compile --minify --compile-exec-argv=--smol "${PROD[@]}" --outfile "$bin" ;;
    latte-nopoll)     patch_src src/tui/sessionStore.ts '      }, 1000)' '      }, 3600000)'
                      bun build ./src/index.ts --compile --minify "${PROD[@]}" --outfile "$bin"
                      git checkout -- src/tui/sessionStore.ts ;;
    latte-renderonly) patch_src src/tui/sessionStore.ts "$POLL_OLD" '        void issued; writeSession({ info: snapshot.session.info, at: io.now() })'
                      bun build ./src/index.ts --compile --minify "${PROD[@]}" --outfile "$bin"
                      git checkout -- src/tui/sessionStore.ts ;;
    latte-spawnonly)  patch_src src/tui/sessionStore.ts "$POLL_OLD" '        void issued; void io.detect()'
                      bun build ./src/index.ts --compile --minify "${PROD[@]}" --outfile "$bin"
                      git checkout -- src/tui/sessionStore.ts ;;
    proto)            bun build ./mem/proto.ts --compile --minify --outfile "$bin" ;;
    proto-effect)     bun build ./mem/proto-effect.ts --compile --minify --outfile "$bin" ;;
    proto-ink)        bun build ./mem/proto-ink.tsx --compile --minify "${PROD[@]}" --outfile "$bin" ;;
    *) echo "unknown variant $v" >&2; exit 1 ;;
  esac >/dev/null
  sign "$bin"
}

stop_sessions() {
  for p in $(pgrep -x caffeinate || true); do
    case " $(ps -o args= -p "$p" 2>/dev/null) " in *" -w "*) ;; *) kill "$p" 2>/dev/null || true ;; esac
  done
}

for v in "${VARIANTS[@]}"; do build "$v"; done
git diff --quiet -- src || { echo "src was left modified" >&2; exit 1; }

printf '%-18s %8s %8s %8s %8s\n' variant rss_mean rss_max fp_mean fp_max
for v in "${VARIANTS[@]}"; do
  python3 -I mem/run.py "$DUR" 5 --keys "3:o" -- "$OUT/$v" > "$OUT/$v.log"
  stop_sessions
  awk -v name="$v" '$1 >= 30 {
      sub("rss=", "", $2); sub("fp=", "", $3); r = $2 + 0; f = $3 + 0
      n++; sr += r; sf += f; if (r > mr) mr = r; if (f > mf) mf = f
    } END { printf "%-18s %8.1f %8.1f %8.1f %8.1f\n", name, sr / n, mr, sf / n, mf }' "$OUT/$v.log"
  sleep 3
done
