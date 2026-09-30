import pg from 'pg';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createECDH} from 'node:crypto';

let cached:Record<string,any>|undefined;
let pool:pg.Pool;

// Keep the small statement API used by the domain layer; translate placeholders
// outside SQL string literals. All parameter values still go through pg bindings.
function postgresSQL(query:string){
 let index=0;
 let text=query.replace(/'(?:''|[^'])*'|\?/g,part=>part==='?'?`$${++index}`:part);
 if(/^INSERT OR IGNORE INTO /i.test(text))text=text.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO ')+' ON CONFLICT DO NOTHING';
 return text;
}
function statement(query:string,executor:Pick<pg.Pool,'query'>=pool){
 const text=postgresSQL(query);let values:any[]=[];
 return {text,get values(){return values;},bind(...args:any[]){values=args;return this;},
  async first(){return (await executor.query(text,values)).rows[0]||null;},
  async all(){return {results:(await executor.query(text,values)).rows};},
  async run(){return {meta:{changes:(await executor.query(text,values)).rowCount||0}};}
 };
}
export function runtime():Record<string,any>{if(!cached)throw Error('Base de données non initialisée.');return cached;}
export async function closeRuntime(){await pool?.end();cached=undefined;}
export async function initRuntime(){
 if(cached)return cached;
 const databaseURL=process.env.DATABASE_URL;
 if(!databaseURL)throw Error('DATABASE_URL est obligatoire : copiez la connexion PostgreSQL depuis Neon.');
 if((process.env.CRON_SECRET||'').length<32)throw Error('CRON_SECRET doit contenir au moins 32 caractères.');
 const connection=new URL(databaseURL);
 // Use verified TLS for every remote connection. Only loopback development is plaintext.
 const local=['localhost','127.0.0.1','[::1]'].includes(connection.hostname);
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])connection.searchParams.delete(key);
 pool=new pg.Pool({connectionString:connection.toString(),ssl:local?false:{rejectUnauthorized:true},max:4,idleTimeoutMillis:10000,connectionTimeoutMillis:20000,statement_timeout:20000});
 pool.on('error',()=>console.error('Connexion PostgreSQL interrompue ; reconnexion à la prochaine requête.'));
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(72419001)');
  await client.query('CREATE TABLE IF NOT EXISTS _migrations(name text PRIMARY KEY, applied text NOT NULL)');
  for(const file of readdirSync(resolve('migrations')).filter(f=>f.endsWith('.sql')).sort()){
   if((await client.query('SELECT name FROM _migrations WHERE name=$1',[file])).rowCount)continue;
   await client.query(readFileSync(resolve('migrations',file),'utf8'));
   await client.query('INSERT INTO _migrations(name,applied) VALUES($1,$2)',[file,new Date().toISOString()]);
  }
  const ec=createECDH('prime256v1');ec.generateKeys();
  await client.query("INSERT INTO settings(key,value) VALUES('push_keys',$1) ON CONFLICT DO NOTHING",[JSON.stringify({public:ec.getPublicKey().toString('base64url'),private:ec.getPrivateKey().toString('base64url')})]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 const DB={prepare:statement,async transaction(fn:(tx:any)=>Promise<any>){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(72419002)');const out=await fn({prepare:(sql:string)=>statement(sql,c)});await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},async batch(statements:ReturnType<typeof statement>[]){
  const c=await pool.connect();try{
   await c.query('BEGIN');
   // Serialize this small group's multi-statement edits, including result changes.
   await c.query('SELECT pg_advisory_xact_lock(72419002)');
   const out=[];for(const s of statements){const r=await c.query(s.text,s.values);out.push({meta:{changes:r.rowCount||0}});}
   await c.query('COMMIT');return out;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }};
 const avatarKey=(key:string)=>{if(!/^avatars\/[0-9a-f-]{36}$/.test(key))throw Error('Clé photo invalide.');return key;};
 const BUCKET={
  async head(key:string){return (await pool.query('SELECT octet_length(bytes) AS size FROM avatars WHERE key=$1',[avatarKey(key)])).rows[0]||null;},
  async get(key:string){const row=(await pool.query('SELECT bytes FROM avatars WHERE key=$1',[avatarKey(key)])).rows[0];return row?{body:row.bytes}:null;},
  async put(key:string,bytes:Uint8Array){if(bytes.length>250000)throw Error('Photo trop volumineuse.');await pool.query('INSERT INTO avatars(key,bytes,created) VALUES($1,$2,$3)',[avatarKey(key),Buffer.from(bytes),new Date().toISOString()]);}
 };
 const keys=JSON.parse((await pool.query("SELECT value FROM settings WHERE key='push_keys'")).rows[0].value);
 cached={DB,BUCKET,VAPID_PUBLIC_KEY:keys.public,VAPID_PRIVATE_KEY:keys.private,CRON_SECRET:process.env.CRON_SECRET};
 return cached;
}
