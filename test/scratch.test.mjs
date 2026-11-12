import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../web/js/core.js';
const C=globalThis.MJZ.core;
test('scratch boxes preserve legacy text, distinct ids and normalized coordinates',()=>{
 const legacy=C.normalizeScratchBoxes(undefined,'原有草稿\n第二行');assert.equal(legacy.length,1);assert.equal(legacy[0].text,'原有草稿\n第二行');
 assert.deepEqual(C.normalizeScratchBoxes([], '旧文本'),[]);
 const boxes=C.normalizeScratchBoxes([{id:'a',text:'一',x:-5,y:4},{id:'a',text:'二',x:NaN,y:Infinity},null]);assert.equal(boxes.length,2);assert.notEqual(boxes[0].id,boxes[1].id);assert.deepEqual(boxes.map(b=>[b.x,b.y]),[[0,1],[0,0]]);assert.equal(boxes[1].text,'二');
});
test('scratch and slay sync select the latest update, including deletions and undo slay',()=>{
 const q=C.parseImport('1.题目\nA.一\nB.二\n答案：A').cards[0],deck={id:'d',name:'库'};
 const card={...q,id:'q',deckId:'d',scratchBoxes:[{id:'box',text:'旧草稿',x:0,y:0}],scratchUpdatedAt:1,mastered:true,masteredUpdatedAt:1};
 const state=c=>({decks:[deck],cards:[c],activeDeckId:'d',settings:{},stats:{}});
 const newer={...card,scratchBoxes:[],scratchUpdatedAt:2,mastered:false,masteredUpdatedAt:2};
 assert.deepEqual(C.mergeState(state(newer),state(card)).cards[0].scratchBoxes,[]);assert.equal(C.mergeState(state(newer),state(card)).cards[0].mastered,false);
 assert.equal(C.mergeState(state(card),state(newer)).cards[0].mastered,false);
});
test('per-question scratch boxes and slay survive store reload',()=>{
 const values=new Map();const make=()=>{
  const ctx=vm.createContext({crypto,Date,console,setTimeout,clearTimeout,addEventListener(){},document:{visibilityState:'visible'},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});
  for(const name of ['core','store'])vm.runInContext(fs.readFileSync(new URL('../web/js/'+name+'.js',import.meta.url),'utf8'),ctx);
  return ctx.MJZ.store.create();
 };
 const s=make(),q=s.state.cards[0];q.scratchBoxes=[{id:'one',text:'第一段',x:.2,y:.3},{id:'two',text:'第二段',x:.6,y:.5}];q.mastered=true;s.saveNow();
 const reload=make();assert.equal(reload.state.cards[0].scratchBoxes.length,2);assert.equal(reload.state.cards[0].scratchBoxes[1].text,'第二段');assert.equal(reload.state.cards[0].mastered,true);assert.equal(reload.state.cards[1].scratchBoxes,undefined);
});
test('group sharing strips personal scratch boxes and slay state',()=>{
 const source=fs.readFileSync(new URL('../web/js/account.js',import.meta.url),'utf8');assert.match(source,/scratchBoxes:undefined,scratchUpdatedAt:undefined,mastered:undefined,masteredUpdatedAt:undefined/);
});
