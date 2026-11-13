import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Pages serves assets and binds the original private database directly',()=>{
 const config=JSON.parse(readFileSync(new URL('../tool/pages/wrangler.jsonc',import.meta.url),'utf8'));
 const script=readFileSync(new URL('../tool/pages/prepare.mjs',import.meta.url),'utf8');
 assert.equal(config.d1_databases[0].binding,'DB');assert.equal(config.d1_databases[0].database_name,'optionkiller');
 assert.equal(config.services,undefined);assert.match(script,/env\.ASSETS\.fetch\(request\)/);assert.match(script,/web\/_worker\.js/);
});
