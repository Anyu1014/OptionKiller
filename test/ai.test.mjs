import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='cloudflare:sockets'?{url:'test:mail',shortCircuit:true}:next(specifier,context);},load(url,context,next){return url==='test:mail'?{format:'module',source:'export function connect(){}',shortCircuit:true}:next(url,context);}});
const worker=(await import('../web/_worker.js')).default;
test('AI proxy uses only fixed provider endpoints and does not echo keys',async()=>{
 const original=globalThis.fetch, requests=[];
 try{
  globalThis.fetch=async(url,opts)=>{requests.push({url,opts});return Response.json(url.includes('googleapis')?{candidates:[{content:{parts:[{text:'测试解析'}]}}]}:{choices:[{message:{content:'测试解析'}}]});};
  for(const provider of ['openai','deepseek','gemini','doubao']){
   const request=new Request('https://local.example/api/analysis',{method:'POST',headers:{'content-type':'application/json',origin:'https://local.example'},body:JSON.stringify({provider,key:'fake-test-key',model:'example-model',question:'测试题',options:[{label:'A',text:'一'},{label:'B',text:'二'}],answers:['A']})});
   const response=await worker.fetch(request,{},{});assert.equal(response.status,200);const body=await response.json();assert.equal(body.text,'测试解析');assert.ok(!JSON.stringify(body).includes('fake-test-key'));
  }
  assert.deepEqual(requests.map(x=>new URL(x.url).hostname),['api.openai.com','api.deepseek.com','generativelanguage.googleapis.com','ark.cn-beijing.volces.com']);
  const cross=new Request('https://local.example/api/analysis',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:'{}'});assert.equal((await worker.fetch(cross,{},{})).status,403);
  const invalid=new Request('https://local.example/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'other',model:'test',key:'x',question:'题',options:[{},{}]})});assert.equal((await worker.fetch(invalid,{},{})).status,400);
 }finally{globalThis.fetch=original;}
});
