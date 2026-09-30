# Pari à Long Terme

Application privée de paris entre amis, React/TypeScript + Vite, serveur Node.js 24 et PostgreSQL/Neon. PWA, avatars photo, comptes personnels, paris ouverts, camps volontaires, négociation d’enjeux, rappels Web Push et historique.

**Dernière mise à jour : lire `INSTRUCTIONS-AFFICHAGE-MOBILE.md`.**

Camps définitifs : `INSTRUCTIONS-CAMPS-FIXES.md`.

Récupération e-mail : `INSTRUCTIONS-RECUPERATION-EMAIL.md`.

Comptes et paris ouverts : `INSTRUCTIONS-COMPTES-ET-PARIS.md`.

## Installation

```
corepack pnpm install --frozen-lockfile --prod=false
```

Copier `.env.example` vers `.env` localement. Fournir `DATABASE_URL`, `ADMIN_PASSWORD`, `INVITE_CODE`, `SESSION_SECRET` et `CRON_SECRET`. Les secrets de session/cron font au moins 32 caractères ; les deux codes administrateur/invitation font 12 à 256 caractères et doivent être différents. `APP_URL` indique l’origine publique HTTPS en production. Ne jamais committer `.env`.

```
corepack pnpm build
corepack pnpm start
```

Le démarrage applique les migrations SQL une fois, sous transaction PostgreSQL. Aucune démo n’est créée. Les clés VAPID et photos résident en base, pour survivre aux redémarrages Render. Le backend nécessite PostgreSQL, pas un disque local persistant.

## Architecture

- `client.tsx` : connexion, création de compte, reprise des anciens personnages et récupération administrateur.
- `app/page.tsx` : navigation responsive et gestion des paris/profils.
- `app/negotiation.tsx` : participation, accords, contre-propositions et mot de passe.
- `server/auth.ts`, `server/accounts.ts` : scrypt salé, sessions aléatoires hachées, cookies HttpOnly, invitations et reprise de profil par code à usage unique.
- `app/api/data/route.ts` : règles métier et autorisations. Les changements sont sérialisés dans une transaction ; les camps sont définitifs dès la participation. Chaque nouvelle proposition ou nouvel arrivant demande un nouvel accord sur l’enjeu. Les refus bloquent le lancement.
- `server/recovery.ts`, `server/email.ts`, `app/recovery.tsx` : vérification des adresses et récupération par codes temporaires via Resend HTTPS.
- `migrations/` : schéma, nettoyage des exemples, comptes et négociations.
- `server/runtime.ts` : PostgreSQL avec TLS vérifié vers Neon, migrations et stockage des avatars.
- `app/api/cron/route.ts` : échéances persistantes, fuseaux, baux de traitement, tentatives et déduplication des notifications.

Le créateur est seul autorisé à gérer un nouveau pari. Chaque participant décide pour lui-même. Il faut les deux camps et un accord unanime pour lancer et figer un pari. Aucun paiement ni suppression définitive de pari.

Les anciennes données sont conservées ; les anciens paris sans créateur nécessitent le mot de passe administrateur pour leur gestion. Le groupe reste unique et privé ; pas de groupe public dans cette version. La récupération par e-mail utilise Resend : configurer `RESEND_API_KEY` et `EMAIL_FROM`, puis vérifier l’adresse depuis Profil.

## Planification des rappels

Conserver le workflow existant dans `.github/workflows/` et ses secrets, ou appeler périodiquement :

```
POST https://VOTRE-SERVICE.onrender.com/api/cron
Authorization: Bearer VOTRE_CRON_SECRET
```

Aucun timer navigateur ne remplace ce planificateur. Le rythme horaire peut être retardé par le planificateur ou le réveil du serveur ; la livraison ne garantit pas une minute exacte. Les notifications nécessitent HTTPS, permission et abonnement sur chaque appareil. Sur iOS, ouvrir l’application installée sur l’écran d’accueil. Seuls les participants abonnés reçoivent les rappels de leurs paris.

## Vérification et sauvegarde

```
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
node tests/demo-cleanup.mjs
node tests/recovery.mjs
corepack pnpm backup
```

Les tests n’utilisent pas la vraie base Neon : ils démarrent un PostgreSQL embarqué temporaire. La sauvegarde nécessite `pg_dump` et utilise `DATABASE_URL` ; conserver le fichier obtenu dans un lieu privé.
