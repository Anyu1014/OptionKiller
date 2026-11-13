import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('registration email links to the deployed OptionKiller website',()=>{
 const worker=readFileSync(new URL('../web/_worker.js',import.meta.url),'utf8');
 assert.match(worker,/const link = 'https:\/\/optionkiller\.pages\.dev'/);
 assert.doesNotMatch(worker.slice(worker.indexOf('function welcomeMail'),worker.indexOf('function resetMail')),/optionkiller\.yuanhyu1014\.workers\.dev/);
});
