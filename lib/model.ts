export type Person={id:string;name:string;avatar:string;color:string;archived:number;demo:number};
export type Stake={type:'none'|'money'|'dare'|'reward'|'other';amount?:number;currency?:string;text?:string};
export type Reminder={id?:string;next:string;frequency:string;timezone:string;anchor?:string;active?:number};
export type Bet={creator_id?:string;phase:string;revision:number;acceptances:string[];refusals:string[];proposals:{revision:number;person_id:string;stake:Stake;created:string}[];id:string;icon?:string;archived_at?:string;title:string;description:string;deadline?:string;stake:Stake;status:string;result?:string;comment?:string;created:string;closed?:string;demo:number;members:{personId:string;side:string}[];reminders:Reminder[];events:{at:string;text:string}[]};
export function stakeText(s:Stake){return s.type==='money'?`${Number(s.amount).toLocaleString('fr-FR')} ${s.currency==='EUR'?'€':s.currency==='USD'?'$':'XPF'}`:s.type==='none'?'Pour le plaisir':s.text||'Gage';}
export function outcome(b:Bet,p:string){if(b.status==='archived')return 'Archivé';if(b.status==='active')return b.phase==='open'?'Ouvert':'En cours';if(b.result==='cancelled')return 'Annulé';if(b.result==='undetermined')return 'Indéterminé';const m=b.members.find(m=>m.personId===p);return m?m.side===b.result?'Gagné':'Perdu':'Terminé';}
export const emojis=['😎','🙂','😊','🤓','😄','🥰','🧑🏻','🧑🏼','🧑🏽','🧑🏾','🧑🏿','👩🏻','👩🏼','👩🏽','👩🏾','👩🏿','👨🏻','👨🏼','👨🏽','👨🏾','👨🏿','👩🏻‍🦱','👩🏼‍🦱','👩🏽‍🦱','👩🏾‍🦱','👩🏿‍🦱','👨🏻‍🦱','👨🏼‍🦱','👨🏽‍🦱','👨🏾‍🦱','👨🏿‍🦱','👩🏻‍🦰','👩🏼‍🦰','👨🏻‍🦰','👨🏽‍🦰','👩🏻‍🦳','👩🏽‍🦳','👨🏻‍🦳','👨🏿‍🦳','👩🏻‍🦲','👩🏽‍🦲','👨🏻‍🦲','👨🏾‍🦲','🧔🏻','🧔🏼','🧔🏽','🧔🏾','🧔🏿','👵🏻','👵🏽','👴🏻','👴🏾','👩🏻‍🦽','🧑🏽‍🦽','🧕🏻','🧕🏽','👳🏽','👳🏿','🧑🏻‍🚀','👩🏽‍🎨','👨🏾‍🍳','👩🏼‍🎓','🦊','🐼','🐸','🐯','🐱','🐶'];
export const iconGroups: {name:string;items:[string,string][]}[]=[
{name:'Classiques',items:[['🤞','Pari'],['🏆','Trophée'],['🎯','Objectif'],['⭐','Étoile'],['🔥','Défi'],['🎉','Fête'],['💪','Force'],['🤝','Engagement']]},
{name:'Voyage',items:[['🌏','Terre'],['✈️','Avion'],['🏝️','Île'],['🏔️','Montagne'],['🗺️','Carte'],['🚐','Road trip'],['⛵','Voilier'],['🏕️','Camping']]},
{name:'Sport',items:[['🏃','Course'],['⚽','Football'],['🏀','Basket'],['🎾','Tennis'],['🏉','Rugby'],['🏊','Natation'],['🏄','Surf'],['🚴','Vélo'],['🏋️','Musculation'],['🥊','Boxe'],['🧗','Escalade'],['⛷️','Ski']]},
{name:'Projets et vie',items:[['🎓','Études'],['💼','Travail'],['🏠','Maison'],['💍','Mariage'],['👶','Bébé'],['💰','Épargne'],['🚀','Projet'],['📅','Échéance'],['❤️','Amour'],['🌱','Habitude'],['🚗','Voiture'],['🐾','Animal']]},
{name:'Loisirs',items:[['🎮','Jeux vidéo'],['🎵','Musique'],['🎬','Cinéma'],['📚','Lecture'],['🍳','Cuisine'],['🍕','Pizza'],['🍣','Japon'],['☕','Café'],['📱','Réseaux sociaux'],['📸','Photo'],['🎨','Créativité'],['🧩','Puzzle']]}
];
export const betIcons=iconGroups.flatMap(g=>g.items.map(i=>i[0]));
export function betIcon(b:Pick<Bet,'icon'|'title'>){return b.icon|| (b.title.toLowerCase().includes('japon')?'🌏':b.title.toLowerCase().includes('marathon')?'🏃':'🤞');}
