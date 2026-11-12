#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
/usr/bin/python3 - "$ROOT" "${1:?provide copy directory}" <<'PYROLL'
from pathlib import Path
import sys,json,hashlib,shutil
root=Path(sys.argv[1]);target=Path(sys.argv[2]);orig=json.loads((root/'.cache/model-connect/hashes.json').read_text());mod={'web/js/app.js': '83d9d67c17ba54f4245e265fb4d0b5c160003a7fa4d832dc3dceb72320150900', 'web/_worker.js': 'e3bf0d62f614edf2ebf0af59732638a18d415d7a8502d583262c66ee3e5ee8ff', 'web/css/option.css': '2ee136315369b623e5bb128d8a4ef2493082ec4e20285e17dcc9c5edac9ef10b', 'web/js/core.js': 'c7770a81fe91ac088476b61541808e21482309426afa09d86a289c1f3322b93b', 'test/model-list.test.mjs': '255ae212d2f9ba1c6a848e12b7c99f08feaab1edb43f3121257c0f46865f570e', 'test/missing-option.test.mjs': '16124febcb8918d7ab43630ec2cfe5326476bfde051790c2eddab32bbce8d932'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for f,old in orig.items():
 p=target/f
 if p.exists() and sha(p) not in [old,mod[f]]:raise SystemExit('unexpected hash: '+f)
 if old and sha(root/'.cache/model-connect/baseline'/f)!=old:raise SystemExit('baseline mismatch')
for f,old in orig.items():
 p=target/f
 if old:shutil.copy2(root/'.cache/model-connect/baseline'/f,p)
 else:p.unlink(missing_ok=True)
print('RESTORED 4 files; removed 2 new tests')
PYROLL
