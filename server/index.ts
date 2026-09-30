import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {runtime,initRuntime,closeRuntime} from './runtime';
import {initAuth,authorized,actor,login,logout,cookie} from './auth';
import {seed} from '../lib/store';
import * as recovery from './recovery';
import * as accounts from './accounts';
import * as data from '../app/api/data/route';
import * as avatar from '../app/api/avatar/route';
import * as push from '../app/api/push/route';
import * as cron from '../app/api/cron/route';
const port=Number(process.env.PORT||3000),base=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||`http://localhost:${port}`;
const origin=new URL(base).origin;process.env.APP_URL=origin;
if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://'))throw Error('APP_URL doit être une URL HTTPS en production.');
initAuth();await initRuntime();await seed();
const limits=new Map<string,{count:number,until:number}>();
function limited(ip:string,max=10){const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);if(limits.size>10000)return true;const v=limits.get(ip)||{count:0,until:now+600000};v.count++;limits.set(ip,v);return v.count>max;}
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const root=resolve('dist');
const routes:Record<string,any>={'/api/recovery':recovery,'/api/data':data,'/api/avatar':avatar,'/api/push':push,'/api/cron':cron};
const server=createServer(async (incoming,outgoing)=>{try{
 const headers=new Headers();for(const [k,v] of Object.entries(incoming.headers))if(v)headers.set(k,Array.isArray(v)?v.join(', '):v);
 const url=new URL(incoming.url||'/',origin);if(url.origin!==origin){outgoing.writeHead(400);outgoing.end();return;}
 const method=incoming.method||'GET';
 if(!['GET','HEAD','POST','DELETE'].includes(method)){outgoing.writeHead(405);outgoing.end();return;}
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of incoming){size+=chunk.length;if(size>400000){outgoing.writeHead(413);outgoing.end('Requête trop volumineuse.');return;}chunks.push(chunk);}
 const req=new Request(url,{method,headers,...(size?{body:Buffer.concat(chunks)}:{})});
 let response:Response;
 if(url.pathname==='/healthz')response=Response.json({ok:true});
 else if(['POST','DELETE'].includes(method)&&headers.get('origin')&&headers.get('origin')!==origin)response=Response.json({error:'Origine non autorisée.'},{status:403});
 else if(url.pathname==='/api/session'){
  if(method==='GET')response=Response.json({authorized:await authorized(req),actor:await actor(req)});
  else if(method==='DELETE'){await logout(req);response=Response.json({ok:true},{headers:{'Set-Cookie':cookie('',origin.startsWith('https:'))}});}
  else if(method==='POST'){
   // Only trust Render's client-IP header on Render; direct local connections use socket IP.
   const ip=process.env.RENDER?(headers.get('x-render-client-ip')||incoming.socket.remoteAddress||'unknown'):(incoming.socket.remoteAddress||'unknown');
   if(limited(ip))response=Response.json({error:'Trop de tentatives. Réessaie dans dix minutes.'},{status:429});
   else {const body:any=await req.json();const t=await login(body.username,body.password);response=t?Response.json({ok:true},{headers:{'Set-Cookie':cookie(t,origin.startsWith('https:'))}}):Response.json({error:'Mot de passe incorrect.'},{status:401});}
  }else response=new Response('Method not allowed',{status:405});
 }else if(url.pathname==='/api/recovery'&&method==='POST'){const ip=process.env.RENDER?(headers.get('x-render-client-ip')||incoming.socket.remoteAddress||'unknown'):(incoming.socket.remoteAddress||'unknown');response=limited('recovery:'+ip,30)?Response.json({error:'Trop de tentatives. Réessaie dans dix minutes.'},{status:429}):await recovery.POST(req);
 }else if(url.pathname==='/api/accounts'&&method==='POST'){const ip=incoming.socket.remoteAddress||'unknown';response=limited('account:'+ip,30)?Response.json({error:'Trop de tentatives. Réessaie dans dix minutes.'},{status:429}):await accounts.POST(req);
 }else if(url.pathname.startsWith('/api/')){
  if(url.pathname!=='/api/cron'&&!await authorized(req))response=Response.json({error:'Connecte-toi pour accéder à la bande.'},{status:401});
  else if(!routes[url.pathname])response=new Response('Not found',{status:404});
  else {const fn=routes[url.pathname][method];response=fn?await fn(req):new Response('Method not allowed',{status:405});}
 }else{
  let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(path!==root&&!path.startsWith(root+sep))response=new Response('Not found',{status:404});
  else {let file=path;try{if(statSync(file).isDirectory())file=resolve(file,'index.html');statSync(file);}catch{file=url.pathname.includes('.')?'':resolve(root,'index.html');}
   if(!file)response=new Response('Not found',{status:404});else response=new Response(readFileSync(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':file.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache'}});
  }
 }
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');response.headers.set('Referrer-Policy','same-origin');
 if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/avatar')response.headers.set('Cache-Control','no-store');
 outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error('Request failed',e instanceof Error?e.message:'Unexpected error');if(!outgoing.headersSent)outgoing.writeHead(500,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({error:'Le serveur a rencontré un problème. Réessaie.'}));}});
// External scheduler only: no minute-by-minute query that keeps Neon awake.
server.listen(port,'0.0.0.0',()=>console.log(`Pari à Long Terme listening on port ${port}`));
function shutdown(){server.close(async()=>{await closeRuntime();process.exit(0);});setTimeout(()=>process.exit(0),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
