export function emailConfigured(){return !!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM);}
export async function sendCode(to:string,code:string,purpose:'verify'|'reset',id:string){
 if(!emailConfigured())throw Error('E-mail non configuré.');
 const reset=purpose==='reset';
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',signal:AbortSignal.timeout(10000),
  headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':id},
  body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject:reset?'Ton code pour retrouver tes paris':'Confirme ton adresse e-mail',text:`Pari à Long Terme\n\n${reset?'Pour choisir un nouveau mot de passe':'Pour confirmer ton adresse e-mail'}, saisis ce code dans l’application :\n\n${code}\n\nCe code est valable 10 minutes et une seule fois. Ne le partage avec personne.\nSi tu n’as pas fait cette demande, ignore ce message.\n`})
 });
 if(!response.ok)throw Error('Envoi de l’e-mail indisponible.');
}
