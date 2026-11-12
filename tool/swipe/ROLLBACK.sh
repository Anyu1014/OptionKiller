#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
/usr/bin/python3 - "$ROOT" "${1:?provide copy directory}" <<'PYROLL'
from pathlib import Path
import sys,json,hashlib,shutil
root=Path(sys.argv[1]);target=Path(sys.argv[2]);orig=json.loads((root/'.cache/swipe/hashes.json').read_text());mod={'web/js/app.js': '7c76707fa7c638b5298605ab4a8c3dcabacb7034f683de0af02a7a2379254260', 'web/js/core.js': 'b365b5b2c03336ceb1b07d251c8ab2d231bd902ffa04e42685e5a0c557be641e', 'web/css/option.css': '2e176938463b50b050df276a028aadd5e3945f53f6187316dd036b0545b9c09a', 'test/swipe.test.mjs': '06c466ce0f1758cf45c1a846a2ccd005be85061b91bd2ed405d4026ba9d1fe7e'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for f,old in orig.items():
 p=target/f
 if p.exists() and sha(p) not in [old,mod[f]]:raise SystemExit('unexpected hash: '+f)
 if old and sha(root/'.cache/swipe/baseline'/f)!=old:raise SystemExit('baseline mismatch')
for f,old in orig.items():
 p=target/f
 if old:shutil.copy2(root/'.cache/swipe/baseline'/f,p)
 else:p.unlink(missing_ok=True)
print('RESTORED 3 files; removed 1 new test')
PYROLL
