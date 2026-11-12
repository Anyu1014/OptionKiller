#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
/usr/bin/python3 - "$ROOT" "${1:?provide copy directory}" <<'PYROLL'
from pathlib import Path
import sys,json,hashlib,shutil
root=Path(sys.argv[1]);target=Path(sys.argv[2]);orig=json.loads((root/'.cache/settings-version/hashes.json').read_text());mod={'web/js/app.js': '344c275f141fa2f16ab5e5f0b79c3c9450f9401c4e5e1458cf0c4c3c8afeeec1', 'web/index.html': '7092f7ce980284dd8fc730ef29c31c9b9d96cecbafe31ee855fda0945243baab', 'package.json': '001504044fe04584862b2c1a8e1c50997344da2e2d7a21ca07aba43154181fb6', 'android/app/build.gradle': '1e3c625e1871321fb3ad15830aaf53d54f846cdb40ca7ffc23d04a65a8d1e6e0', 'ios/project.yml': '3e19a6610797017167446636e523e44174df7105b76982b14edce21cf2edebed', 'test/panels.test.mjs': '5d3ea255e3cb56156f1f042a46edeb4531177b183e6ca2d8b9f9ef205e75e774', 'test/settings-version.test.mjs': '4d649c5eacd5865429e6e8bca61dd564c2cd5abf203fbc299e3439897631622b'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for f,old in orig.items():
 p=target/f
 if p.exists() and sha(p) not in [old,mod[f]]:raise SystemExit('unexpected hash: '+f)
 if old and sha(root/'.cache/settings-version/baseline'/f)!=old:raise SystemExit('baseline mismatch')
for f,old in orig.items():
 p=target/f
 if old:shutil.copy2(root/'.cache/settings-version/baseline'/f,p)
 else:p.unlink(missing_ok=True)
print('RESTORED 6 files; removed 1 new test')
PYROLL
