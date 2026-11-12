#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DEST="${1:?provide copy directory}"
cp "$ROOT/.cache/panels/baseline/"* "$DEST/"
echo 'RESTORED 2 files'
