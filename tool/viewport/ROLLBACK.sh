#!/bin/bash
set -euo pipefail
src="${1:-/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/src}"
original="/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/.cache/viewport-1.0/index.original.html"
[ "$(shasum -a 256 "$original" | cut -d' ' -f1)" = "7092f7ce980284dd8fc730ef29c31c9b9d96cecbafe31ee855fda0945243baab" ] || exit 1
[ "$(shasum -a 256 "$src/web/index.html" | cut -d' ' -f1)" = "8bdfefb3d8b812820005266ad370146812c524f0af65387ac8b88a52e0e13e0f" ] || exit 1
[ "$(shasum -a 256 "$src/test/viewport.test.mjs" | cut -d' ' -f1)" = "9332b51971494470beee864fe5d73b37f9e04a560a0870331058980c8ba5f9d9" ] || exit 1
cp "$original" "$src/web/index.html"
rm "$src/test/viewport.test.mjs"
echo 'RESTORED index.html; removed viewport.test.mjs'
