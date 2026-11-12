import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=rel=>readFileSync(new URL('../web/'+rel,import.meta.url),'utf8');
test('NounKiller settings groups and non-fullscreen sheets are present',()=>{
 const app=read('js/app.js'),css=read('css/option.css'),base=read('css/app.css');
 const settings=app.slice(app.indexOf('function openSettings()'),app.indexOf('function applyFontScale()'));
 for(const label of ['每日目标','正文字号','重置本库进度','关于','作者：Anyu'])assert.ok(settings.includes(label),label);
 for(const label of ['点亮范围','划线标记','划线颜色'])assert.ok(!settings.includes(label),label);
 assert.match(settings,/答题记录、错题状态和复习排期/);
 assert.doesNotMatch(css,/\.modal-panel\{border-radius:0;width:100%;max-width:none;max-height:100dvh;height:100dvh\}/);
 assert.match(base,/max-height:\s*92dvh/);assert.match(base,/\.modal\.is-tall/);
});
