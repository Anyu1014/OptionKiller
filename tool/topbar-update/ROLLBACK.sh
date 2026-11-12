#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET="${1:?Usage: ROLLBACK.sh /absolute/path/to/source-copy}"
/usr/bin/python3 - "$ROOT" "$TARGET" <<'ROLLBACK_PY'
from pathlib import Path
import sys,json,hashlib,shutil
root=Path(sys.argv[1]);target=Path(sys.argv[2]).resolve();baseline=root/'.cache/topbar-update/baseline'
modified={'web/index.html': '1126346b1183acb04939fadd2d0d1e404cd077b147d74eef561c6c52377b2df2', 'web/js/app.js': '2fd054b5d5e740d7ae6520187f9ec59fcd95982e155b8c6d7359463e39c7d54f', 'web/css/option.css': '3bea3fe5184fcfe685d996bb34eff1dbbb5378aea0ddef40f35d3439c0378e9b', 'tool/dev.mjs': 'f565c1dd1b6db3008827b16b9dd37e648ee4d00152277af901f9455c758e14e1'}
original=json.loads((root/'.cache/topbar-update/baseline-hashes.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for rel in original:
 if sha(target/rel) not in [original[rel],modified[rel]]:raise SystemExit('Unexpected target hash; preserved '+rel)
 if sha(baseline/rel)!=original[rel]:raise SystemExit('Original hash mismatch')
for rel in original:shutil.copy2(baseline/rel,target/rel)
assert all(sha(target/rel)==original[rel] for rel in original)
print('RESTORED 4 files; original hashes matched')
ROLLBACK_PY
