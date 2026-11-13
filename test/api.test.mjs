import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import '../web/js/core.js';
const src=path.resolve(fileURLToPath(new URL('..',import.meta.url))),cache=path.resolve(src,'../.cache/api-test-'+process.pid);
test('account API: register/login, isolation, sync conflict, group choice sharing, logout',{timeout:30000},async()=>{
 await mkdir(cache,{recursive:true});
 const port=15000+process.pid%10000, base='http://127.0.0.1:'+port;
 const child=spawn('/Users/y/toolchains/bin/node',[path.join(src,'tool/dev.mjs')],{env:{...process.env,PORT:String(port),OK_ADMIN_EMAILS:'admin@example.test',OK_DATA_FILE:path.join(cache,'db.sqlite')},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',x=>errors+=x);
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Server exited: '+errors);}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Server startup timeout')),8000);t.unref();})]);
  async function api(url,body,token,method=body?'POST':'GET'){
   const r=await fetch(base+url,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};
  }
  assert.equal((await api('/api/health')).status,200);
  assert.equal((await api('/api/me')).status,401);
  assert.equal((await api('/api/auth/register',{email:'bad',password:'123'})).status,400);
  const a=await api('/api/auth/register',{email:'a@example.test',password:'test-account-password'});
  assert.equal(a.status,201,JSON.stringify(a.data));assert.ok(a.data.token);assert.equal(a.data.user.isAdmin,false);
  const b=await api('/api/auth/register',{email:'b@example.test',password:'test-account-password'});assert.equal(b.status,201);
  const absent=await api('/api/auth/login',{email:'missing@example.test',password:'wrong-password'});assert.equal(absent.status,401);assert.equal(absent.data.error,'该账户未注册');
  const wrong=await api('/api/auth/login',{email:'a@example.test',password:'wrong-password'});assert.equal(wrong.status,401);assert.equal(wrong.data.error,'密码不正确');
  const login=await api('/api/auth/login',{email:'a@example.test',password:'test-account-password'});assert.equal(login.status,200);
  const token=login.data.token;
  const cards=globalThis.MJZ.core.parseImport('二、多项选择题\n1.题()\nA.一\nB.二\nC.三\n答案：AC').cards;
  cards[0].note='private note';cards[0].id='q';cards[0].deckId='d';
  const payload={version:3,decks:[{id:'d',name:'选择题',aiConfig:{key:'synthetic-private-key',model:'test'},aiConfigUpdatedAt:1,reading:{cardId:'q'},readingUpdatedAt:1}],cards,activeDeckId:'d',settings:{},stats:{}};
  const saved=await api('/api/me/data',{payload,baseVersion:0},token,'PUT');assert.equal(saved.status,200);
  const loaded=await api('/api/me/data',null,token);assert.equal(loaded.data.payload.cards[0].type,'multi');assert.equal(loaded.data.payload.cards[0].options.length,3);assert.equal(loaded.data.payload.cards[0].note,'private note');assert.equal(loaded.data.payload.decks[0].aiConfig.key,'synthetic-private-key');assert.equal(loaded.data.payload.decks[0].reading.cardId,'q');
  const other=await api('/api/me/data',null,b.data.token);assert.equal(other.data.payload,null);
  assert.equal((await api('/api/me/data',{payload,baseVersion:0},token,'PUT')).status,409);
  const group=await api('/api/group/create',{name:'自建练习组'},token);assert.equal(group.status,200,JSON.stringify(group.data));
  const groupId=group.data.group.id;
  const share=await api('/api/group/messages',{groupId,deck:{name:'选择题',aiConfig:{key:'synthetic-private-key'},cards}},token);assert.equal(share.status,200);
  const messages=await api('/api/group/messages?groupId='+groupId,null,token);
  const message=messages.data.messages.find(x=>x.kind==='deck');assert.ok(message);
  const preview=await api('/api/group/deck?messageId='+message.id,null,token);assert.equal(preview.status,200);assert.equal(preview.data.cards[0].type,'multi');assert.deepEqual(preview.data.cards[0].answers,['A','C']);assert.equal(preview.data.cards[0].note,undefined);assert.ok(!JSON.stringify(preview.data).includes('synthetic-private-key'));
  const admin=await api('/api/auth/register',{email:'admin@example.test',password:'test-admin-password'});assert.equal(admin.status,201);
  assert.equal((await api('/api/admin/users/delete',{userId:b.data.user.id,email:'b@example.test'},admin.data.token)).status,200);
  assert.equal((await api('/api/auth/register',{email:'b@example.test',password:'attacker-password'})).status,403);
  const restored=await api('/api/auth/register',{email:'b@example.test',password:'test-account-password'});assert.equal(restored.status,201);assert.equal(restored.data.user.restored,true);
  assert.equal((await api('/api/auth/logout',{},token)).status,200);
  assert.equal((await api('/api/me',null,token)).status,401);
 } finally {child.kill('SIGTERM');await once(child,'exit').catch(()=>{});await rm(cache,{recursive:true,force:true});}
});
