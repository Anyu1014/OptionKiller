#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET="${1:?provide copy file}"
HASH="$(shasum -a 256 "$TARGET" | awk '{print $1}')"
[ "$HASH" = "cd0cb2835b70aba30a248df5a94e03916b442b0118e595028e1021fc9dd7bb34" ] || [ "$HASH" = "ed82f7c382433be20ec01b0912d45634af3aabf3854f770b8fc872c1d6add171" ]
cp "$ROOT/.cache/question-font/original.css" "$TARGET"
[ "$(shasum -a 256 "$TARGET" | awk '{print $1}')" = "ed82f7c382433be20ec01b0912d45634af3aabf3854f770b8fc872c1d6add171" ]
echo 'RESTORED original hash'
