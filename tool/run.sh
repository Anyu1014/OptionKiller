#!/bin/bash
set -euo pipefail
source /Users/y/toolchains/env.sh
SRC="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(dirname "$SRC")"
NODE=/Users/y/toolchains/bin/node
case "${1:-dev}" in
 dev) exec "$NODE" "$SRC/tool/dev.mjs" ;;
 test) exec "$NODE" --test "$SRC"/test/*.test.mjs ;;
 web) "$NODE" --test "$SRC"/test/*.test.mjs; "$NODE" "$SRC/tool/build.mjs" ;;
 sync-native) mkdir -p "$SRC/android/app/src/main/assets/www" "$SRC/ios/OptionKiller/www"; rsync -a --delete --exclude _worker.js "$SRC/web/" "$SRC/android/app/src/main/assets/www/"; rsync -a --delete --exclude _worker.js "$SRC/web/" "$SRC/ios/OptionKiller/www/" ;;
 clean) find "$ROOT/.cache" -mindepth 1 -maxdepth 1 -exec rm -rf {} + ;;
 *) printf 'Usage: %s [dev|test|web|sync-native|clean]\n' "$0" >&2;exit 1 ;;
esac
