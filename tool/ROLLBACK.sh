#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="${1:?Usage: ROLLBACK.sh /absolute/path/to/test-copy/js/core.js}"
[ -f "$TARGET" ] || { echo "Target must be an existing copy" >&2; exit 2; }
ACTUAL="$(shasum -a 256 "$TARGET" | awk '{print $1}')"
case "$ACTUAL" in
  b0c19ec68bc4af07fac20c75926358af8fea3c38b9eafabb785a95d3e1325d9e|934425a076196df08c8e655b6630d68754231075836dbd49a40d4ebeb70afa0e) ;;
  *) echo "Target hash is unexpected; preserving it" >&2; exit 3 ;;
esac
TEMP="$(mktemp "${TARGET}.rollback.XXXXXX")"
trap 'rm -f "$TEMP"' EXIT
tar -xOf "$ROOT/.cache/baseline-web.tar.gz" web/js/core.js > "$TEMP"
RESTORED="$(shasum -a 256 "$TEMP" | awk '{print $1}')"
[ "$RESTORED" = "934425a076196df08c8e655b6630d68754231075836dbd49a40d4ebeb70afa0e" ]
mv "$TEMP" "$TARGET"
printf 'RESTORED sha256=%s\n' "$RESTORED"
