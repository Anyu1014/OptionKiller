import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import '../web/js/core.js';
const C=globalThis.MJZ.core;
const sample='一，单项选择题（单选/A型题）\n1.问题()\nA\nB\nC\nD\nE\n二，多项选择题（多选/X型题）\n1.问题()\nA\nB\nC\nD\nE';
const single='一、单项选择题\n1.题干(B)\nA. 一 B. 二 C. 三 D. 四 E. 五\n解析：测试解释\n第二段解析\n来源：自建题库\n难度：2';
const multi='二，多项选择题（多选/X型题）\n61.问题()\nA. 选项一\nB. 选项二\nC. 选项三\nD. 选项四\nE. 选项五\n答案：AC\n解析：两项正确';
test('exact requested format: single, multi, five empty options, no invented answers',()=>{
 const r=C.parseImport(sample).cards;assert.equal(r.length,2);assert.deepEqual(r.map(c=>c.type),['single','multi']);assert.deepEqual(r.map(c=>c.options.length),[5,5]);assert.deepEqual(r.map(c=>c.answers),[[],[]]);assert.equal(C.grade(r[0],['A']),null);
});
test('inline options and inline answer, analysis, metadata',()=>{
 const q=C.parseImport(single).cards[0];assert.equal(q.term,'题干()');assert.deepEqual(q.answers,['B']);assert.deepEqual(q.options.map(o=>o.text),['一','二','三','四','五']);assert.equal(q.explanation,'测试解释\n第二段解析');assert.equal(q.difficulty,2);assert.equal(q.source,'自建题库');
});
test('multiselect exact set, no partial credit, ordering independent',()=>{
 const q=C.parseImport(multi).cards[0];assert.equal(C.grade(q,['A']),false);assert.equal(C.grade(q,['A','C','D']),false);assert.equal(C.grade(q,['C','A']),true);
});
test('fullwidth numbering and option wrapping',()=>{
 const q=C.parseImport('一、单项选择题\n１．题干（）\nＡ．第一行\n换行内容\nＢ．第二项\n答案：Ａ').cards[0];assert.equal(q.options[0].text,'第一行\n换行内容');assert.deepEqual(q.answers,['A']);
});
test('invalid options and answer keys rejected atomically',()=>{
 for(const raw of ['1.题\nA.一\nC.三','1.题\nA.一\nA.二','1.题\nA.一\nB.二\n答案：E','1.题\nA.一\nB.二\n答案：AB','1.题\nA.一\nB.二\n答案：Z','二、多项选择题\n1.题\nA.一\nB.二\n答案：A'])assert.throws(()=>C.parseImport(raw));
});
test('lossless text edit/export round trip keeps distinct single and multi questions',()=>{
 const cards=C.parseImport(single+'\n'+multi).cards;const round=C.parseImport(C.questionText(cards)).cards;
 for(let i=0;i<cards.length;i++)for(const key of ['term','type','options','answers','explanation','section','difficulty','source','topic','def'])assert.deepEqual(round[i][key],cards[i][key],key);
});
test('JSON schema and empty JSON rejected',()=>{
 const q=C.parseImport(multi).cards[0];assert.deepEqual(C.parseImport(JSON.stringify({name:'库',cards:[q]})).cards,[q]);assert.throws(()=>C.parseImport('[]'));assert.throws(()=>C.parseImport('[{"term":"题"}]'));
});
test('SRS known longer than wrong and fuzzy',()=>{
 const now=Date.now(),s=C.newSrs(now);assert.ok(C.rate(s,'known',now).due>C.rate(s,'unknown',now).due);assert.ok(C.rate(s,'fuzzy',now).due>C.rate(s,'unknown',now).due);
});
function context(saved){const values=new Map(saved?[["optionkiller.state.v1",saved]]:[]);const c=vm.createContext({console,crypto,Date,setTimeout,clearTimeout,addEventListener(){},document:{visibilityState:'visible'},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}});for(const name of ['core','store'])vm.runInContext(fs.readFileSync(new URL('../web/js/'+name+'.js',import.meta.url),'utf8'),c);return {c,values};}
test('store import/edit/reload retains new fields, notes and favorites',()=>{
 const {c,values}=context();const s=c.MJZ.store.create(),d=s.createDeck('测试');s.addCards(d.id,C.parseImport(multi).cards);let q=s.deckCards(d.id)[0];q.note='笔记';q.fav=true;q.lastAttempt={at:1,selected:['A'],correct:false};q.wrong=true;s.saveNow();
 const reload=context(values.get('optionkiller.state.v1')).c.MJZ.store.create();const card=reload.deckCards(d.id)[0];assert.equal(card.type,'multi');assert.equal(card.options.length,5);assert.equal(card.note,'笔记');assert.equal(card.wrong,true);
 reload.replaceDeckCards(d.id,C.parseImport(multi).cards);assert.equal(reload.deckCards(d.id)[0].lastAttempt.correct,false);
 reload.replaceDeckCards(d.id,C.parseImport(multi.replace('两项正确','更新解析')).cards);assert.equal(reload.deckCards(d.id)[0].lastAttempt,undefined);assert.equal(reload.deckCards(d.id)[0].note,'笔记');assert.equal(reload.deckCards(d.id)[0].fav,true);
});
test('invalid stored data preserved',()=>{const {c,values}=context('{broken');assert.throws(()=>c.MJZ.store.create());assert.equal(values.get('optionkiller.state.v1'),'{broken');});
test('merge retains choice schema and latest notes/history',()=>{
 const q=C.parseImport(multi).cards[0],deck={id:'d',name:'库'};const state=(card)=>({decks:[deck],cards:[card],activeDeckId:'d',settings:{},stats:{}});
 const base={...q,id:'q',deckId:'d',srs:C.newSrs(),note:'旧',noteUpdatedAt:1,lastAttempt:{at:1,correct:false}};
 const merged=C.mergeState(state({...base,note:'新',noteUpdatedAt:2,lastAttempt:{at:2,correct:true},wrong:false}),state(base));assert.equal(merged.cards[0].note,'新');assert.equal(merged.cards[0].lastAttempt.correct,true);assert.equal(merged.cards[0].options.length,5);
});
