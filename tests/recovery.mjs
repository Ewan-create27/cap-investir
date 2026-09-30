import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'pari-email-')),pg=await PGlite.create(join(dir,'db'));
const socket=new PGLiteSocketServer({db:pg,host:'127.0.0.1',port:55442,maxConnections:10});await socket.start();
Object.assign(process.env,{DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:55442/postgres',CRON_SECRET:'test-cron-secret-at-least-thirty-two-characters',SESSION_SECRET:'test-session-secret-at-least-thirty-two-characters'});
const {initRuntime,closeRuntime}=await import('../dist-server/server/runtime.js');
const {passwordHash,session,actor}=await import('../dist-server/server/auth.js');
const recovery=await import('../dist-server/server/recovery.js');
let {DB}=await initRuntime();let cookie='',failMail=false;const mails=[];const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert(options.signal);assert(options.headers['Idempotency-Key']);assert.equal(options.headers.Authorization,'Bearer test-key-no-real-email');if(failMail)return new Response('{}',{status:503});const mail=JSON.parse(options.body);assert.deepEqual(Object.keys(mail).sort(),['from','subject','text','to']);mails.push({...mail,code:mail.text.match(/\n(\d{6})\n/)[1]});return Response.json({id:'test-message'});};
const req=()=>new Request('https://pari.test/api/recovery',{headers:{Cookie:cookie}});
async function post(body,status=200){const r=await recovery.POST(new Request('https://pari.test/api/recovery',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function age(){await DB.prepare('UPDATE email_challenges SET created=created-3600001').run();}
const password='personal-password-2026';
try{
 await DB.prepare("INSERT INTO groups VALUES('local','La bande')").run();
 for(const id of ['a','b']){await DB.prepare("INSERT INTO participants(id,group_id,name,avatar,color) VALUES(?,'local',?,'🙂','#ffe2d5')").bind(id,id).run();await DB.prepare('INSERT INTO accounts(id,person_id,username,salt,password_hash) VALUES(?,?,?,?,?)').bind(id,id,id+'lice','salt-'+id,await passwordHash(password,'salt-'+id)).run();}
 await post({action:'requestReset',email:'alice@example.com'},503);
 Object.assign(process.env,{RESEND_API_KEY:'test-key-no-real-email',EMAIL_FROM:'Pari <sender@example.com>'});
 assert.equal((await recovery.GET(req())).status,401);
 cookie='pari_session='+await session('a');const aliceCookie=cookie;
 await post({action:'requestVerification',email:'alice@example.com',currentPassword:'wrong'},400);
 let verify=await post({action:'requestVerification',email:'alice@example.com',currentPassword:password});const vc=mails.at(-1).code;
 assert.equal(mails.at(-1).to[0],'alice@example.com');assert(!JSON.stringify(verify).includes(vc));
 await post({action:'requestVerification',email:'alice@example.com',currentPassword:password},429);
 cookie='pari_session='+await session('b');const bobCookie=cookie;
 await post({action:'confirmVerification',challengeId:verify.challengeId,code:vc},400);
 cookie=aliceCookie;await post({action:'confirmVerification',challengeId:verify.challengeId,code:vc});await post({action:'confirmVerification',challengeId:verify.challengeId,code:vc},400);
 let status=await (await recovery.GET(req())).json();assert.equal(status.email_verified,true);assert.equal(status.email,'alice@example.com');
 cookie='';let reset=await post({action:'requestReset',email:'alice@example.com'});let rc=mails.at(-1).code;
 const unknown=await post({action:'requestReset',email:'unknown@example.com'});assert.equal(unknown.message,reset.message);assert.deepEqual(Object.keys(unknown).sort(),Object.keys(reset).sort());
 const count=mails.length;await post({action:'requestReset',email:'alice@example.com'});assert.equal(mails.length,count);
 for(let i=0;i<5;i++)await post({action:'resetPassword',challengeId:reset.challengeId,code:rc==='000000'?'000001':'000000',password:'replacement-password-2026'},400);
 await post({action:'resetPassword',challengeId:reset.challengeId,code:rc,password:'replacement-password-2026'},400);
 assert.equal((await DB.prepare('SELECT attempts FROM email_challenges WHERE id=?').bind(reset.challengeId).first()).attempts,5);
 await age();reset=await post({action:'requestReset',email:'alice@example.com'});rc=mails.at(-1).code;
 await DB.prepare('UPDATE email_challenges SET expires=? WHERE id=?').bind(Date.now()-1,reset.challengeId).run();await post({action:'resetPassword',challengeId:reset.challengeId,code:rc,password:'replacement-password-2026'},400);
 await age();reset=await post({action:'requestReset',email:'alice@example.com'});rc=mails.at(-1).code;
 // Restart with the same DB and session secret: an unexpired code still works.
 await closeRuntime();({DB}=await initRuntime());
 const responses=await Promise.all([1,2].map(()=>recovery.POST(new Request('https://pari.test/api/recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resetPassword',challengeId:reset.challengeId,code:rc,password:'replacement-password-2026'})}))));assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
 cookie=aliceCookie;assert.equal(await actor(req()),null);cookie='pari_session='+await session('a');
 const a=await DB.prepare("SELECT * FROM accounts WHERE id='a'").first();assert.equal(await passwordHash('replacement-password-2026',a.salt),a.password_hash);
 await age();const oldReset=await post({action:'requestReset',email:'alice@example.com'}),oldCode=mails.at(-1).code;
 verify=await post({action:'requestVerification',email:'new-alice@example.com',currentPassword:'replacement-password-2026'});const nextCode=mails.at(-1).code;
 assert.equal((await DB.prepare("SELECT email FROM accounts WHERE id='a'").first()).email,'alice@example.com');
 await post({action:'confirmVerification',challengeId:verify.challengeId,code:nextCode});
 await post({action:'resetPassword',challengeId:oldReset.challengeId,code:oldCode,password:'stolen-password-2026'},400);
 cookie=bobCookie;verify=await post({action:'requestVerification',email:'new-alice@example.com',currentPassword:password});await post({action:'confirmVerification',challengeId:verify.challengeId,code:mails.at(-1).code},400);
 // Failed deliveries do not reveal account existence or leave a valid code.
 await age();failMail=true;reset=await post({action:'requestReset',email:'new-alice@example.com'});assert.equal(reset.message,unknown.message);assert.equal((await DB.prepare('SELECT used FROM email_challenges WHERE id=?').bind(reset.challengeId).first()).used,true);failMail=false;
 // Five sends/hour even if the browser/IP changes.
 await age();for(let i=0;i<5;i++){await post({action:'requestReset',email:'new-alice@example.com'});await DB.prepare('UPDATE email_challenges SET created=created-61000 WHERE account_id=?').bind('a').run();}
 const before=mails.length;await post({action:'requestReset',email:'new-alice@example.com'});assert.equal(mails.length,before);
 const rows=(await DB.prepare('SELECT code_hash FROM email_challenges').all()).results;assert(rows.every(r=>r.code_hash.length===64));
 // The previously supplied full reset still works: account deletion cascades to recovery codes.
 await DB.prepare('DELETE FROM user_sessions').run();await DB.prepare('DELETE FROM accounts').run();assert.equal((await DB.prepare('SELECT count(*)::int n FROM email_challenges').first()).n,0);
 console.log('PASS: verified ownership, private status, generic reset responses, mocked Resend payload, cooldown/hourly limits, five attempts, expiry, single-use concurrency, restart persistence, password/session reset, email changes, delivery failures, reset compatibility.');
}finally{globalThis.fetch=originalFetch;await closeRuntime();await socket.stop();await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));await pg.close();rmSync(dir,{recursive:true,force:true});}
