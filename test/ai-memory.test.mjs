import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import '../web/js/core.js';
registerHooks({resolve(specifier,context,next){return specifier==='cloudflare:sockets'?{url:'test:mail',shortCircuit:true}:next(specifier,context);},load(url,context,next){return url==='test:mail'?{format:'module',source:'export function connect(){}',shortCircuit:true}:next(url,context);}});
const worker=(await import('../web/_worker.js')).default;
test('one bounded request yields explanation and mnemonic; existing explanation requests only mnemonic',async()=>{
 const old=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return Response.json({choices:[{message:{content:'```json\n{"e":"判断依据","m":"一句口诀"}\n```'}}]});};
  async function run(needExplanation){let r=await worker.fetch(new Request('https://local.example/api/analysis',{method:'POST',headers:{'content-type':'application/json',origin:'https://local.example'},body:JSON.stringify({provider:'deepseek',key:'fake',model:'test',question:'题',options:[{label:'A',text:'甲'},{label:'B',text:'乙'}],answers:['A'],needExplanation})}),{},{});assert.equal(r.status,200);return r.json();}
  assert.deepEqual(await run(true),{text:'判断依据',mnemonic:'一句口诀'});assert.equal(calls[0].body.max_tokens,640);assert.match(calls[0].body.messages[0].content,/解析≤280字/);assert.match(calls[0].body.messages[0].content,/简记≤30字/);
  assert.deepEqual(await run(false),{text:'判断依据',mnemonic:'一句口诀'});assert.match(calls[1].body.messages[0].content,/不写解析/);assert.equal(calls.length,2);
 }finally{globalThis.fetch=old;}
});
test('latest cloud merge retains mnemonic, cache identity and attempted status',()=>{
 const C=global.MJZ.core,q=C.parseImport('1.题\nA.甲\nB.乙').cards[0],d={id:'d',name:'库'},base={...q,id:'q',deckId:'d',aiUpdatedAt:1,aiExplanation:'旧',aiMnemonic:'旧简记'},state=c=>({decks:[d],cards:[c],activeDeckId:'d',settings:{},stats:{}}),next={...base,aiUpdatedAt:2,aiMnemonic:'新简记',aiSourceDef:q.def,aiAttempted:true};const merged=C.mergeState(state(next),state(base)).cards[0];assert.equal(merged.aiMnemonic,'新简记');assert.equal(merged.aiSourceDef,q.def);assert.equal(merged.aiAttempted,true);
});
