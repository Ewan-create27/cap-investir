import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {runtime} from './runtime';
import {actor,hash,secretEqual,passwordHash,session,cookie} from './auth';
import {emojis} from '../lib/model';
const credentials=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/),password:z.string().min(12).max(256)});
export async function POST(req:Request){try{const b=await req.json();const db=runtime().DB;
if(b.action==='register'){
 const email=b.email?z.string().trim().toLowerCase().email().max(254).parse(b.email):null;const c=credentials.parse(b);if(!secretEqual(b.invite,process.env.INVITE_CODE!))throw Error('Code d’invitation incorrect.');
 const name=z.string().trim().min(1).max(40).parse(b.name),avatar=z.enum(emojis as [string,...string[]]).parse(b.avatar);
 const salt=randomBytes(32).toString('hex'),ph=await passwordHash(c.password,salt),id=randomUUID();
 await db.transaction(async(d:any)=>{if(await d.prepare('SELECT id FROM accounts WHERE username=?').bind(c.username).first())throw Error('Cet identifiant est déjà utilisé.');let personId=randomUUID();
 if(b.claim){const claim=await d.prepare('SELECT person_id FROM profile_claims WHERE hash=? AND expires>?').bind(hash(String(b.claim)),Date.now()).first();if(!claim||await d.prepare('SELECT id FROM accounts WHERE person_id=?').bind(claim.person_id).first())throw Error('Code de reprise invalide ou déjà utilisé.');personId=claim.person_id;await d.prepare('DELETE FROM profile_claims WHERE person_id=?').bind(personId).run();await d.prepare('UPDATE participants SET archived=0 WHERE id=?').bind(personId).run();}
 else await d.prepare("INSERT INTO participants(id,group_id,name,avatar,color) VALUES(?,'local',?,?,'#ffe2d5')").bind(personId,name,avatar).run();
 await d.prepare('INSERT INTO accounts(id,person_id,username,salt,password_hash,email) VALUES(?,?,?,?,?,?)').bind(id,personId,c.username,salt,ph,email).run();});
 return Response.json({ok:true},{headers:{'Set-Cookie':cookie(await session(id),new URL(req.url).protocol==='https:')}});
}
// Admin access is verified on each operation; it is never granted to the first registrant.
if(b.action==='legacy'||b.action==='claimCode'||b.action==='resetPassword'){
 if(!secretEqual(b.adminPassword,process.env.ADMIN_PASSWORD!))throw Error('Mot de passe administrateur incorrect.');
 if(b.action==='legacy')return Response.json({people:(await db.prepare('SELECT p.id,p.name FROM participants p LEFT JOIN accounts a ON a.person_id=p.id WHERE a.id IS NULL').all()).results});
 if(b.action==='claimCode'){const code=randomBytes(24).toString('base64url');await db.transaction(async(d:any)=>{if(!await d.prepare('SELECT id FROM participants WHERE id=?').bind(b.personId).first()||await d.prepare('SELECT id FROM accounts WHERE person_id=?').bind(b.personId).first())throw Error('Profil indisponible.');await d.prepare('DELETE FROM profile_claims WHERE person_id=?').bind(b.personId).run();await d.prepare('INSERT INTO profile_claims(hash,person_id,expires) VALUES(?,?,?)').bind(hash(code),b.personId,Date.now()+86400000).run();});return Response.json({code});}
 const c=credentials.parse(b),salt=randomBytes(32).toString('hex'),ph=await passwordHash(c.password,salt);await db.transaction(async(d:any)=>{const a=await d.prepare('SELECT id FROM accounts WHERE username=?').bind(c.username).first();if(!a)throw Error('Compte introuvable.');await d.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').bind(salt,ph,a.id).run();await d.prepare('DELETE FROM user_sessions WHERE account_id=?').bind(a.id).run();});return Response.json({ok:true});
}
const a=await actor(req);if(!a)return Response.json({error:'Connexion requise.'},{status:401});
if(b.action==='password'){const c=credentials.parse({username:a.username,password:b.password});const old=await db.prepare('SELECT * FROM accounts WHERE id=?').bind(a.id).first();if(!secretEqual(await passwordHash(String(b.currentPassword||'').slice(0,257),old.salt),old.password_hash))throw Error('Mot de passe actuel incorrect.');const salt=randomBytes(32).toString('hex'),ph=await passwordHash(c.password,salt);await db.transaction(async(d:any)=>{await d.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').bind(salt,ph,a.id).run();await d.prepare('DELETE FROM user_sessions WHERE account_id=?').bind(a.id).run();});return Response.json({ok:true});}
throw Error('Action inconnue.');
}catch(e){return Response.json({error:e instanceof z.ZodError?'Vérifie les champs : identifiant de 3 à 32 caractères et mot de passe de 12 caractères minimum.':e instanceof Error?e.message:'Impossible de créer le compte.'},{status:400});}}
