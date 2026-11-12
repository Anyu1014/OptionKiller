import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../web/js/core.js';

test('editing keeps input until save, and reopening formats saved questions', () => {
  const app = readFileSync(new URL('../web/js/app.js', import.meta.url), 'utf8');
  const editor = app.slice(app.indexOf('function openDeckEditor('), app.indexOf('var STAR_PATH'));
  assert.doesNotMatch(editor, /formatEditor|text:\s*['"]自动排版/);
  assert.match(editor, /parsed = C\.parseText\(textarea\.value\)/);
  assert.match(editor, /textarea\.value = deckToText\(cards\)/);
  const C = globalThis.MJZ.core;
  const cards = C.parseText('一，单选\n8.甲()\nA.一\nB.二\n答案：A\n15.乙()\nA.甲\nB.乙\n答案：B').cards;
  const formatted = C.questionText(cards);
  assert.match(formatted, /1\.甲/);
  assert.match(formatted, /2\.乙/);
  assert.deepEqual(C.parseText(formatted).cards.map(q => q.answers), [['A'], ['B']]);
});
