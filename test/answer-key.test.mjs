import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/js/core.js';
const C=globalThis.MJZ.core;
const questions='一，单选\n1.甲()\nA.一\nB.二\n二，多选\n2.乙()\nA.甲\nB.乙\nC.丙';
test('trailing answer key maps answers by question number',()=>{
 for(const suffix of ['参考答案\n1.A 2.AC','答案汇总：\n2、A、C\n1、A','答案：1.A；2.AC']){
  const cards=C.parseText(questions+'\n'+suffix).cards;assert.deepEqual(cards.map(q=>q.answers),[['A'],['A','C']]);assert.match(cards[1].def,/答案：AC/);
 }
});
test('rejects missing, repeated or conflicting question numbers and invalid keys',()=>{
 assert.throws(()=>C.parseText(questions+'\n参考答案\n3.A'),/不存在或不唯一/);
 assert.throws(()=>C.parseText('1.甲\nA.一\nB.二\n1.乙\nA.一\nB.二\n参考答案\n1.A'),/不存在或不唯一/);
 assert.throws(()=>C.parseText(questions+'\n参考答案\n1.A\n1.B'),/冲突/);
 assert.throws(()=>C.parseText(questions+'\n参考答案\n1.E'),/答案必须来自/);
 assert.throws(()=>C.parseText(questions+'\n参考答案\n2.A'),/至少需要两个答案/);
});

test('restarted numbering maps repeated numbers in appearance order only when counts match',()=>{
 const text='一，单选\n1.甲\nA.一\nB.二\n二，多选\n1.乙\nA.甲\nB.乙\nC.丙\n参考答案\n1.A 1.BC';
 assert.deepEqual(C.parseText(text).cards.map(q=>q.answers),[['A'],['B','C']]);
});
