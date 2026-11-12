#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
/usr/bin/python3 - "$ROOT" "${1:?provide copy directory}" <<'PYROLL'
from pathlib import Path
import sys,json,hashlib,shutil
root=Path(sys.argv[1]);target=Path(sys.argv[2]);orig=json.loads((root/'.cache/ai-memory/hashes.json').read_text());mod={'web/_worker.js': 'a32a15fe0bb970fedcbde67a97f7a47f6d690e47552a3580a0e1c46bb9c641f1', 'web/js/app.js': '3fa39e5c1379181cead56de3809db21bc5259384427cdc4cfc90b751040fd737', 'web/js/core.js': '01bb4d24166500cb226e46ffcb4b9020becd8a543f88b69376b8e539fcfca78d', 'web/js/account.js': 'b3b7cc3949cb7031b133fa47ed81f857c6b7f9c79ec907569d9a6e2216aa417e', 'test/ai-memory.test.mjs': '29cd4b97caa884ad5932d8d6328945f06ca47327313f3f77dc7774f9014b1959'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for f,old in orig.items():
 p=target/f
 if p.exists() and sha(p) not in [old,mod[f]]:raise SystemExit('unexpected hash: '+f)
 if old and sha(root/'.cache/ai-memory/baseline'/f)!=old:raise SystemExit('baseline mismatch')
for f,old in orig.items():
 p=target/f
 if old:shutil.copy2(root/'.cache/ai-memory/baseline'/f,p)
 else:p.unlink(missing_ok=True)
print('RESTORED 4 files; removed 1 new test')
PYROLL
