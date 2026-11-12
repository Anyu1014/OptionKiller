import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='cloudflare:sockets'?{url:'test:mail',shortCircuit:true}:next(specifier,context);},load(url,context,next){return url==='test:mail'?{format:'module',source:'export function connect(){}',shortCircuit:true}:next(url,context);}});
const worker=(await import('../web/_worker.js')).default;
const req=(body,origin='https://local.example')=>new Request('https://local.example/api/analysis/models',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
test('list models uses authenticated fixed provider endpoints without leaking key',async()=>{
 const original=globalThis.fetch,requests=[];
 try{
  globalThis.fetch=async(url,opts)=>{requests.push({url,opts});return Response.json(url.includes('googleapis')?{models:[{name:'models/gemini-test',supportedGenerationMethods:['generateContent']},{name:'models/embed-test',supportedGenerationMethods:['embedContent']}]}:{data:[{id:'test-model'},{id:'test-model'}]});};
  for(const provider of ['openai','deepseek','gemini','doubao']){
   const response=await worker.fetch(req({provider,key:'synthetic-key'}),{},{}),body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.models,[provider==='gemini'?'gemini-test':'test-model']);assert.ok(!JSON.stringify(body).includes('synthetic-key'));
  }
  assert.deepEqual(requests.map(x=>new URL(x.url).hostname),['api.openai.com','api.deepseek.com','generativelanguage.googleapis.com','ark.cn-beijing.volces.com']);
  assert.equal((await worker.fetch(req({provider:'openai',key:'x'},'https://other.example'),{},{})).status,403);
  assert.equal((await worker.fetch(req({provider:'unknown',key:'x'}),{},{})).status,400);
  globalThis.fetch=async()=>new Response('{}',{status:401});const error=await worker.fetch(req({provider:'openai',key:'synthetic-key'}),{},{});assert.equal(error.status,502);assert.ok(!(await error.text()).includes('synthetic-key'));
 }finally{globalThis.fetch=original;}
});
