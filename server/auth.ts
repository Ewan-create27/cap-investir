import {createHash,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {runtime} from './runtime';
const derive=promisify(scrypt);export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function initAuth(){if((process.env.ADMIN_PASSWORD||'').length<12||(process.env.SESSION_SECRET||'').length<32)throw Error('ADMIN_PASSWORD : 12 caractères minimum ; SESSION_SECRET : 32 minimum.');if((process.env.INVITE_CODE||'').length<12||process.env.INVITE_CODE===process.env.ADMIN_PASSWORD)throw Error('INVITE_CODE doit contenir au moins 12 caractères et être différent de ADMIN_PASSWORD.');if((process.env.ADMIN_PASSWORD||'').length>256||(process.env.INVITE_CODE||'').length>256)throw Error('Les mots de passe de configuration sont limités à 256 caractères.');}
export function secretEqual(a:unknown,b:string){return typeof a==='string'&&a.length<=256&&timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));}
export async function passwordHash(password:string,salt:string){return (await derive(password,salt,64) as Buffer).toString('hex');}
export function token(req:Request){return /(?:^|;\s*)pari_session=([A-Za-z0-9_-]+)/.exec(req.headers.get('cookie')||'')?.[1]||'';}
export async function actor(req:Request){return runtime().DB.prepare('SELECT a.id,a.person_id,a.username FROM user_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.hash=? AND s.expires>? AND s.fingerprint=?').bind(hash(token(req)),Date.now(),hash(process.env.SESSION_SECRET!)).first();}
export async function authorized(req:Request){return !!await actor(req);}
export async function session(accountId:string){const t=randomBytes(32).toString('base64url');await runtime().DB.prepare('INSERT INTO user_sessions(hash,account_id,expires,fingerprint) VALUES(?,?,?,?)').bind(hash(t),accountId,Date.now()+604800000,hash(process.env.SESSION_SECRET!)).run();return t;}
export async function login(username:unknown,password:unknown){if(typeof username!=='string'||typeof password!=='string'||password.length>256)return null;const a=await runtime().DB.prepare('SELECT * FROM accounts WHERE username=?').bind(username.trim().toLowerCase()).first();const h=await passwordHash(password,a?.salt||'missing-account-constant-salt');if(!a||!secretEqual(h,a.password_hash))return null;return session(a.id);}
export async function logout(req:Request){await runtime().DB.prepare('DELETE FROM user_sessions WHERE hash=?').bind(hash(token(req))).run();}
export function cookie(value:string,secure:boolean){return `pari_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value?604800:0}${secure?'; Secure':''}`;}
