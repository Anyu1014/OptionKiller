import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='cloudflare:sockets'?{url:'test:mail',shortCircuit:true}:n(s,c);},load(u,c,n){return u==='test:mail'?{format:'module',source:'export function connect(){}',shortCircuit:true}:n(u,c);}});
const worker=(await import('../web/_worker.js')).default;
test('AI independently converts raw input to validated questions',async()=>{
 const app=readFileSync(new URL('../web/js/app.js',import.meta.url),'utf8');
 assert.match(app,/mode:'import-recognize'/);
 assert.doesNotMatch(app,/!checkEnabled.checked \|\| !parsed/);
 const old=globalThis.fetch; let sent;
 try {
  globalThis.fetch=async(url,opts)=>{sent=JSON.parse(opts.body);return Response.json({choices:[{message:{content:JSON.stringify({cards:[{term:'独立识别',type:'single',options:[{label:'A',text:'甲'},{label:'B',text:'乙'}],answers:['B']}]})}}]});};
  const run=question=>worker.fetch(new Request('https://local.example/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'import-recognize',provider:'deepseek',key:'test',model:'model',question})}),{},{});
  const res=await run('原文不符合规则'); assert.equal(res.status,200); assert.equal((await res.json()).cards[0].term,'独立识别');
  assert.match(sent.messages[0].content,/原文不符合规则/); assert.doesNotMatch(sent.messages[0].content,/解析结果/);
  assert.equal((await run('x'.repeat(12001))).status,400);
  globalThis.fetch=async()=>Response.json({choices:[{message:{content:'not JSON'}}]});
  assert.equal((await run('原文')).status,502);
 } finally {globalThis.fetch=old;}
});
