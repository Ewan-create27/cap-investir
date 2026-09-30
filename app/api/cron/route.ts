import {timingSafeEqual} from 'node:crypto';
import {db,config,uid,now} from '@/lib/store';
import {sendPush} from '@/lib/push';
import {nextOccurrence} from '@/lib/schedule';
let running=false;
export async function POST(req:Request){
 const c=config();const supplied=Buffer.from(req.headers.get('authorization')||'');const expected=Buffer.from(`Bearer ${c.CRON_SECRET}`);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return new Response('Unauthorized',{status:401});
 if(running)return Response.json({ok:true,busy:true,processed:0});
 running=true;
 try{
  const d=db(),at=now(),started=Date.now();
  const due=await d.prepare("SELECT r.*,b.title FROM reminders r JOIN bets b ON b.id=r.bet_id WHERE r.active=1 AND r.next<=? AND b.status='active' AND b.demo=0 AND (r.lease IS NULL OR r.lease<?) ORDER BY r.next LIMIT 30").bind(at,at).all();
  const subscriptions=await d.prepare('SELECT * FROM subscriptions WHERE person_id IS NOT NULL').all();
  let sent=0,processed=0,retryPending=0;
  for(const r of due.results){
   if(Date.now()-started>30000)break;
   const lease=new Date(Date.now()+300000).toISOString();
   const claimed=await d.prepare('UPDATE reminders SET lease=? WHERE id=? AND active=1 AND (lease IS NULL OR lease<?)').bind(lease,r.id,at).run();
   if(!claimed.meta.changes)continue;
   let failed=false;
   for(const sub of subscriptions.results){
    if(!await d.prepare('SELECT id FROM members WHERE bet_id=? AND person_id=?').bind(r.bet_id,sub.person_id).first())continue;
    if(Date.now()-started>30000){failed=true;break;}
    const active=await d.prepare("SELECT r.id FROM reminders r JOIN bets b ON b.id=r.bet_id WHERE r.id=? AND r.active=1 AND b.status='active'").bind(r.id).first();
    if(!active)break;
    const did=r.id+':'+r.next+':'+sub.id;
    if(await d.prepare('SELECT id FROM deliveries WHERE id=?').bind(did).first())continue;
    try{
     const res=await sendPush(JSON.parse(sub.data),{title:'Alors, on en est où ? 👀',body:r.title,url:'/?bet='+r.bet_id,tag:did},c.VAPID_PUBLIC_KEY,c.VAPID_PRIVATE_KEY);
     if(res.status===404||res.status===410){await d.prepare('DELETE FROM subscriptions WHERE id=?').bind(sub.id).run();continue;}
     if(!res.ok)throw Error('Push refusé');
     await d.prepare('INSERT OR IGNORE INTO deliveries(id,reminder_id,subscription_id,occurrence,sent) VALUES(?,?,?,?,?)').bind(did,r.id,sub.id,r.next,now()).run();sent++;
    }catch{console.error('Échec temporaire de livraison push ; nouvel essai lors d’une prochaine vérification.');failed=true;}
   }
   if(failed){await d.prepare('UPDATE reminders SET attempts=attempts+1,lease=? WHERE id=? AND active=1').bind(new Date(Date.now()+60000).toISOString(),r.id).run();retryPending++;continue;}
   const next=nextOccurrence(r,new Date());
   await d.batch([
    d.prepare("INSERT INTO events(id,bet_id,at,text) SELECT ?,bet_id,?,? FROM reminders WHERE id=? AND active=1 AND EXISTS(SELECT 1 FROM bets WHERE bets.id=reminders.bet_id AND status='active')").bind(uid(),now(),subscriptions.results.length?'Rappel traité par le serveur':'Rappel arrivé à échéance (aucun appareil abonné)',r.id),
    d.prepare("UPDATE reminders SET next=?,active=?,lease=NULL,attempts=0 WHERE id=? AND active=1 AND EXISTS(SELECT 1 FROM bets WHERE bets.id=reminders.bet_id AND status='active')").bind(next||r.next,next?1:0,r.id)
   ]);processed++;
  }
  await d.prepare("INSERT INTO settings(key,value) VALUES('scheduler_heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(now()).run();
  return Response.json({ok:true,sent,processed,retryPending});
 }catch{console.error('Traitement des rappels indisponible.');return Response.json({error:'Réessayez lors de la prochaine vérification.'},{status:503});}
 finally{running=false;}
}
