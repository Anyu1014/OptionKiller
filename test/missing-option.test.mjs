import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/js/core.js';
const state=global.MJZ.core.optionState;
test('multi choice marks omitted and wrongly selected options red',()=>{
 const q={type:'multi',answers:['A','B']};assert.equal(state(q,'A',true,true,false),'correct');assert.equal(state(q,'B',false,true,false),'incorrect');assert.equal(state(q,'C',true,true,false),'incorrect');assert.equal(state(q,'C',false,true,false),'');assert.equal(state(q,'B',false,true,true),'correct');assert.equal(state(q,'A',false,false,false),'');
});
test('single choice and unanswered keys keep prior behavior',()=>{
 assert.equal(state({type:'single',answers:['A']},'A',false,true,false),'correct');assert.equal(state({type:'single',answers:['A']},'B',true,true,false),'incorrect');assert.equal(state({type:'multi',answers:[]},'A',true,true,false),'');
});
