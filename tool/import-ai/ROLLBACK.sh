#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
/usr/bin/python3 - "$ROOT" "${1:?provide copy directory}" <<'PYROLL'
from pathlib import Path
import sys,json,hashlib,shutil
root=Path(sys.argv[1]);target=Path(sys.argv[2]);orig=json.loads((root/'.cache/import-ai/hashes.json').read_text());mod={'web/js/app.js': '9955af95d9df395f44c452f46ede7088de669115d8273db253b895e78c95279d', 'web/js/core.js': 'd314dacaa2b5d3e0820a766d0b418c65c7759073accd3218c5fc470a5d04adb8', 'web/css/option.css': 'e675e52cf1debecc63be30b9e8ade3412340a17b1893691bf677a2359e2318dc', 'web/_worker.js': '0ef9cfb66f56958a4b984aee48b44f12159da5d84eb0885f1f69f030f02cdd1b', 'web/js/account.js': 'ef53fa509d0675c1ddb8bcd6bfa50b10e84eabe51060ae9db67f228e3e1755cd', 'tool/dev.mjs': 'd038ac558a08539092470a9c8c08d8c6c9e2d9d18b38019e73cdae3d6a571773', 'test/import-headings.test.mjs': 'a0896c2318f1c6e0f51205602635c2b2829b32c094d026f6c4b5793bc1aef50f', 'test/ai.test.mjs': 'd9e886c000d3c68b7d8f0520d10525c17da96f5595173fc97701bb7e90c82cd2'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for f,old in orig.items():
 p=target/f
 if p.exists() and sha(p) not in [old,mod[f]]:raise SystemExit('unexpected hash: '+f)
 if old and sha(root/'.cache/import-ai/baseline'/f)!=old:raise SystemExit('baseline mismatch')
for f,old in orig.items():
 p=target/f
 if old:shutil.copy2(root/'.cache/import-ai/baseline'/f,p)
 else:p.unlink(missing_ok=True)
print('RESTORED 6 files; removed 2 new tests')
PYROLL
