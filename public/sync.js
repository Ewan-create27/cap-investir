// The server is authoritative. Browser storage is read only for legacy import
// and remembers the last selected space (not its financial data).
const cloud={mode:"cap",ready:false,user:null,spaces:[],space:null,revision:0,pending:null,running:null,error:'',conflict:null,generation:0,busy:false,createId:null};
async function cloudRequest(path, options={}) {
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
 let body;try{body=await response.json()}catch{throw new Error('La sauvegarde en ligne nécessite la version hébergée de Cap.')}
 if(!response.ok){const error=new Error(body.error||'Connexion indisponible.');error.status=response.status;error.current=body.current;throw error;}
 return body;
}
function blankState(){return {...structuredClone(INITIAL_STATE),goals:[],activeGoalId:null,capital:0,monthly:0,target:0,done:[],planDone:[],lessons:[],quizPassed:[],budget:{entries:[]}};}
function normalizedState(data){
 const s={...blankState(),...data,profile:{...INITIAL_STATE.profile,...data.profile}};
 s.budget=Array.isArray(s.budget?.entries)?s.budget:{entries:[]};
 if(!Array.isArray(data.goals)){s.goals=[{id:'initial-goal',name:'Mon premier objectif',type:'wealth',...Object.fromEntries(goalKeys.map(k=>[k,s[k]]))}];s.activeGoalId='initial-goal'}
 for(const g of s.goals){g.startDateConfirmed=typeof g.startDateConfirmed==='boolean'?g.startDateConfirmed:Boolean(g.startDate);g.startDate=g.startDate||todayISO();g.initialCapital=Number.isFinite(g.initialCapital)?g.initialCapital:g.capital;g.records=Array.isArray(g.records)?g.records:[];g.capital=latestObservation(g).value;}
 if(!s.goals.some(g=>g.id===s.activeGoalId))s.activeGoalId=s.goals[0]?.id||null;
 s.planDone=Array.isArray(data.planDone)?data.planDone:(data.done||[]).map(id=>legacyPlanMap[id]).filter(Boolean);
 s.quizPassed=Array.isArray(data.quizPassed)?data.quizPassed:[];
 return s;
}
function legacyData(){try{const data=JSON.parse(localStorage.getItem('cap-v1'));return data&&typeof data==='object'?normalizedState(data):null}catch{return null}}
function selectionKey(){return 'cap-selected-space:'+cloud.user.id}
function rememberSpace(){try{localStorage.setItem(selectionKey(),cloud.space.id)}catch{}}
function applySpace(row){state=normalizedState(row.data);loadActiveGoal();cloud.space={id:row.id,name:row.name};cloud.revision=row.revision;cloud.ready=true;cloud.error='';cloud.conflict=null;cloud.generation++;rememberSpace();render();}
function accountChrome(){
 document.body.dataset.signedOut=String(!cloud.ready);
 document.querySelectorAll('[data-account-name]').forEach(el=>el.textContent=cloud.space?.name||'Mon compte');
 document.querySelectorAll('[data-account-initial]').forEach(el=>el.textContent=(cloud.space?.name||cloud.user?.name||'C').slice(0,1).toUpperCase());
 const status=document.querySelector('#sync-status');if(status){status.textContent=cloud.conflict?'Conflit à résoudre':cloud.error?'Non synchronisé':cloud.pending||cloud.running?'Enregistrement…':cloud.ready?'Sauvegardé en ligne':'Connexion…';status.dataset.warning=String(Boolean(cloud.error||cloud.conflict));}
 document.querySelector('#currency-select').disabled=!cloud.ready||cloud.busy;
 const banner=document.querySelector('#sync-alert');if(banner){banner.hidden=!(cloud.error||cloud.conflict);banner.innerHTML=cloud.conflict?'<span>Une modification existe sur un autre appareil. Tes changements sont conservés ici.</span><button class="light" data-cloud-action="resolve">Comparer les versions</button>':cloud.error?`<span>${escapeHTML(cloud.error)} Tes dernières modifications ne sont pas encore sauvegardées.</span><button class="light" data-cloud-action="retry">Réessayer</button>`:'';}
}
function cloudLanding(){if(cloud.mode==='cap'&&!cloud.user)return authScreen();return `<section class="card cloud-welcome"><span class="brandmark">↗</span><h1>${cloud.user?'Ton espace, partout avec toi':'Retrouve ton espace Cap'}</h1>${cloud.user&&cloud.spaces.length?'<p>Impossible de charger ton espace pour le moment.</p><button class="btn" data-account-menu>Choisir un espace</button><button class="light" data-cloud-action="retry">Réessayer</button>':cloud.user?'<p>Crée un espace pour commencer, ou retrouve les données de ce navigateur.</p><button class="btn" data-cloud-action="create">＋ Créer un espace utilisateur</button>':cloud.error?`<p>${escapeHTML(cloud.error)}</p><a class="btn" href="/signin-with-chatgpt?return_to=%2F" target="_top">Se connecter avec ChatGPT</a><button class="light" data-cloud-action="retry">Réessayer</button>`:'<p role="status">Chargement de tes espaces sécurisés…</p>'}</section>`;}
async function startCloud(){
 if(cloud.busy)return;cloud.busy=true;cloud.error='';accountChrome();
 try{
  const runtime=await cloudRequest('/api/runtime');cloud.mode=runtime.auth;const account=await cloudRequest('/api/account');cloud.user=account.user;cloud.spaces=account.spaces;
  if(cloud.spaces.length){let saved;try{saved=localStorage.getItem(selectionKey())}catch{}const id=cloud.spaces.find(s=>s.id===saved)?.id||cloud.spaces[0].id;applySpace(await cloudRequest('/api/spaces/'+id));}
  else{cloud.ready=false;render();}
 }catch(error){cloud.error=error.status===401?'':error.message;render();}
 finally{cloud.busy=false;accountChrome();}
}
function queueCloudSave(){if(!cloud.ready)return;cloud.pending=JSON.stringify(state);cloud.generation++;accountChrome();void flushCloud();}
async function flushCloud(){
 if(cloud.running)return cloud.running;
 if(cloud.conflict)return false;
 cloud.running=(async()=>{
  while(cloud.pending){
   const snapshot=cloud.pending;
   try{const response=await cloudRequest('/api/spaces/'+cloud.space.id,{method:'PUT',body:JSON.stringify({revision:cloud.revision,data:JSON.parse(snapshot)})});cloud.revision=response.revision;cloud.error='';if(cloud.pending===snapshot)cloud.pending=null;}
   catch(error){cloud.error=error.message;if(error.status===409)cloud.conflict=error.current;accountChrome();return false;}
  }return true;
 })();accountChrome();
 try{return await cloud.running}finally{cloud.running=null;accountChrome()}
}
async function chooseSpace(id){
 if(cloud.busy)return;
 if(cloud.pending&&!await flushCloud()){toast('Sauvegarde ou résous le conflit avant de changer d’espace.');return;}
 cloud.busy=true;cloud.generation++;accountChrome();
 try{const row=await cloudRequest('/api/spaces/'+id);document.querySelector('#modal').close();applySpace(row)}catch(error){toast(error.message)}finally{cloud.busy=false;accountChrome()}
}
async function showAccount(){
 if(cloud.user){try{const a=await cloudRequest("/api/account");if(a.user.id!==cloud.user.id){if(cloud.pending){toast('Le compte a changé dans un autre onglet. Exporte tes changements avant de recharger.');return;}resetCloudSession();await startCloud();}cloud.spaces=a.spaces;}catch(error){toast(error.message)}}
 if(!cloud.user){modal(cloudLanding());return;}
 modal(`<span class="tiny-label">MON COMPTE</span><h2 class="modal-title">Mes espaces utilisateurs</h2><p class="modal-text">${escapeHTML(cloud.user.email||cloud.user.name)}<br>${cloud.mode==='cap'?'Ces espaces appartiennent à ton compte Cap. Connecte-toi avec ton e-mail et ton mot de passe sur tes autres appareils.':'Ancien espace lié à ChatGPT. Exporte tes données pour les importer dans la version autonome de Cap.'}</p><div class="account-spaces">${cloud.spaces.map(space=>`<button class="space-choice ${space.id===cloud.space?.id?'selected':''}" data-space-id="${escapeHTML(space.id)}"><span class="avatar">${escapeHTML(space.name.slice(0,1).toUpperCase())}</span><span><b>${escapeHTML(space.name)}</b><small>${space.id===cloud.space?.id?'Espace actif':'Ouvrir cet espace'}</small></span><span>${space.id===cloud.space?.id?'✓':'→'}</span></button>`).join('')}</div><button class="btn account-create" data-cloud-action="create">＋ Créer un espace utilisateur</button>${legacyData()?'<button class="light account-create" data-cloud-action="import">Récupérer les données de ce navigateur</button>':''}${cloud.space?'<button class="light account-create" data-export-space>Exporter cet espace</button>':''}<button class="light account-create" data-import-file>Importer un fichier Cap</button><button class="textbutton account-create" data-cloud-action="signout">Se déconnecter / changer de compte</button>`);
}
function createSpaceForm(importing=false){
 cloud.createId=crypto.randomUUID();
 modal(`<span class="tiny-label">${importing?'REPRENDRE MON PARCOURS':'NOUVEL UTILISATEUR'}</span><h2 class="modal-title">${importing?'Récupérer mes données':'Créer un espace dédié'}</h2><p class="modal-text">${importing?'Les objectifs, le budget et la progression de ce navigateur seront copiés dans un nouvel espace en ligne, sans remplacer un espace existant.':'Un espace vide avec ses propres objectifs, son budget et son parcours. Il sera accessible sur tous tes appareils avec le même compte.'}</p><form id="cloud-create-form" data-import="${importing}"><label class="cloud-name">Nom de l’utilisateur ou de l’espace<input name="name" maxlength="60" autocomplete="off" required placeholder="Ex. Ewan, Camille…"></label><p role="alert" id="cloud-form-error"></p><button class="btn" type="submit">${importing?'Importer et sauvegarder en ligne':'Créer mon espace'}</button></form>`);
}
async function createCloudSpace(form){
 if(cloud.busy)return;
 if(cloud.pending&&!await flushCloud()){toast('Sauvegarde l’espace actuel avant de continuer.');return;}
 const name=form.elements.name.value.trim();if(!name)return;
 const data=form.dataset.import==='true'?legacyData():blankState();if(!data){toast('Aucune donnée locale à importer.');return;}
 cloud.busy=true;form.querySelector('button').disabled=true;
 try{const row=await cloudRequest('/api/spaces',{method:'POST',body:JSON.stringify({id:cloud.createId,name,data})});cloud.spaces.push({id:row.id,name:row.name});document.querySelector('#modal').close();applySpace(row);toast('Espace créé et sauvegardé en ligne.');}
 catch(error){form.querySelector('#cloud-form-error').textContent=error.message}
 finally{cloud.busy=false;form.querySelector('button').disabled=false;accountChrome()}
}
function resolveConflict(){
 const remote=cloud.conflict;if(!remote)return;
 modal(`<h2 class="modal-title">Deux versions de ton espace</h2><p class="modal-text">Un autre appareil a enregistré des changements pendant ta saisie. Choisis la version à conserver. La version remplacée ne sera pas fusionnée automatiquement.</p><div class="cloud-conflict"><div><b>Sur cet appareil</b><p>${state.goals.length} objectifs · ${state.budget.entries.length} postes de budget</p><button class="light" data-cloud-action="backup">Télécharger cette version</button></div><div><b>En ligne</b><p>${remote.data.goals.length} objectifs · ${remote.data.budget.entries.length} postes de budget</p><small>${escapeHTML(new Date(remote.updatedAt).toLocaleString('fr-FR'))}</small></div></div><div class="form-actions"><button class="light" data-cloud-action="remote">Conserver la version en ligne</button><button class="btn" data-cloud-action="local">Remplacer par cette version</button></div>`);
}
async function refreshCloud(){
 if(!cloud.ready||cloud.busy||cloud.running||cloud.pending||document.hidden||document.querySelector('#modal').open||document.activeElement?.matches('input,select,textarea'))return;
 const generation=cloud.generation,id=cloud.space.id;
 try{const row=await cloudRequest('/api/spaces/'+id);if(generation!==cloud.generation||cloud.pending||cloud.busy||cloud.space?.id!==id||document.querySelector('#modal').open||document.activeElement?.matches('input,select,textarea'))return;if(row.revision!==cloud.revision)applySpace(row);else{cloud.error='';accountChrome()}}
 catch(error){if(error.status===401&&cloud.mode==='cap'){resetCloudSession();return}cloud.error=error.message;accountChrome()}
}
document.addEventListener('click',async e=>{
 const account=e.target.closest('[data-account-menu]');if(account){showAccount();return;}
 const space=e.target.closest('[data-space-id]');if(space){await chooseSpace(space.dataset.spaceId);return;}
 const action=e.target.closest('[data-cloud-action]')?.dataset.cloudAction;if(!action)return;
 if(action==='create')createSpaceForm();if(action==='import')createSpaceForm(true);
 if(action==='retry'){if(cloud.ready){await flushCloud();await refreshCloud()}else await startCloud()}
 if(action==='resolve')resolveConflict();
 if(action==='backup'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='Cap-version-cet-appareil.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 if(action==='remote'&&cloud.conflict){const row=cloud.conflict;cloud.pending=null;applySpace(row);document.querySelector('#modal').close();}
 if(action==='local'&&cloud.conflict){cloud.revision=cloud.conflict.revision;cloud.conflict=null;cloud.pending=JSON.stringify(state);if(await flushCloud())document.querySelector('#modal').close();else if(cloud.conflict)resolveConflict();}
 if(action==='signout'){if(cloud.pending&&!await flushCloud()){toast('Sauvegarde tes changements avant de te déconnecter.');return;}if(cloud.mode==='cap'){try{await capSignout()}catch(error){toast(error.message)}}else location.assign('/signout-with-chatgpt?return_to=%2F')}
});
document.addEventListener('submit',e=>{if(e.target.id==='cloud-create-form'){e.preventDefault();void createCloudSpace(e.target)}});
window.addEventListener('beforeunload',e=>{if(cloud.pending){e.preventDefault();e.returnValue=''}});
window.addEventListener('online',()=>{if(cloud.pending)void flushCloud();else void refreshCloud()});
window.addEventListener('focus',()=>void refreshCloud());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshCloud()});
setInterval(()=>void refreshCloud(),15000);
