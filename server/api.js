const json = (body, status=200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function database(env) { if(!env.DB) throw new Error('Database unavailable'); return env.DB; }
function validData(d) {
 return d && typeof d==='object' && !Array.isArray(d) && Array.isArray(d.goals) && d.goals.length<=500 && d.budget && Array.isArray(d.budget.entries) && d.budget.entries.length<=2000 && d.profile && typeof d.profile==='object' && Array.isArray(d.planDone) && Array.isArray(d.lessons) && Array.isArray(d.quizPassed);
}
function result(row) {return {id:row.id,name:row.name,data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at};}
export async function api(request, env, user) {
 const url=new URL(request.url), owner=user?.id;
 if(!owner) return json({error:'Connecte-toi pour accéder à tes espaces.'},401);
 if(!['GET','POST','PUT'].includes(request.method))return json({error:'Méthode non autorisée.'},405);
 if(request.method!=='GET' && (request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json')))return json({error:'Requête non autorisée.'},403);
 try {
  const db=database(env);
  if(url.pathname==='/api/account' && request.method==='GET') {
   const rows=await db.prepare('SELECT id,name,revision,updated_at FROM spaces WHERE owner = ? ORDER BY updated_at DESC,id').bind(owner).all();
   return json({user:{id:owner,name:user.name||'',email:user.email||''},spaces:rows.results});
  }
  const match=url.pathname.match(/^\/api\/spaces\/([a-zA-Z0-9-]{1,80})$/);
  if(match && request.method==='GET') {
   const row=await db.prepare('SELECT * FROM spaces WHERE id = ? AND owner = ?').bind(match[1],owner).first();
   return row?json(result(row)):json({error:'Espace introuvable.'},404);
  }
  if((url.pathname==='/api/spaces' && request.method==='POST') || (match && request.method==='PUT')) {
   const raw=await request.text();if(raw.length>1000000)return json({error:'Cet espace dépasse la taille autorisée.'},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:'Données invalides.'},400)}
   if(!validData(body.data))return json({error:'Format des données invalide.'},400);
   const data=JSON.stringify(body.data), now=new Date().toISOString();
   if(request.method==='POST') {
    if(typeof body.name!=='string' || !body.name.trim() || body.name.trim().length>60 || !/^[a-zA-Z0-9-]{1,80}$/.test(body.id||''))return json({error:'Indique un nom de 1 à 60 caractères.'},400);
    // Client-generated ID makes retrying a timed-out creation idempotent.
    await db.prepare('INSERT INTO spaces (id,owner,name,data,revision,updated_at) VALUES (?,?,?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(body.id,owner,body.name.trim(),data,now).run();
    const row=await db.prepare('SELECT * FROM spaces WHERE id = ? AND owner = ?').bind(body.id,owner).first();
    return row?json(result(row),201):json({error:'Identifiant indisponible.'},409);
   }
   if(!Number.isSafeInteger(body.revision)||body.revision<1)return json({error:'Version invalide.'},400);
   const updated=await db.prepare('UPDATE spaces SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner = ? AND revision = ? RETURNING revision,updated_at').bind(data,now,match[1],owner,body.revision).first();
   if(updated)return json({revision:updated.revision,updatedAt:updated.updated_at});
   const row=await db.prepare('SELECT * FROM spaces WHERE id = ? AND owner = ?').bind(match[1],owner).first();
   if(!row)return json({error:'Espace introuvable.'},404);
   if(row.data===data)return json({revision:row.revision,updatedAt:row.updated_at});
   return json({error:'Cet espace a changé sur un autre appareil.',current:result(row)},409);
  }
  return json({error:'Page introuvable.'},404);
 } catch(error) {console.error('Cap storage request failed',error instanceof Error?error.message:'unknown');return json({error:'Sauvegarde en ligne indisponible. Réessaie dans un instant.'},503);}
}
