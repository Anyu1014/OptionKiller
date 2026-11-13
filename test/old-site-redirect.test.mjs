import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('old website redirects without removing the shared backend',()=>{
 const code=readFileSync(new URL('../web/_worker.js',import.meta.url),'utf8');
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.match(code,/!path\.startsWith\('\/api\/'\).*Response\.redirect\('https:\/\/optionkiller\.pages\.dev'/);
 assert.ok(config.d1_databases?.length);assert.equal(config.assets,undefined);assert.equal(config.keep_vars,true);
});
