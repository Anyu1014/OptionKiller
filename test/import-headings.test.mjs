import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/js/core.js';
const C=globalThis.MJZ.core;
test('single or multi header can use any one of its names',()=>{
 for(const [head,type] of [['单项选择题','single'],['单选','single'],['单选题','single'],['单选/A型题','single'],['A型题','single'],['多项选择题','multi'],['多选','multi'],['多选题','multi'],['多选/X型题','multi'],['X型题','multi']]){
  let q=C.parseImport('一，'+head+'\n1.题目()\nA.一\nB.二').cards[0];assert.equal(q.type,type,head);
 }
});
test('formatting renumbers after removal and only emits section title on type change',()=>{
 let cards=C.parseImport('一，单选\n5.甲()\nA.一\nB.二\n9.乙()\nA.一\nB.二\n二，多选\n12.丙()\nA.一\nB.二').cards;
 let text=C.questionText(cards.slice(1));assert.match(text,/1\.乙/);assert.match(text,/2\.丙/);assert.equal(C.parseImport(text).cards.length,2);assert.equal((C.questionText(cards).match(/一，单项选择题/g)||[]).length,1);
});
