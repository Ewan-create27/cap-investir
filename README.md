# Cap autonome

Cap fonctionne avec des comptes e-mail/mot de passe, un serveur Node.js et une base PostgreSQL (Neon) ou SQLite locale. Aucun compte ChatGPT, aucune API OpenAI ne sont nécessaires. Sur Render, Neon conserve les données ; en local, SQLite est disponible.

Les objectifs, relevés, budgets, préférences et progressions sont sauvegardés côté serveur et isolés par compte. Un compte peut posséder plusieurs espaces. La synchronisation conserve la protection des modifications simultanées. Le code vérifie les sessions côté serveur ; les en-têtes d’identité envoyés par un navigateur ne donnent aucun accès.

## Render gratuit + Neon

Suivre DEMARRAGE-RENDER.md pour publier cette version. Renseigner DATABASE_URL dans les secrets Render. L’adresse publique est détectée automatiquement depuis RENDER_EXTERNAL_URL ; APP_ORIGIN permet de la remplacer pour un domaine personnalisé. Les tables sont créées automatiquement dans Neon au démarrage, avec une migration versionnée et transactionnelle. Les sessions et limites de connexion résident également dans Neon. Le serveur refuse de démarrer sur Render sans DATABASE_URL.

## Commencer sur son ordinateur

1. Installer Node.js 24 LTS.
2. Décompresser le dossier Cap et ouvrir un terminal dans ce dossier.
3. Exécuter `npm ci --omit=dev`, puis `npm start`.
4. Ouvrir http://localhost:3000 et créer un compte Cap.

Exécuter `npm ci --omit=dev` avant `npm start` pour installer le pilote PostgreSQL. `npm ci` inclut aussi les outils de développement et les tests PostgreSQL. `npm test` vérifie comptes, isolation, synchronisation, récupération et persistance après redémarrage.

Ce lancement local n’est pas encore une publication accessible partout. Le serveur doit rester allumé. Pour un usage permanent depuis téléphone et ordinateur, voir DEPLOIEMENT.md.

## Connexion et récupération

Un mot de passe de 12 à 128 caractères est demandé. À l’inscription, un code de récupération secret est affiché et téléchargeable. Il permet de remplacer le mot de passe et est renouvelé après utilisation. Une récupération déconnecte tous les appareils. Conserver le nouveau code à chaque récupération.

Cette version n’envoie pas de messages et ne vérifie pas la possession de l’adresse e-mail : l’e-mail sert d’identifiant. Le lien « Mot de passe oublié » utilise le code de récupération, pas un e-mail. Sans mot de passe ni code, il n’existe pas de récupération automatique. Ajouter ultérieurement un service d’e-mail vérifié est possible, mais aucun service payant ou compte externe n’est imposé ici.

Les mots de passe sont dérivés avec scrypt et un sel aléatoire. Les sessions sont dans des cookies HttpOnly/SameSite, Secure en production ; seuls leurs condensats sont en base. Les codes de récupération sont également stockés sous forme de condensats. Les connexions sont limitées par adresse distante et par identifiant. Derrière un proxy, la limite par adresse est partagée entre visiteurs : les en-têtes de proxy non fiables sont volontairement ignorés. Ce choix convient à un petit lancement ; adapter un proxy de confiance et la limitation avant une diffusion importante.

## Récupérer ses données

Depuis l’ancienne version hébergée : avatar → Exporter cet espace. Sur le Cap autonome : créer son compte → avatar → Importer un fichier Cap. Chaque import crée un nouvel espace et conserve les espaces existants. Répéter pour chaque ancien espace.

Si les données sont encore dans l’ancien stockage du navigateur : avatar → Récupérer les données de ce navigateur, puis exporter l’espace créé. Changer de domaine empêche le nouveau site de lire automatiquement le stockage de l’ancien : le fichier exporté assure le transfert.

## Structure

- `public/` : toute l’interface, graphiques, budget, leçons et gestion des comptes.
- `server/api.js` : API de données commune, contrôle de propriétaire et versions concurrentes.
- `standalone/` : serveur autonome, authentification, SQLite, migrations et sauvegarde.
- `Dockerfile`, `compose.yaml`, `Caddyfile` : mise en ligne sur un serveur avec HTTPS.
- `tests/` : vérifications automatisées.

Les fichiers `server/worker.js`, `.openai/` et `scripts/build.mjs` présents dans le dépôt de développement servent uniquement à maintenir l’ancien hébergement pendant la migration. Ils ne sont pas requis pour le fonctionnement autonome et sont exclus du dossier autonome distribué. Ne pas confondre l’ancienne URL Sites avec le futur hébergement indépendant.

Références techniques : [SQLite Node.js](https://nodejs.org/api/sqlite.html), [scrypt Node.js](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

Vérification PostgreSQL : le test postgres.test.mjs utilise un moteur PostgreSQL embarqué (PGlite) pour vérifier le schéma, les comptes, les sessions, les conflits et le redémarrage de l’application. Il ne remplace pas une vérification de connexion au projet Neon réel, qui nécessite DATABASE_URL.
