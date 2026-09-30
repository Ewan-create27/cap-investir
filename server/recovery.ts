import {createHmac,randomInt,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {runtime} from './runtime';
import {actor,hash,passwordHash,secretEqual} from './auth';
import {emailConfigured,sendCode} from './email';
const emailSchema=z.string().trim().toLowerCase().email().max(254);
const codeHash=(id:string,code:string)=>createHmac('sha256',process.env.SESSION_SECRET!).update(id+':'+code).digest('hex');
const generic='Si cette adresse est vérifiée sur un compte, un code sera envoyé. Consulte aussi les courriers indésirables.';
const invalid='Code incorrect, expiré ou déjà utilisé. Demande un nouveau code si nécessaire.';
export async function GET(req:Request){const a=await actor(req);if(!a)return Response.json({error:'Connexion requise.'},{status:401});const row=await runtime().DB.prepare('SELECT email,email_verified FROM accounts WHERE id=?').bind(a.id).first();return Response.json({...row,configured:emailConfigured()});}
export async function POST(req:Request){try{
 const b=await req.json(),db=runtime().DB;
 if(b.action==='requestReset'||b.action==='requestVerification'){
  if(!emailConfigured())return Response.json({error:'La récupération par e-mail n’est pas encore configurée. Contacte l’administrateur.'},{status:503});
  const email=emailSchema.parse(b.email),purpose=b.action==='requestReset'?'reset':'verify';
  const id=randomBytes(24).toString('base64url'),code=String(randomInt(0,1000000)).padStart(6,'0'),at=Date.now();
  let account:any;
  if(purpose==='verify'){
   const a=await actor(req);if(!a)return Response.json({error:'Connexion requise.'},{status:401});
   account=await db.prepare('SELECT * FROM accounts WHERE id=?').bind(a.id).first();
   const password=z.string().max(256).parse(b.currentPassword);
   if(!secretEqual(await passwordHash(password,account.salt),account.password_hash))throw Error('Mot de passe actuel incorrect.');
  }else account=await db.prepare('SELECT * FROM accounts WHERE email=? AND email_verified=true').bind(email).first();
  let issued=false;
  if(account)issued=await db.transaction(async(d:any)=>{
   const fresh=await d.prepare('SELECT * FROM accounts WHERE id=?').bind(account.id).first();
   if(!fresh||fresh.password_hash!==account.password_hash||(purpose==='reset'&&(!fresh.email_verified||fresh.email!==email)))return false;
   const recent=(await d.prepare('SELECT created FROM email_challenges WHERE account_id=? AND purpose=? AND created>?').bind(account.id,purpose,at-3600000).all()).results;
   if(recent.length>=5||recent.some((r:any)=>Number(r.created)>at-60000))return false;
   await d.prepare('DELETE FROM email_challenges WHERE expires<?').bind(at-86400000).run();
   await d.prepare('UPDATE email_challenges SET used=true WHERE account_id=? AND purpose=?').bind(account.id,purpose).run();
   await d.prepare('INSERT INTO email_challenges(id,account_id,purpose,email,code_hash,password_fingerprint,created,expires) VALUES(?,?,?,?,?,?,?,?)').bind(id,account.id,purpose,email,codeHash(id,code),hash(account.password_hash),at,at+600000).run();
   return true;
  });
  if(issued){try{await sendCode(email,code,purpose,id);}catch{
   await db.prepare('UPDATE email_challenges SET used=true WHERE id=?').bind(id).run();
   console.error('Envoi du code e-mail indisponible. Vérifier la configuration du service e-mail.');
   // Recovery always returns the same public response, including delivery failures.
   if(purpose==='verify')return Response.json({error:'Envoi impossible. Réessaie dans une minute ou contacte l’administrateur.'},{status:503});
  }}else if(purpose==='verify')return Response.json({error:'Attends une minute avant de renvoyer un code. Maximum cinq envois par heure.'},{status:429});
  return Response.json({ok:true,challengeId:id,message:purpose==='reset'?generic:'Code envoyé. Il est valable 10 minutes.'});
 }
 if(b.action==='confirmVerification'||b.action==='resetPassword'){
  const purpose=b.action==='resetPassword'?'reset':'verify';
  const id=z.string().regex(/^[A-Za-z0-9_-]{32}$/).parse(b.challengeId),code=z.string().regex(/^\d{6}$/).parse(b.code);
  const a=purpose==='verify'?await actor(req):null;if(purpose==='verify'&&!a)return Response.json({error:'Connexion requise.'},{status:401});
  const newPassword=purpose==='reset'?z.string().min(12).max(256).parse(b.password):null;
  const salt=newPassword?randomBytes(32).toString('hex'):null,ph=newPassword?await passwordHash(newPassword,salt!):null;
  const result=await db.transaction(async(d:any)=>{
   const row=await d.prepare('SELECT * FROM email_challenges WHERE id=? AND purpose=?').bind(id,purpose).first();
   if(!row||row.used||Number(row.expires)<=Date.now()||row.attempts>=5||(purpose==='verify'&&row.account_id!==a.id))return {error:invalid};
   const account=await d.prepare('SELECT * FROM accounts WHERE id=?').bind(row.account_id).first();
   if(!account||hash(account.password_hash)!==row.password_fingerprint||(purpose==='reset'&&(!account.email_verified||account.email!==row.email)))return {error:invalid};
   if(!secretEqual(codeHash(id,code),row.code_hash)){
    // Return, rather than throw, so failed-attempt increments are committed.
    await d.prepare('UPDATE email_challenges SET attempts=attempts+1 WHERE id=?').bind(id).run();return {error:invalid};
   }
   if(purpose==='verify'){
    const existing=await d.prepare('SELECT id FROM accounts WHERE email=? AND email_verified=true AND id<>?').bind(row.email,account.id).first();
    if(existing){await d.prepare('UPDATE email_challenges SET used=true WHERE id=?').bind(id).run();return {error:'Cette adresse ne peut pas être associée à ce compte.'};}
    await d.prepare('UPDATE accounts SET email=?,email_verified=true WHERE id=?').bind(row.email,account.id).run();
   }else{
    await d.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').bind(salt,ph,account.id).run();
    await d.prepare('DELETE FROM user_sessions WHERE account_id=?').bind(account.id).run();
   }
   await d.prepare('UPDATE email_challenges SET used=true WHERE account_id=?').bind(account.id).run();
   return {ok:true};
  });return Response.json(result,{status:result.error?400:200});
 }
 throw Error('Action inconnue.');
}catch(e){return Response.json({error:e instanceof z.ZodError?'Vérifie l’adresse e-mail, le code à 6 chiffres et le mot de passe (12 caractères minimum).':e instanceof Error?e.message:'Impossible de traiter la demande.'},{status:400});}}
