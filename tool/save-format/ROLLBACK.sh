#!/bin/bash
set -euo pipefail
src="${1:-/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/src}"
original="/Users/y/Documents/Codex/2026-11-12/an/outputs/OptionKiller/.cache/save-format/app.original.js"
[ "$(shasum -a 256 "$original" | cut -d' ' -f1)" = "48386696b78dce0b87211f6c9e71cd8224dba50f80c92415dee1685620027e32" ] || { echo 'original hash mismatch'; exit 1; }
[ "$(shasum -a 256 "$src/web/js/app.js" | cut -d' ' -f1)" = "a1321f41ad4c3bba1de1fd1e2b7a4ba2fb7b797f2985a0e5b893d7f8456c0c21" ] || { echo 'modified hash mismatch'; exit 1; }
[ "$(shasum -a 256 "$src/test/save-format.test.mjs" | cut -d' ' -f1)" = "56bc6c2a5dca73d232932c76cb94a8c7cef7c58626a85871209ed3eb8349bbcb" ] || { echo 'test hash mismatch'; exit 1; }
cp "$original" "$src/web/js/app.js"
rm "$src/test/save-format.test.mjs"
echo 'RESTORED app.js; removed save-format.test.mjs'
