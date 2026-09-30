// Never cache financial data, API responses or app code. Deployments stay live.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).catch(()=>new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CAP · Connexion indisponible</title><body style="font-family:system-ui;background:#eef4ff;color:#142b23;margin:0;padding:48px 24px;text-align:center"><h1>CAP</h1><h2>Connexion indisponible</h2><p>Reconnecte-toi à Internet pour retrouver ton espace et synchroniser tes données.</p><p>Tes données déjà sauvegardées en ligne restent sur ton compte.</p><a href="/">Réessayer</a></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
