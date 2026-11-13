import {readFile,readdir,mkdir,writeFile,cp,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const src=path.resolve(fileURLToPath(new URL('..',import.meta.url))), root=path.dirname(src);
const latest=path.join(root,'build/latest'), dist=path.join(latest,'dist'), bundle=path.join(root,'.cache/sites-bundle');
await mkdir(latest,{recursive:true});
try { await readdir(dist); const history=path.join(root,'build/history',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(history,{recursive:true});await rename(dist,path.join(history,'dist')); } catch(e) {if(e.code!=='ENOENT')throw e;}
await mkdir(dist,{recursive:true});await cp(path.join(src,'web'),dist,{recursive:true,filter:p=>!p.endsWith('_worker.js')});
// A dependency-free Worker bundles the same assets; no local data or credentials enter it.
const assets={};
async function collect(dir,base=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const rel=path.posix.join(base,entry.name),file=path.join(dir,entry.name);
  if(entry.isDirectory())await collect(file,rel);
  else if(entry.name!=='_worker.js'){
   const ext=path.extname(file),buf=await readFile(file),binary=ext==='.png';
   assets['/'+rel]={body:binary?buf.toString('base64'):buf.toString('utf8'),binary,type:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'})[ext]||'text/plain'};
  }
 }
}
await collect(path.join(src,'web'));
let worker=await readFile(path.join(src,'web/_worker.js'),'utf8');
if(worker.includes("import './js/core.js';"))worker=worker.replace("import './js/core.js';",await readFile(path.join(src,'web/js/core.js'),'utf8'));
worker=worker.replace('export default {','const apiWorker = {');
worker+='\nconst STATIC='+JSON.stringify(assets)+';\n'+`
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return apiWorker.fetch(request,env,ctx);
 const asset=STATIC[url.pathname==='/'?'/index.html':url.pathname];
 if(!asset)return new Response('Not found',{status:404});
 const body=asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
 return new Response(request.method==='HEAD'?null:body,{headers:{'content-type':asset.type,'x-content-type-options':'nosniff'}});
}};`;
await rm(bundle,{recursive:true,force:true});
await mkdir(path.join(bundle,'server'),{recursive:true});
await writeFile(path.join(bundle,'server/index.js'),worker);
await mkdir(path.join(bundle,'.openai'),{recursive:true});
await cp(path.join(src,'.openai/hosting.json'),path.join(bundle,'.openai/hosting.json'));
console.log('WEB '+dist);console.log('WORKER '+path.join(bundle,'server/index.js'));
