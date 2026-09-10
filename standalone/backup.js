if(process.env.DATABASE_URL)throw new Error('Pour Neon, utilise un export pg_dump PostgreSQL ou Exporter cet espace dans Cap. La sauvegarde SQLite ne contient pas les données Neon.');
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
mkdirSync('backups',{recursive:true,mode:0o700});
const db=new DatabaseSync(process.env.DATABASE_PATH||'./data/cap.sqlite',{readOnly:true});
const file='backups/cap-'+new Date().toISOString().replaceAll(':','-')+'.sqlite';
await backup(db,file);db.close();console.log(file);
