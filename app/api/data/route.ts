import {actor,secretEqual} from '../../../server/auth';
import {z} from 'zod';
import {db,uid,now,readData,sameOrigin,config} from '@/lib/store';
import {betIcons,emojis} from '@/lib/model';
const avatarPath=/^\/api\/avatar\?key=[0-9a-f-]{36}$/;
const person=z.object({name:z.string().trim().min(1).max(40),avatar:z.string().max(100).refine(v=>emojis.includes(v)||avatarPath.test(v),'Choisissez un avatar ou importez une photo.'),color:z.string().regex(/^#[0-9a-f]{6}$/i)});
const reminder=z.object({next:z.string().datetime(),frequency:z.enum(['once','daily','weekly','monthly','yearly']),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}})});
const reminders=z.array(reminder).max(20).refine(r=>r.every(x=>Date.parse(x.next)>Date.now()),'Choisissez des dates de rappel futures.');
const bet=z.object({icon:z.string().refine(v=>betIcons.includes(v)).default('🤞'),title:z.string().trim().min(5).max(180),description:z.string().max(3000).default(''),deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),members:z.array(z.object({personId:z.string(),side:z.enum(['for','against'])})).min(1).max(100),stake:z.discriminatedUnion('type',[z.object({type:z.literal('none')}),z.object({type:z.literal('money'),amount:z.number().positive().max(1e12),currency:z.enum(['EUR','XPF','USD'])}),z.object({type:z.literal('dare'),text:z.string().trim().min(1).max(500)}),z.object({type:z.literal('reward'),text:z.string().trim().min(1).max(500)}),z.object({type:z.literal('other'),text:z.string().trim().min(1).max(500)})]),reminders});
export async function GET(req:Request){const a=await actor(req);if(!a)return Response.json({error:'Connexion requise.'},{status:401});return Response.json({...await readData(),actor:a});}
export async function POST(req:Request){try{sameOrigin(req);const a=await actor(req);if(!a)return Response.json({error:'Connexion requise.'},{status:401});const body=z.object({action:z.string(),id:z.string().optional()}).passthrough().parse(await req.json());const id=body.id||uid(),at=now();
if(body.action==='person'){const p=person.parse(body.person);if(avatarPath.test(p.avatar)&&!await config().BUCKET.head('avatars/'+p.avatar.split('key=')[1]))throw Error('Photo introuvable.');}
await db().transaction(async(d:any)=>{
 const event=async(text:string)=>d.prepare('INSERT INTO events(id,bet_id,at,text) VALUES(?,?,?,?)').bind(uid(),id,at,text).run();
 const who=await d.prepare('SELECT name FROM participants WHERE id=?').bind(a.person_id).first();
 if(body.action==='person'){if(body.id!==a.person_id)throw Error('Tu peux modifier uniquement ton personnage.');const p=person.parse(body.person);await d.prepare('UPDATE participants SET name=?,avatar=?,color=? WHERE id=?').bind(p.name,p.avatar,p.color,a.person_id).run();return;}
 if(body.action==='create'){const b=bet.parse(body.bet);if(b.members.length!==1||b.members[0].personId!==a.person_id)throw Error('Choisis ton propre camp. Tes amis rejoindront librement le pari.');await d.prepare("INSERT INTO bets(id,group_id,title,description,deadline,stake,created,icon,creator_id,phase,revision) VALUES(?,'local',?,?,?,?,?,?,?,'open',1)").bind(id,b.title,b.description,b.deadline||null,JSON.stringify(b.stake),at,b.icon,a.person_id).run();await d.prepare('INSERT INTO members(id,bet_id,person_id,side) VALUES(?,?,?,?)').bind(uid(),id,a.person_id,b.members[0].side).run();await d.prepare('INSERT INTO proposals(id,bet_id,revision,person_id,stake,created) VALUES(?,?,1,?,?,?)').bind(uid(),id,a.person_id,JSON.stringify(b.stake),at).run();await d.prepare('INSERT INTO acceptances(bet_id,person_id,revision) VALUES(?,?,1)').bind(id,a.person_id).run();for(const r of b.reminders)await d.prepare('INSERT INTO reminders(id,bet_id,next,frequency,timezone,anchor) VALUES(?,?,?,?,?,?)').bind(uid(),id,r.next,r.frequency,r.timezone,r.next).run();await event(who.name+' a ouvert le pari');return;}
 const b=await d.prepare('SELECT * FROM bets WHERE id=?').bind(id).first();if(!b)throw Error('Pari introuvable.');
 const members=(await d.prepare('SELECT person_id,side FROM members WHERE bet_id=?').bind(id).all()).results;
 const mine=members.find((m:any)=>m.person_id===a.person_id);
 const manager=b.creator_id===a.person_id||(!b.creator_id&&secretEqual(body.adminPassword,process.env.ADMIN_PASSWORD!));
 if(['join','leave','propose','accept','withdraw','reject','lock'].includes(body.action)){
 if(b.status!=='active'||b.phase!=='open')throw Error('Ce pari n’est plus ouvert aux changements.');
 if(['join','propose','lock'].includes(body.action)&&b.deadline&&b.deadline<at.slice(0,10))throw Error('La date limite est dépassée.');
 if(body.action==='leave')throw Error('Ton camp est définitif. Tu peux refuser l’enjeu ou proposer autre chose, sans quitter le pari.');
 if(body.action==='join'){
 const side=z.enum(['for','against']).parse(body.side);
 if(mine){if(mine.side===side)return;throw Error('Ton camp est définitif : tu ne peux plus passer de Pour à Contre, ni l’inverse.');}
 if(members.length>=100)throw Error('Le pari est complet.');
 await d.prepare('INSERT INTO members(id,bet_id,person_id,side) VALUES(?,?,?,?)').bind(uid(),id,a.person_id,side).run();
 await d.prepare('UPDATE bets SET revision=revision+1 WHERE id=?').bind(id).run();
 await d.prepare('INSERT INTO proposals(id,bet_id,revision,person_id,stake,created) VALUES(?,?,?,?,?,?)').bind(uid(),id,b.revision+1,a.person_id,b.stake,at).run();
 await d.prepare('DELETE FROM acceptances WHERE bet_id=?').bind(id).run();
 await event(who.name+' a rejoint définitivement le camp '+(side==='for'?'Pour':'Contre')+' · accords sur l’enjeu à renouveler');return;
 }
 if(!mine)throw Error('Rejoins un camp pour proposer ou accepter un enjeu.');
 if(body.revision!==b.revision)throw Error('Le pari a changé. Actualise son détail avant de confirmer.');
 if(body.action==='propose'){const stake=bet.shape.stake.parse(body.stake);await d.prepare('UPDATE bets SET stake=?,revision=revision+1 WHERE id=?').bind(JSON.stringify(stake),id).run();await d.prepare('INSERT INTO proposals(id,bet_id,revision,person_id,stake,created) VALUES(?,?,?,?,?,?)').bind(uid(),id,b.revision+1,a.person_id,JSON.stringify(stake),at).run();await d.prepare('DELETE FROM acceptances WHERE bet_id=?').bind(id).run();await d.prepare('INSERT INTO acceptances(bet_id,person_id,revision) VALUES(?,?,?)').bind(id,a.person_id,b.revision+1).run();await event(who.name+' a proposé un nouvel enjeu · accords à renouveler');return;}
 if(body.action==='accept'){await d.prepare('INSERT INTO acceptances(bet_id,person_id,revision) VALUES(?,?,?) ON CONFLICT(bet_id,person_id) DO UPDATE SET revision=EXCLUDED.revision,accepted=true').bind(id,a.person_id,b.revision).run();await event(who.name+' accepte la proposition '+b.revision);return;}
 if(body.action==='reject'){await d.prepare('INSERT INTO acceptances(bet_id,person_id,revision,accepted) VALUES(?,?,?,false) ON CONFLICT(bet_id,person_id) DO UPDATE SET revision=EXCLUDED.revision,accepted=false').bind(id,a.person_id,b.revision).run();await event(who.name+' refuse l’enjeu proposé · camp inchangé');return;}
 if(body.action==='withdraw'){await d.prepare('DELETE FROM acceptances WHERE bet_id=? AND person_id=?').bind(id,a.person_id).run();await event(who.name+' a retiré son accord');return;}
 if(!manager)throw Error('Seul le créateur peut lancer le pari.');const accepts=(await d.prepare('SELECT person_id FROM acceptances WHERE bet_id=? AND revision=? AND accepted=true').bind(id,b.revision).all()).results;
 if(!members.some((m:any)=>m.side==='for')||!members.some((m:any)=>m.side==='against')||!members.every((m:any)=>accepts.some((x:any)=>x.person_id===m.person_id)))throw Error('Il faut les deux camps et l’accord de chaque participant.');await d.prepare("UPDATE bets SET phase='locked' WHERE id=?").bind(id).run();await event('Pari lancé · participants et enjeu acceptés par tous');return;
 }
 if(!manager)throw Error(b.creator_id?'Seul le créateur peut gérer ce pari.':'Ce pari ancien nécessite le mot de passe administrateur.');
 if(body.action==='restoreBet'){if(b.status!=='archived')throw Error('Ce pari n’est pas archivé.');await d.prepare("UPDATE bets SET status='active',archived_at=NULL WHERE id=?").bind(id).run();await event('Pari remis en jeu · rappels à reprogrammer');return;}
 if(b.status!=='active')throw Error('Ce pari n’est plus en cours.');
 if(body.action==='archiveBet'){await d.prepare("UPDATE bets SET status='archived',archived_at=? WHERE id=?").bind(at,id).run();await event('Pari archivé · rappels arrêtés');}
 else if(body.action==='resolve'){const result=z.enum(['for','against','cancelled','undetermined']).parse(body.result);if(b.phase!=='locked'&&['for','against'].includes(result))throw Error('Un pari ouvert doit être accepté et lancé avant de désigner des gagnants.');await d.prepare("UPDATE bets SET status='closed',result=?,comment=?,closed=? WHERE id=?").bind(result,z.string().max(3000).parse(body.comment||''),at,id).run();await event(result==='for'?'Le camp Pour a gagné':result==='against'?'Le camp Contre a gagné':result==='cancelled'?'Pari annulé':'Résultat indéterminé');}
 else if(body.action==='reminders'){const rows=reminders.parse(body.reminders);await d.prepare('UPDATE reminders SET active=0,lease=NULL WHERE bet_id=?').bind(id).run();for(const r of rows)await d.prepare('INSERT INTO reminders(id,bet_id,next,frequency,timezone,anchor) VALUES(?,?,?,?,?,?)').bind(uid(),id,r.next,r.frequency,r.timezone,r.next).run();await event('Rappels modifiés');return;}
 else throw Error('Action inconnue.');
 await d.prepare('UPDATE reminders SET active=0,lease=NULL WHERE bet_id=?').bind(id).run();
});return Response.json({ok:true,id});
}catch(e){return Response.json({error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'Enregistrement impossible.'},{status:400});}}
