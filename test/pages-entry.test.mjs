import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,cpSync,rmSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
test('Pages serves assets and binds the original private database directly',()=>{
 const config=JSON.parse(readFileSync(new URL('../tool/pages/wrangler.jsonc',import.meta.url),'utf8'));
 const script=readFileSync(new URL('../tool/pages/prepare.mjs',import.meta.url),'utf8');
 assert.equal(config.d1_databases[0].binding,'DB');assert.equal(config.d1_databases[0].database_name,'optionkiller');
 assert.equal(config.services,undefined);assert.match(script,/env\.ASSETS\.fetch\(request\)/);assert.match(script,/web\/_worker\.js/);
});

test('Cloudflare build stages source assets and the direct API worker',()=>{
 const src=fileURLToPath(new URL('..',import.meta.url)),tmp=mkdtempSync(path.join(tmpdir(),'optionkiller-pages-'));
 try {mkdirSync(path.join(tmp,'tool/pages'),{recursive:true});cpSync(path.join(src,'tool/pages/prepare.mjs'),path.join(tmp,'tool/pages/prepare.mjs'));cpSync(path.join(src,'web'),path.join(tmp,'web'),{recursive:true});
 const r=spawnSync('/Users/y/toolchains/bin/node',[path.join(tmp,'tool/pages/prepare.mjs'),'--ci'],{env:{...process.env,CF_PAGES:'1'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const backend=readFileSync(path.join(tmp,'site-build/_worker.js'),'utf8');assert.match(backend,/env\.ASSETS\.fetch\(request\)/);assert.match(backend,/handleLogin/);assert.ok(existsSync(path.join(tmp,'site-build/index.html')));assert.ok(existsSync(path.join(tmp,'site-build/js/core.js')));
 } finally {rmSync(tmp,{recursive:true,force:true});}
});
