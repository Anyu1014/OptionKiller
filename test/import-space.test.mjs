import test from 'node:test';
import assert from 'node:assert/strict';
import '../web/js/core.js';
const C = globalThis.MJZ.core;
test('space-numbered questions and screenshot answer and explanation', () => {
 const cards = C.parseImport('04 【S】 幻听\n患者听到声音属于：\nA. 命令性幻听\nB. 功能性幻觉\nC. 反射性幻觉\nD. 评论性幻听\n答案 | D\n解析/易错 | 声音在评论患者的行为。\n05 另一题\nA选项一\nB选项二\nC选项三').cards;
 assert.equal(cards.length, 2);
 assert.equal(cards[0].term, '【S】 幻听\n患者听到声音属于:');
 assert.deepEqual(cards[0].answers, ['D']);
 assert.equal(cards[0].explanation, '声音在评论患者的行为。');
 assert.equal(cards[1].term, '另一题');
 assert.deepEqual(cards[1].options.map(o => o.text), ['选项一', '选项二', '选项三']);
 assert.deepEqual(cards[1].answers, []);
});
test('numeric continuation inside an option remains option text', () => {
 const q = C.parseImport('1.题\nA.数值\n20 mg 每日一次\nB.其他').cards[0];
 assert.equal(q.options[0].text, '数值\n20 mg 每日一次');
});
