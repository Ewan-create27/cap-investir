import {runtime} from '../server/runtime';
export const config=()=>runtime();
export const db=()=>{const d=config().DB;if(!d)throw Error('Base de données indisponible');return d;};
export const uid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export function sameOrigin(r:Request){const origin=r.headers.get('origin');if(origin && origin!==new URL(r.url).origin)throw Error('Origine non autorisée');}
// Initialize an empty private group. Never insert fictional records, even if an
// older deployment still has SEED_DEMO=true in its environment.
export async function seed(){await db().prepare("INSERT OR IGNORE INTO groups(id,name) VALUES('local','La bande')").run();}
export async function readData(){await seed();const d=db();const [p,b,m,r,e,pr,ac]=await Promise.all(['participants','bets','members','reminders','events','proposals','acceptances'].map(t=>d.prepare(`SELECT * FROM ${t}`).all()));const heartbeat=await d.prepare("SELECT value FROM settings WHERE key='scheduler_heartbeat'").first();return {people:p.results,bets:b.results.map((b:any)=>({...b,proposals:pr.results.filter((x:any)=>x.bet_id===b.id).map((x:any)=>({...x,stake:JSON.parse(x.stake)})).sort((a:any,b:any)=>b.revision-a.revision),refusals:ac.results.filter((x:any)=>x.bet_id===b.id&&x.revision===b.revision&&!x.accepted).map((x:any)=>x.person_id),acceptances:ac.results.filter((x:any)=>x.bet_id===b.id&&x.revision===b.revision&&x.accepted).map((x:any)=>x.person_id),stake:JSON.parse(b.stake),members:m.results.filter((m:any)=>m.bet_id===b.id).map((m:any)=>({personId:m.person_id,side:m.side})),reminders:r.results.filter((r:any)=>r.bet_id===b.id),events:e.results.filter((e:any)=>e.bet_id===b.id).sort((a:any,b:any)=>b.at.localeCompare(a.at))})),pushConfigured:!!(config().VAPID_PUBLIC_KEY&&config().VAPID_PRIVATE_KEY),schedulerActive:!!heartbeat&&Date.now()-Date.parse(heartbeat.value)<5400000,publicKey:config().VAPID_PUBLIC_KEY||null};}
