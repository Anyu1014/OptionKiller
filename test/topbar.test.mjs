import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=rel=>readFileSync(new URL('../'+rel,import.meta.url),'utf8');
test('import lives in the deck picker, not the header; no stale boot binding',()=>{
 const html=read('web/index.html'),app=read('web/js/app.js');
 assert.doesNotMatch(html,/importQuick/);assert.doesNotMatch(app,/getElementById\('importQuick'\)/);
 const picker=app.slice(app.indexOf('function openDecks('),app.indexOf('function openImport('));
 assert.match(picker,/onclick: function \(\) \{ openImport\(\); \}/);assert.match(picker,/'导入题库'/);
 assert.match(app,/function openImport\(presetDeckId, onCancel\)/);
});
test('header sizing remains in the shared NounKiller layout rules',()=>{
 const css=read('web/css/option.css');
 assert.doesNotMatch(css,/font-size:\s*\d+px!important/);
 assert.doesNotMatch(css,/\.appbar[^{}]*\{[^{}]*(?:padding|flex-wrap|position|gap):/);
 assert.match(read('web/css/app.css'),/padding: 9px max\(12px, env\(safe-area-inset-right\)\)/);
 assert.match(read('web/js/app.js'),/while \(appbar && appbar.scrollWidth > appbar.clientWidth \+ 1 && size > 11/);
});
