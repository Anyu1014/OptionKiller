import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../web/js/core.js';
const C=globalThis.MJZ.core;
const state=(deck,card)=>({decks:[deck],cards:[card],activeDeckId:'d',settings:{},stats:{}});
const q={...C.parseText('1.题\nA.一\nB.二\n答案：A').cards[0],id:'q',deckId:'d',srs:C.newSrs(1)};
test('private deck config and reading cursor retain the newest value on both merge paths',()=>{
 const old={id:'d',name:'库',aiConfig:{key:'synthetic-old'},aiConfigUpdatedAt:1,reading:{cardId:'old'},readingUpdatedAt:1};
 const fresh={...old,aiConfig:{provider:'deepseek',model:'test',key:'synthetic-new'},aiConfigUpdatedAt:2,reading:{cardId:'q'},readingUpdatedAt:2};
 for(const merged of [C.mergeState(state(fresh,q),state(old,q)),C.mergeState(state(old,q),state(fresh,q))]){assert.equal(merged.decks[0].aiConfig.key,'synthetic-new');assert.equal(merged.decks[0].reading.cardId,'q');}
});
test('redo clears only the target question without resurrecting an older cloud attempt',()=>{
 const deck={id:'d',name:'库'},old={...q,lastAttempt:{at:10,selected:['A'],correct:true},attempts:1,correctCount:1};
 const reset={...q,progressUpdatedAt:20,lastAttempt:undefined,attempts:0,correctCount:0,note:'保留笔记',aiExplanation:'保留解析',aiUpdatedAt:1};
 for(const m of [C.mergeState(state(deck,reset),state(deck,old)),C.mergeState(state(deck,old),state(deck,reset))]){assert.equal(m.cards[0].lastAttempt,undefined);assert.equal(m.cards[0].attempts,0);assert.equal(m.cards[0].aiExplanation,'保留解析');}
});
test('analysis skill covers every option and negative wording without invented page references',()=>{
 const p=C.analysisPrompt(q,true);assert.match(p,/每个选项/);assert.match(p,/正确还是错误/);assert.match(p,/不得编造教材版本/);assert.match(p,/A\. 一/);assert.match(C.analysisPrompt(q,false),/不写解析/);
});
test('settings auto-save and navigation region exclude the fixed bottom toolbar',()=>{
 const a=readFileSync(new URL('../web/js/app.js',import.meta.url),'utf8');assert.doesNotMatch(a,/text:'保存自动解析设置'/);assert.match(a,/reading\.cardId/);assert.match(a,/readingUpdatedAt/);assert.match(a,/swipeSurface=document\.getElementById\('main'\)/);assert.match(a,/getBoundingClientRect\(\)\.top/);assert.match(a,/redoBtn/);assert.match(a,/force \|\| !\(/);
});
