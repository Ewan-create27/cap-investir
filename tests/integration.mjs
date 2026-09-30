import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import pg from 'pg';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'pari-pg-'));
const database=await PGlite.create(join(dir,'postgres'));
const socket=new PGLiteSocketServer({db:database,host:'127.0.0.1',port:55439,maxConnections:10});await socket.start();
const databaseURL='postgresql://postgres:postgres@127.0.0.1:55439/postgres';
const sql=new pg.Pool({connectionString:databaseURL,max:1});
const port=3197,origin='http://127.0.0.1:'+port,cronSecret='test-cron-secret-at-least-thirty-two-characters';let child;
async function start(){child=spawn(process.execPath,['dist-server/server/index.js'],{env:{...process.env,DATABASE_URL:databaseURL,PORT:String(port),APP_URL:origin,ADMIN_PASSWORD:'test-password-only-2026',INVITE_CODE:'friends-invitation-2026',SESSION_SECRET:'test-secret-that-is-at-least-thirty-two-characters',CRON_SECRET:cronSecret,SEED_DEMO:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});let err='';child.stderr.on('data',c=>err+=c);for(let i=0;i<200;i++){try{const r=await fetch(origin+'/healthz');if(r.ok)return;}catch{}if(child.exitCode!==null)throw Error(err);await new Promise(r=>setTimeout(r,100));}throw Error('Server timeout '+err);}
async function stop(){await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
let cookie='';
async function api(path,method='GET',body){return fetch(origin+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function action(body){const r=await api('/api/data','POST',body);const data=await r.json();console.log('action',body.action,r.status);assert.equal(r.status,200,JSON.stringify(data));return data;}
async function tick(){const r=await fetch(origin+'/api/cron',{method:'POST',headers:{Authorization:'Bearer '+cronSecret}});assert.equal(r.status,200);return r.json();}
try{
 // Simulate an already deployed database before upgrading.
 await sql.query(readFileSync('migrations/0001_initial.sql','utf8'));
 await sql.query("CREATE TABLE _migrations(name text PRIMARY KEY,applied text NOT NULL); INSERT INTO _migrations VALUES('0001_initial.sql','2026-01-01'); INSERT INTO groups VALUES('local','La bande'); INSERT INTO participants(id,group_id,name,avatar,color) VALUES('legacy','local','Ancien ami','😎','#ffe2d5'); INSERT INTO bets(id,group_id,title,description,stake,created) VALUES('old-bet','local','Ancien pari conservé','','{\"type\":\"none\"}','2026-01-01'); INSERT INTO members(id,bet_id,person_id,side) VALUES('old-member','old-bet','legacy','for');");
 console.log('starting');await start();console.log('started');assert.equal((await api('/api/data')).status,401);
 async function register(username,claim=''){const r=await api('/api/accounts','POST',{action:'register',username,name:username,password:'my-personal-password-2026',avatar:'😎',invite:'friends-invitation-2026',claim});const d=await r.json();console.log('register',username,r.status);assert.equal(r.status,200,JSON.stringify(d));cookie=r.headers.get('set-cookie').split(';')[0];return {cookie,actor:(await (await api('/api/session')).json()).actor};}
 const alice=await register('alice'),bob=await register('bob'),cara=await register('cara');cookie=alice.cookie;
 let d=await (await api('/api/data')).json();assert.equal(d.people.length,4);assert.equal(d.bets.length,1);assert.equal(d.bets[0].phase,'locked');assert(!JSON.stringify(d).includes('password_hash'));
 assert.equal((await api('/api/session','POST',{username:'alice',password:'wrong'})).status,401);
 assert.equal((await api('/api/accounts','POST',{action:'register',username:'imposter',name:'Fake',password:'my-personal-password-2026',avatar:'😎',invite:'incorrect'})).status,400);
 const legacyList=await api('/api/accounts','POST',{action:'legacy',adminPassword:'test-password-only-2026'});assert.equal((await legacyList.json()).people[0].id,'legacy');
 const claim=await api('/api/accounts','POST',{action:'claimCode',personId:'legacy',adminPassword:'test-password-only-2026'});const code=(await claim.json()).code;assert(code);
 const old=await register('ancien',code);assert.equal(old.actor.person_id,'legacy');
 assert.equal((await api('/api/accounts','POST',{action:'register',username:'stolen',name:'Fake',password:'my-personal-password-2026',avatar:'😎',invite:'friends-invitation-2026',claim:code})).status,400);
 cookie=alice.cookie;
 const bet={title:'Pari ouvert et partagé',description:'Conditions conservées',icon:'✈️',stake:{type:'dare',text:'Les perdants offrent le dîner.'},members:[{personId:alice.actor.person_id,side:'for'}],reminders:[{next:'2035-01-01T00:00:00.000Z',frequency:'monthly',timezone:'Pacific/Noumea'}]};
 const created=await action({action:'create',bet});const id=created.id;
 async function current(){return (await (await api('/api/data')).json()).bets.find(b=>b.id===id);}
 async function rejected(body){const r=await api('/api/data','POST',body);assert.equal(r.status,400,JSON.stringify(await r.json()));}
 await rejected({action:'create',bet:{...bet,members:[...bet.members,{personId:bob.actor.person_id,side:'against'}]}});
 await rejected({action:'join',id,side:'against'});await rejected({action:'leave',id});assert.equal((await current()).members[0].side,'for');
 await rejected({action:'resolve',id,result:'for'});await rejected({action:'lock',id,revision:1});
 cookie=bob.cookie;await rejected({action:'archiveBet',id});await rejected({action:'person',id:alice.actor.person_id,person:{name:'Hacked',avatar:'😎',color:'#ffe2d5'}});await rejected({action:'accept',id,revision:1});
 await action({action:'join',id,side:'against'});let b=await current();assert.equal(b.members.length,2);assert.equal(b.acceptances.length,0);assert.equal(b.revision,2);
 await rejected({action:'join',id,side:'for'});await rejected({action:'leave',id});await action({action:'join',id,side:'against'});b=await current();assert.equal(b.revision,2);assert.equal(b.members.find(m=>m.personId===bob.actor.person_id).side,'against');
 await action({action:'propose',id,revision:2,stake:{type:'reward',text:'Alice offre une médaille aux gagnants.'}});b=await current();assert.equal(b.revision,3);assert.deepEqual(b.acceptances,[bob.actor.person_id]);
 cookie=alice.cookie;await rejected({action:'accept',id,revision:2});await action({action:'accept',id,revision:3});
 cookie=cara.cookie;await action({action:'join',id,side:'for'});b=await current();assert.equal(b.revision,4);assert.equal(b.acceptances.length,0);
 await action({action:'accept',id,revision:4});cookie=bob.cookie;await action({action:'accept',id,revision:4});
 cookie=alice.cookie;await action({action:'reject',id,revision:4});b=await current();assert(b.refusals.includes(alice.actor.person_id));assert(!b.acceptances.includes(alice.actor.person_id));assert.equal(b.members.find(m=>m.personId===alice.actor.person_id).side,'for');await rejected({action:'lock',id,revision:4});await rejected({action:'reject',id,revision:3});await action({action:'accept',id,revision:4});b=await current();assert(!b.refusals.includes(alice.actor.person_id));assert(b.acceptances.includes(alice.actor.person_id));
 // Launch locks roster and terms only after unanimous consent.
 const joined=await api('/api/data','POST',{action:'lock',id,revision:4});assert.equal(joined.status,200);
 cookie=cara.cookie;await rejected({action:'reject',id,revision:4});await rejected({action:'join',id,side:'against'});await rejected({action:'leave',id});await rejected({action:'propose',id,revision:4,stake:{type:'none'}});await rejected({action:'resolve',id,result:'against'});
 cookie=alice.cookie;await action({action:'archiveBet',id});b=await current();assert.equal(b.status,'archived');assert.equal(b.reminders[0].active,0);await rejected({action:'deleteBet',id});await action({action:'restoreBet',id});
 const image=readFileSync('tests/avatar.jpg');const uploaded=await fetch(origin+'/api/avatar',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'image/jpeg'},body:image});assert.equal(uploaded.status,200);const avatar=(await uploaded.json()).avatar;
 await action({action:'person',id:alice.actor.person_id,person:{name:'Alice',avatar,color:'#ffe2d5'}});assert.equal((await fetch(origin+avatar)).status,401);
 assert.equal((await fetch(origin+'/api/data',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await api('/api/cron','POST',{})).status,401);console.log('restart');const before=(await (await api('/api/data')).json()).publicKey;await stop();await start();d=await (await api('/api/data')).json();assert.equal(d.publicKey,before);assert.equal(d.people.length,4);assert.equal((await current()).members.length,3);assert.deepEqual(Buffer.from(await (await api(avatar)).arrayBuffer()),image);
 await action({action:'reminders',id,reminders:bet.reminders});await sql.query("UPDATE reminders SET next='2020-01-01T00:00:00.000Z' WHERE bet_id=$1 AND active=1",[id]);assert.equal((await tick()).processed,1);assert.equal((await tick()).processed,0);
 await action({action:'resolve',id,result:'for',comment:'Terminé avec succès.'});await rejected({action:'resolve',id,result:'against'});b=await current();assert.equal(b.status,'closed');assert.equal(b.result,'for');assert(b.reminders.every(r=>!r.active));assert.equal(b.stake.type,'reward');assert.equal(b.proposals.length,4);
 const cancelled=await action({action:'create',bet:{...bet,title:'Pari annulé à conserver',reminders:[]}});await action({action:'resolve',id:cancelled.id,result:'cancelled'});
 await rejected({action:'archiveBet',id:'old-bet'});await action({action:'archiveBet',id:'old-bet',adminPassword:'test-password-only-2026'});
 // Competing proposals based on the same revision: exactly one wins.
 const race=(await action({action:'create',bet:{...bet,title:'Propositions concurrentes',reminders:[]}})).id;
 const competing=await Promise.all([api('/api/data','POST',{action:'propose',id:race,revision:1,stake:{type:'none'}}),api('/api/data','POST',{action:'propose',id:race,revision:1,stake:{type:'reward',text:'Un trophée'}})]);assert.deepEqual(competing.map(r=>r.status).sort(),[200,400]);
 // Personal passwords are salted hashes, sessions never store their raw cookie.
 const hashes=await sql.query('SELECT password_hash,salt FROM accounts');assert(hashes.rows.every(r=>r.password_hash.length===128));assert.equal(new Set(hashes.rows.map(r=>r.salt)).size,4);
 const changed=await api('/api/accounts','POST',{action:'password',currentPassword:'my-personal-password-2026',password:'a-new-personal-password-2026'});assert.equal(changed.status,200);assert.equal((await api('/api/data')).status,401);
 const login=await api('/api/session','POST',{username:'alice',password:'a-new-personal-password-2026'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];await api('/api/session','DELETE');assert.equal((await api('/api/data')).status,401);
 console.log('PASS: legacy migration and one-use claims, personal auth, password change/session revocation, ownership guards, solo creation, immutable camps and no leave/rejoin bypass, explicit refusal blocking launch, voluntary three-person camps, unanimous revisioned consent, concurrent proposals, locked terms, archive-only, photos, persistence, external cron, resolution and cancellation.');
}catch(e){console.error(e);throw e;}finally{if(child&&child.exitCode===null)await stop();await sql.end();await socket.stop();
 // Socket close handlers defer their PostgreSQL cleanup to the next event-loop turn.
 await new Promise(resolve=>setImmediate(resolve));
 await new Promise(resolve=>setImmediate(resolve));
 await database.close();rmSync(dir,{recursive:true,force:true});}
