import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../web/js/config.js',import.meta.url),'utf8');
const context=fetch=>{const window={};vm.runInNewContext(code,{window,fetch,location:{protocol:'file:'},AbortController,Response,TypeError,setTimeout,clearTimeout});return window;};
test('account transport times out on both stalled headers and stalled body',async()=>{
 for(const fetch of [()=>new Promise(()=>{}),async()=>({arrayBuffer:()=>new Promise(()=>{})})])await assert.rejects(context(fetch).OK_FETCH('https://example.test',{},10),/连接超时/);
});
test('account transport preserves status and JSON and never exposes network internals',async()=>{
 const w=context(async()=>Response.json({ok:true}));assert.deepEqual(await (await w.OK_FETCH('https://example.test')).json(),{ok:true});
 await assert.rejects(context(async()=>{throw new TypeError('internal');}).OK_FETCH('https://example.test'),/网络连接失败/);
});
