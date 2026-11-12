import {createServer} from 'node:http';
import {watch} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const web=path.join(root,'web');
const data=process.env.OK_DATA_FILE || path.join(root,'.local','optionkiller.sqlite');
await mkdir(path.dirname(data),{recursive:true});
const db=new DatabaseSync(data); db.exec('PRAGMA journal_mode = WAL');
registerHooks({resolve(specifier,context,next){return specifier==='cloudflare:sockets'?{url:'optionkiller:mail',shortCircuit:true}:next(specifier,context);},load(url,context,next){return url==='optionkiller:mail'?{format:'module',source:'export function connect(){throw new Error("SMTP is configured in the hosted Worker only");}',shortCircuit:true}:next(url,context);}});
const worker=(await import('../web/_worker.js')).default;
function prepare(sql){
 let params=[];
 return {bind(...values){params=values;return this;},async run(){const r=db.prepare(sql).run(...params);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},async first(column){const r=db.prepare(sql).get(...params)||null;return column && r?r[column]:r;},async all(){return {results:db.prepare(sql).all(...params),success:true};}};
}
const DB={prepare,async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const liveClients=new Set();
let revision=0, reloadTimer, onlyCSS=true;
const watcher=watch(web,{recursive:true},(_event,file)=>{
 onlyCSS=onlyCSS && String(file).endsWith('.css');
 clearTimeout(reloadTimer);
 reloadTimer=setTimeout(()=>{
  const data='data: '+JSON.stringify({revision:++revision,kind:onlyCSS?'css':'reload'})+'\n\n';
  for(const client of liveClients)client.write(data);
  onlyCSS=true;
 },120);
});
const liveScript=`<script>(()=>{let revision=null;const events=new EventSource('/__dev/events');events.onmessage=event=>{const change=JSON.parse(event.data);if(revision===null){revision=change.revision;return;}if(change.revision===revision)return;revision=change.revision;if(change.kind==='css'){document.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{const url=new URL(link.href);url.searchParams.set('dev',String(revision));link.href=url.href;});}else{location.reload();}};})();</script>`;
const ASSETS={async fetch(request){
 let pathname;try{pathname=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad request',{status:400});}
 const file=path.resolve(web,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(web+path.sep) || path.basename(file).startsWith('_') || file.endsWith('.sql'))return new Response('Not found',{status:404});
 try{let body=await readFile(file);if(path.extname(file)==='.html')body=body.toString('utf8').replace('</body>',liveScript+'</body>');return new Response(body,{headers:{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}});}catch{return new Response('Not found',{status:404});}
}};
const server=createServer(async(req,res)=>{
 if(req.method==='GET' && req.url==='/__dev/events'){
  res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','connection':'keep-alive'});
  res.write('data: '+JSON.stringify({revision,kind:'ready'})+'\n\n');
  liveClients.add(res);req.on('close',()=>liveClients.delete(res));return;
 }
 try{
  let chunks=[],length=0;for await(const chunk of req){length+=chunk.length;if(length>1000000){res.writeHead(413);res.end('Payload too large');return;}chunks.push(chunk);}
  const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,{DB,ASSETS,ADMIN_EMAILS:process.env.OK_ADMIN_EMAILS||''},{waitUntil(p){p.catch(console.error);}});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e.message);res.writeHead(500);res.end('Internal server error');}
});
const port=Number(process.env.PORT)||5198;
server.listen(port,'127.0.0.1',()=>console.log('OptionKiller: http://127.0.0.1:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{watcher.close();for(const client of liveClients)client.end();server.close(()=>{db.close();process.exit(0);});});
