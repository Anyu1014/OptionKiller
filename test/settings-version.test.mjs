import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('reset clears question progress and retains personal content',()=>{
 const ctx=vm.createContext({crypto,Date,console,setTimeout,clearTimeout,addEventListener(){},document:{visibilityState:'visible'},localStorage:{getItem(){return null},setItem(){}}});
 for(const name of ['core','store'])vm.runInContext(fs.readFileSync(new URL('../web/js/'+name+'.js',import.meta.url),'utf8'),ctx);
 const store=ctx.MJZ.store.create(),card=store.state.cards[0];Object.assign(card,{fav:true,note:'笔记',scratchBoxes:[{text:'草稿'}],mastered:true,wrong:true,attempts:3,correctCount:1,lastAttempt:{correct:false},draft:{selected:['A']}});
 assert.equal(store.resetDeckProgress(card.deckId),2);assert.equal(card.wrong,false);assert.equal(card.attempts,0);assert.equal(card.lastAttempt,undefined);assert.equal(card.draft,undefined);assert.equal(card.srs.state,'new');assert.equal(card.fav,true);assert.equal(card.note,'笔记');assert.equal(card.scratchBoxes[0].text,'草稿');assert.equal(card.mastered,true);
});
