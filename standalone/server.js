import {createServer} from 'node:http';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {api} from '../server/api.js';
import {openDatabase,asD1} from './database.js';
import {authService} from './auth.js';
export async function createCap({dbPath,origin,databaseUrl,database}){
 const url=new URL(origin);if(url.origin!==origin)throw new Error('APP_ORIGIN doit être une origine sans chemin ni slash final.');
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('HTTPS est obligatoire hors localhost.');
 const db=database||await openDatabase(dbPath,databaseUrl),auth=authService(db,origin),DB=asD1(db),assets=new Map();
 for(const name of readdirSync(new URL('../public/',import.meta.url)))assets.set('/'+name,readFileSync(new URL('../public/'+name,import.meta.url)));
 const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"};
 if(url.protocol==='https:')headers['Strict-Transport-Security']='max-age=31536000';
 async function handle(req,ip='unknown'){
  const path=new URL(req.url).pathname;
  if(path==='/api/runtime')return Response.json({auth:'cap'});
  if(path==='/healthz')return Response.json({ok:true});
  if(path.startsWith('/api/auth/'))return auth.handle(req,ip);
  if(path.startsWith('/api/'))return api(req,{DB},await auth.identity(req));
  if(!['GET','HEAD'].includes(req.method))return new Response('Méthode non autorisée',{status:405});
  const file=path==='/'?'/index.html':path,data=assets.get(file);
  return data?new Response(req.method==='HEAD'?null:data,{headers:{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'}}):new Response('Page introuvable',{status:404});
 }
 const server=createServer(async(req,res)=>{
  try{
   const parts=[];let length=0;for await(const part of req){length+=part.length;if(length>1000000){res.writeHead(413,headers);res.end('Requête trop volumineuse');return}parts.push(part)}
   // The configured public origin is authoritative; proxy and identity headers are never trusted.
   const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});
   const response=await handle(request,req.socket.remoteAddress||'unknown');res.writeHead(response.status,{...headers,...Object.fromEntries(response.headers)});res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('Cap request failed:',error.message);res.writeHead(500,headers);res.end(JSON.stringify({error:'Service temporairement indisponible.'}))}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 return {server,handle,db};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||3000),origin=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL||'http://localhost:'+port;
 if(process.env.RENDER&&!process.env.DATABASE_URL)throw new Error('DATABASE_URL est obligatoire sur Render : ajoute la connexion Neon dans Environment.');
 const app=await createCap({dbPath:process.env.DATABASE_PATH||'./data/cap.sqlite',databaseUrl:process.env.DATABASE_URL,origin});
 app.server.listen(port,'0.0.0.0',()=>console.log('Cap autonome prêt sur '+origin));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.server.close(async()=>{await app.db.close();process.exit(0)}));
}
