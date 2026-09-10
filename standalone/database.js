import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
function openSQLite(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const db=new DatabaseSync(path,{timeout:5000});
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec('CREATE TABLE IF NOT EXISTS cap_migrations (name TEXT PRIMARY KEY)');
 for(const [name,url] of [['001-spaces',new URL('../drizzle/0000_tricky_pretty_boy.sql',import.meta.url)],['002-auth',new URL('./migrations/001-auth.sql',import.meta.url)]]){
  if(db.prepare('SELECT name FROM cap_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN IMMEDIATE');try{db.exec(readFileSync(url,'utf8'));db.prepare('INSERT INTO cap_migrations(name) VALUES (?)').run(name);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 }
 return db;
}
export function asD1(db){return {prepare(sql){return {bind(...args){const stmt=db.prepare(sql);return {first:async()=>(await stmt.get(...args))||null,all:async()=>({results:await stmt.all(...args)}),run:async()=>stmt.run(...args)}}}}}}

export async function openDatabase(path,connectionString){
 if(connectionString){const {openPostgres}=await import('./postgres.js');return openPostgres(connectionString)}
 const db=openSQLite(path);
 return {kind:'sqlite',prepare:sql=>db.prepare(sql),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:async fn=>{
  db.exec('BEGIN IMMEDIATE');try{const result=await fn(db);db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}
 }};
}
