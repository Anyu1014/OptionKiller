#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DEST="${1:?provide copy directory}"
cp "$ROOT/.cache/toolbar-align/baseline/index.html" "$DEST/index.html"
cp "$ROOT/.cache/toolbar-align/baseline/app.js" "$DEST/app.js"
cp "$ROOT/.cache/toolbar-align/baseline/option.css" "$DEST/option.css"
echo 'RESTORED 3 files'
