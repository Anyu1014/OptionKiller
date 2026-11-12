#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET="${1:?Usage: ROLLBACK.sh /absolute/path/to/source-copy}"
/usr/bin/python3 - "$ROOT" "$TARGET" <<'ROLLBACK_PY'
from pathlib import Path
import sys,json,hashlib,shutil
root=Path(sys.argv[1]);target=Path(sys.argv[2]).resolve();baseline=root/'.cache/scratch-update/baseline'
original=json.loads((root/'.cache/scratch-update/baseline-hashes.json').read_text())
modified={'web/index.html': '48133d5698138f543aa65bcb869582cd477fb166f92512c5a5aa8600473e9236', 'web/js/app.js': 'dbd06fe8e89c3eee2b198955cefe2c2bd81bc191c774deb61ab1cb52c80cc1a6', 'web/css/option.css': 'ef026ec50847cb88e53dd1a7be35e511707468972d53c6e7ac0f495449808983', 'web/js/core.js': '0d2186d73a9ed44e662dab06db224830bab675c8599f070548441d4a7ae20c8b', 'web/js/account.js': '1a1d6ca57b265d2d2c87f73ee88ab9d8ebdc19af0bf14a74ac221b83e0ae777e', 'test/scratch.test.mjs': '68fadb37fa707defdae9350e7751aca1f431c1e7c405ee8eed9e604f43817714'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for rel,old in original.items():
 p=target/rel
 if old is None:
  if p.exists() and sha(p)!=modified[rel]:raise SystemExit('Unexpected new-file hash; preserved '+rel)
 else:
  if sha(p) not in [old,modified[rel]]:raise SystemExit('Unexpected target hash; preserved '+rel)
  if sha(baseline/rel)!=old:raise SystemExit('Original hash mismatch')
for rel,old in original.items():
 if old is None:(target/rel).unlink(missing_ok=True)
 else:shutil.copy2(baseline/rel,target/rel)
assert all(not (target/rel).exists() if old is None else sha(target/rel)==old for rel,old in original.items())
print('RESTORED 5 files; removed 1 new test; original hashes matched')
ROLLBACK_PY
