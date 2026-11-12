import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../web/js/config.js',import.meta.url),'utf8');
test('web remains same-origin and native apps use the hosted HTTPS API',()=>{
 for(const [protocol,expected] of [['https:',''],['http:',''],['file:','https://optionkiller.yuanhyu1014.workers.dev']]){
  const window={};vm.runInNewContext(code,{window,location:{protocol}});assert.equal(window.OK_API_BASE,expected);
 }
 const window={OK_API_BASE:'https://example.test'};vm.runInNewContext(code,{window,location:{protocol:'file:'}});assert.equal(window.OK_API_BASE,'https://example.test');
});
