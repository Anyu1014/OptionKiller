import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='cloudflare:sockets'?{url:'test:mail',shortCircuit:true}:n(s,c);},load(u,c,n){return u==='test:mail'?{format:'module',source:'export function connect(){}',shortCircuit:true}:n(u,c);}});
const worker=(await import('../web/_worker.js')).default;
test('import review is opt-in and compares source to parsed text through supported services',async()=>{
 const app=readFileSync(new URL('../web/js/app.js',import.meta.url),'utf8');
 assert.match(app,/type:'checkbox', id:'importAiCheck'/);assert.doesNotMatch(app,/id:'importAiCheck',\s*checked/);
 assert.match(app,/revision!==checkRevision/);assert.match(app,/图片仅发送提取出的文字/);
 const old=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,opts)=>{calls.push(JSON.parse(opts.body));return Response.json({choices:[{message:{content:'第1题请核对选项'}}]});};
 const input={mode:'import-check',provider:'deepseek',key:'synthetic-key',model:'model',question:'原文题目',parsedText:'解析后题目'};
 const run=body=>worker.fetch(new Request('https://local.example/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{},{});
 let r=await run(input);assert.equal(r.status,200);assert.equal((await r.json()).text,'第1题请核对选项');assert.match(calls[0].messages[0].content,/原文题目/);assert.match(calls[0].messages[0].content,/解析后题目/);assert.equal(calls[0].max_tokens,384);
 r=await run({...input,question:'x'.repeat(12001)});assert.equal(r.status,400);assert.equal(calls.length,1);
 }finally{globalThis.fetch=old;}
});
