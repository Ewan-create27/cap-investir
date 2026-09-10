# Mettre Cap en ligne sans ChatGPT

Pour Render gratuit + Neon, suivre en priorité DEMARRAGE-RENDER.md. Le disque persistant décrit ci-dessous ne concerne que le mode SQLite, sans DATABASE_URL. Avec Neon, la base distante conserve les données et aucun disque Render n’est nécessaire. Le dossier permet également un serveur Node.js 24 ou Docker avec un disque persistant en mode SQLite. Il ne fonctionne pas par simple dépôt dans Netlify Drop : il contient maintenant des comptes et une base de données côté serveur. Le tarif dépend du serveur et du domaine choisis ; aucun hébergement extérieur n’a été souscrit ou créé automatiquement.

## Option Docker sur un serveur

Prévoir un serveur Linux avec Docker Compose installé et un nom de domaine pointant vers son adresse IP. Le serveur doit pouvoir recevoir le trafic sur les ports 80 et 443. Le dossier Cap ne doit contenir aucune base de données personnelle lors d’un transfert public de son code.

1. Copier le dossier Cap sur le serveur.
2. Copier `.env.example` vers `.env`.
3. Dans `.env`, remplacer `CAP_DOMAIN=cap.example.com` par le vrai domaine, sans `https://` et sans slash. Docker Compose déduit l’origine HTTPS de ce domaine.
4. Exécuter `docker compose up -d --build` dans le dossier.
5. Ouvrir `https://votre-domaine` et créer le premier compte Cap. Aucun compte administrateur ni mot de passe commun n’est préconfiguré.

Caddy prend en charge HTTPS. Le serveur Cap est accessible seulement au proxy dans ce déploiement. Les données résident dans le volume Docker `cap_data`, conservé lors des reconstructions. Ne pas exécuter `docker compose down -v` : cette commande supprimerait les volumes et les données. Ne pas lancer plusieurs instances qui partageraient le même fichier SQLite sur un stockage réseau.

## Option hébergeur Node.js

Configurer :

- Version : Node.js 24 LTS ; commande de démarrage : `npm start`.
- `PORT` : le port attendu par l’hébergeur.
- `APP_ORIGIN` : l’adresse HTTPS publique exacte, sans slash final.
- `DATABASE_PATH` : un chemin dans un disque PERSISTANT, par exemple `/data/cap.sqlite`.
- Une seule instance du serveur pour cette version SQLite.
- Un proxy HTTPS devant l’application ; conserver les cookies et les en-têtes Origin.

Un disque éphémère ferait perdre les comptes et données lors d’un redéploiement. Une offre de fonctions stateless sans stockage persistant n’est pas adaptée à cette version. L’endpoint `/healthz` permet une vérification de disponibilité. Aucune clé OpenAI ou configuration ChatGPT n’est nécessaire.

## Vérifier la mise en ligne

Créer un compte, conserver son code de récupération, créer un espace, un objectif et un poste de budget. Sur le téléphone, ouvrir la même adresse et se connecter avec le même e-mail/mot de passe. Les données doivent apparaître. Une modification est envoyée immédiatement ; un autre appareil la récupère au retour sur la page ou dans les 15 secondes hors formulaire ouvert. Tester aussi un second compte qui doit commencer vide.

## Sauvegarder

Sur une installation Node : `npm run backup`. Le fichier est créé dans `backups/` avec un instantané cohérent de la base, même si le serveur tourne.

Avec Docker :

```sh
docker compose exec cap node standalone/backup.js
docker compose cp cap:/app/backups ./sauvegardes-cap
```

Copier régulièrement ces sauvegardes vers un emplacement privé différent du serveur. Elles contiennent les données financières et les informations de comptes. Cette version inclut la commande de sauvegarde, mais ne programme pas de sauvegarde automatique externe.

Pour restaurer, arrêter Cap, préserver une copie de l’état actuel, remplacer la base dans le volume persistant par l’instantané choisi (en retirant les anciens fichiers associés `-wal` et `-shm` uniquement serveur arrêté), rétablir les droits du compte qui exécute Cap et redémarrer. Prévoir cette opération avec l’administrateur de l’hébergement.
