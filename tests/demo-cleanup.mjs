import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=await PGlite.create();
try{
 await db.exec(readFileSync('migrations/0001_initial.sql','utf8'));
 await db.exec(`INSERT INTO groups VALUES('local','La bande');
 INSERT INTO participants(id,group_id,name,avatar,color,demo) VALUES
 ('eva','local','Eva','👩🏻','#ffe2d5',1),
 ('lucas','local','Lucas','🧑🏽','#e3eaff',1),
 ('lea','local','Personnalisée','👩🏼','#ffe9ac',1),
 ('real-person','local','Moi','😎','#ffe2d5',0);
 INSERT INTO bets(id,group_id,title,description,stake,created,demo,status) VALUES
 ('demo-active','local','Exemple','','{}','2026-01-01',1,'active'),
 ('demo-closed','local','Exemple fini','','{}','2026-01-01',1,'closed'),
 ('demo-archived','local','Exemple archivé','','{}','2026-01-01',1,'archived'),
 ('real-bet','local','Mon pari','','{}','2026-01-01',0,'active');
 INSERT INTO members VALUES ('demo-member','demo-active','eva','for'),('real-member','real-bet','lucas','for');
 INSERT INTO events VALUES ('demo-event','demo-active','2026-01-01','Exemple'),('real-event','real-bet','2026-01-01','Vrai événement');
 INSERT INTO reminders(id,bet_id,next,frequency,timezone,anchor) VALUES
 ('demo-reminder','demo-active','2030-01-01','once','UTC','2030-01-01'),
 ('real-reminder','real-bet','2030-01-01','once','UTC','2030-01-01');
 INSERT INTO deliveries VALUES ('demo-delivery','demo-reminder','device','2030-01-01','2030-01-01'),('real-delivery','real-reminder','device','2030-01-01','2030-01-01');`);
 const before={};for(const table of ['bets','members','events','reminders','deliveries'])before[table]=(await db.query(`SELECT * FROM ${table} WHERE id LIKE 'real-%'`)).rows;
 const sql=readFileSync('migrations/0002_remove_demo.sql','utf8');
 await db.exec('BEGIN;'+sql+'COMMIT;');await db.exec('BEGIN;'+sql+'COMMIT;');
 for(const table of Object.keys(before)){assert.deepEqual((await db.query(`SELECT * FROM ${table}`)).rows,before[table]);}
 assert.deepEqual((await db.query('SELECT id,demo FROM participants ORDER BY id')).rows,[{id:'lea',demo:0},{id:'lucas',demo:0},{id:'real-person',demo:0}]);
 console.log('PASS: demo removal (all statuses), real data unchanged, reused/customized profiles kept, cleanup repeatable.');
}finally{await db.close();}
