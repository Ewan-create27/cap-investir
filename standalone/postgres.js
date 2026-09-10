import pg from 'pg';
import {readFile} from 'node:fs/promises';
// All statements below are application-owned SQL. Never interpolate user values.
export function pgSQL(sql){let n=0;return sql.replace(/\?/g,()=>'$'+(++n));}
export function postgresAdapter(client){return {
 prepare(sql){const query=(args)=>client.query(pgSQL(sql),args);return {
  get:async(...args)=>(await query(args)).rows[0]||null,
  all:async(...args)=>(await query(args)).rows,
  run:async(...args)=>{const r=await query(args);return {changes:r.rowCount??r.affectedRows??0}}
 }},
 exec:sql=>client.query(sql)
}}
export async function migratePostgres(client){
 await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock(67421031)');
  await client.query('CREATE TABLE IF NOT EXISTS cap_migrations (name TEXT PRIMARY KEY)');
  const found=await client.query('SELECT name FROM cap_migrations WHERE name=$1',['001-postgres']);
  if(!found.rows.length){await client.query(await readFile(new URL('./migrations/001-postgres.sql',import.meta.url),'utf8'));await client.query('INSERT INTO cap_migrations(name) VALUES($1)',['001-postgres'])}
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e}
}
export async function openPostgres(connectionString){
 const url=new URL(connectionString);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL doit être une adresse PostgreSQL.');
 // Explicit verified TLS, unaffected by sslmode=require in the copied Neon URL.
 for(const k of ['sslmode','sslcert','sslkey','sslrootcert','channel_binding'])url.searchParams.delete(k);
 const pool=new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:4,idleTimeoutMillis:10000,connectionTimeoutMillis:15000,statement_timeout:15000,enableChannelBinding:true});
 pool.on('error',()=>console.error('Connexion PostgreSQL interrompue.'));
 try{const client=await pool.connect();try{await migratePostgres(client)}finally{client.release()}}catch(e){await pool.end();throw e}
 return {...postgresAdapter(pool),kind:'postgres',close:()=>pool.end(),transaction:async fn=>{
  const client=await pool.connect();try{await client.query('BEGIN');const value=await fn(postgresAdapter(client));await client.query('COMMIT');return value}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 }};
}
