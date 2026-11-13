import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, cp, writeFile, readdir, access, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const src=fileURLToPath(new URL('..',import.meta.url)), root=path.dirname(src);
test('project folders and current deliverables stay classified',async()=>{
 const dirs=(await readdir(root,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort();
 assert.deepEqual(dirs,['.cache','build','src']);
 const current=(await readdir(path.join(root,'build/latest'))).filter(x=>x!=='.DS_Store');assert.equal(current.length,3);assert.ok(current.includes('dist'));assert.equal(current.filter(x=>x.endsWith('.apk')).length,1);assert.equal(current.filter(x=>x.endsWith('.ipa')).length,1);
 await assert.rejects(access(path.join(src,'dist')));
 assert.deepEqual((await readdir(path.join(src,'tool'))).sort(),['build.mjs','dev.mjs','pages','run.sh']);
});
test('web builder keeps disposable Sites bundle out of src and archives old dist',async()=>{
 const dir=await mkdtemp(path.join(root,'.cache/layout-test-'));
 try{
  await mkdir(path.join(dir,'src/tool'),{recursive:true});await mkdir(path.join(dir,'src/web'));await mkdir(path.join(dir,'src/.openai'));
  await cp(path.join(src,'tool/build.mjs'),path.join(dir,'src/tool/build.mjs'));
  await writeFile(path.join(dir,'src/web/index.html'),'<html>fixture</html>');await writeFile(path.join(dir,'src/web/_worker.js'),'export default {fetch(){return new Response("ok")}}');await writeFile(path.join(dir,'src/.openai/hosting.json'),'{}');
  for(let i=0;i<2;i++){const r=spawnSync('/Users/y/toolchains/bin/node',[path.join(dir,'src/tool/build.mjs')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  await access(path.join(dir,'build/latest/dist/index.html'));await access(path.join(dir,'.cache/sites-bundle/server/index.js'));await assert.rejects(access(path.join(dir,'src/dist')));
  assert.equal((await readdir(path.join(dir,'build/history'))).length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
