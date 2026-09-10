import {scrypt,randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt), hash=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const options={N:32768,r:8,p:3,maxmem:64*1024*1024};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await derive(password,salt,64,options)).toString('hex')}
async function verify(password,stored){const [salt,expected]=stored.split(':');const actual=await derive(password,salt,64,options);return timingSafeEqual(actual,Buffer.from(expected,'hex'))}
export function authService(db,origin){
 const secure=origin.startsWith('https:'),cookieName=secure?'__Host-cap_session':'cap_session';
 const cookie=(value,seconds)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`;
 const cookieToken=req=>(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 const identity=async req=>await db.prepare('SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?').get(hash(cookieToken(req)),Date.now());
 async function issue(id){const value=token();await db.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run(hash(value),id,Date.now()+30*86400000);return cookie(value,30*86400)}
 async function limit(key,max){const now=Date.now();await db.prepare('DELETE FROM auth_limits WHERE reset < ?').run(now);const row=await db.prepare('INSERT INTO auth_limits(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=auth_limits.count+1 RETURNING count').get(hash(key),now+900000);return row.count<=max}
 let active=0;
 const dummy='0'.repeat(32)+':'+ '0'.repeat(128);
 async function handle(req,ip){
  if(req.method!=='POST')return json({error:'Méthode non autorisée.'},405);
  if(req.headers.get('origin')!==origin || !req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Requête non autorisée.'},403);
  const path=new URL(req.url).pathname;
  if(!['/api/auth/register','/api/auth/login','/api/auth/logout','/api/auth/recover'].includes(path))return json({error:'Page introuvable.'},404);
  if(path.endsWith('/logout')){await db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(cookieToken(req)));return json({ok:true},200,{'Set-Cookie':cookie('',0)})}
  if(!await limit('ip:'+ip,60))return json({error:'Trop de tentatives. Réessaie dans 15 minutes.'},429);
  const raw=await req.text();if(raw.length>8192)return json({error:'Formulaire trop volumineux.'},413);
  let body;try{body=JSON.parse(raw)}catch{return json({error:'Formulaire invalide.'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Formulaire invalide.'},400);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return json({error:'Indique un e-mail valide et un mot de passe de 12 à 128 caractères.'},400);
  if(!await limit('email:'+email,20))return json({error:'Trop de tentatives. Réessaie dans 15 minutes.'},429);
  if(active>=2)return json({error:'Connexion occupée. Réessaie dans quelques secondes.'},503);
  active++;
  try{
   await db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
   const user=await db.prepare('SELECT * FROM users WHERE email=?').get(email);
   if(path.endsWith('/register')){
    if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>60)return json({error:'Indique un prénom de 1 à 60 caractères.'},400);
    if(user)return json({error:'Ce compte existe déjà. Connecte-toi ou utilise ton code de récupération.'},409);
    const password=await passwordHash(body.password),id=randomUUID(),recoveryCode=token();
    try{await db.prepare('INSERT INTO users(id,email,name,password,recovery,created_at) VALUES(?,?,?,?,?,?)').run(id,email,body.name.trim(),password,hash(recoveryCode),new Date().toISOString())}catch(e){if(await db.prepare('SELECT id FROM users WHERE email=?').get(email))return json({error:'Ce compte existe déjà.'},409);throw e}
    return json({ok:true,recoveryCode},201,{'Set-Cookie':await issue(id)});
   }
   if(path.endsWith('/recover')){
    if(typeof body.code!=='string'||body.code.length>100||!user||!timingSafeEqual(Buffer.from(hash(body.code.trim()),'hex'),Buffer.from(user.recovery,'hex')))return json({error:'E-mail ou code de récupération incorrect.'},401);
    const password=await passwordHash(body.password),recoveryCode=token();
    const changed=await db.transaction(async tx=>{
     const result=await tx.prepare('UPDATE users SET password=?,recovery=? WHERE id=? AND recovery=?').run(password,hash(recoveryCode),user.id,user.recovery);
     if(!result.changes)return false;
     await tx.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);return true;
    });
    if(!changed)return json({error:'Ce code a déjà été utilisé.'},401);
    return json({ok:true,recoveryCode},200,{'Set-Cookie':await issue(user.id)});
   }
   const valid=await verify(body.password,user?.password||dummy);
   if(!user||!valid)return json({error:'E-mail ou mot de passe incorrect.'},401);
   const session=await db.transaction(async tx=>{
    const unchanged=await tx.prepare('UPDATE users SET password=password WHERE id=? AND password=?').run(user.id,user.password);
    if(!unchanged.changes)return null;
    const value=token();await tx.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run(hash(value),user.id,Date.now()+30*86400000);return cookie(value,30*86400);
   });
   if(!session)return json({error:'Le mot de passe a changé. Reconnecte-toi.'},401);
   return json({ok:true},200,{'Set-Cookie':session});
  }finally{active--}
 }
 return {identity,handle};
}
