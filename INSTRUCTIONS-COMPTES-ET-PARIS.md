# Mise à jour : personnages personnels et paris ouverts

Cette archive est une mise à jour du projet Neon/Render existant. Elle contient uniquement les fichiers à ajouter ou remplacer, ainsi que cette notice. Les autres fichiers de ton dépôt doivent rester en place. Ne crée pas un nouveau projet Neon ou Render.

## 1. Préparer Render

Dans ton service Render, ouvre **Environment**.

- Ajoute `INVITE_CODE` : une phrase de 12 à 256 caractères que tu pourras communiquer à tes amis. Exemple à personnaliser : `notre-bande-nos-paris-2026`.
- `ADMIN_PASSWORD` devient réservé à toi. Si l’ancien mot de passe du groupe avait été partagé, remplace-le par un nouveau mot de passe de 12 à 256 caractères. Il doit être différent de `INVITE_CODE`.
- Garde `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `APP_URL` et les autres paramètres existants.
- `SEED_DEMO` n’est plus utilisé et peut être retiré.

Enregistre ces variables avant de mettre à jour le code. Le nouveau serveur refusera de démarrer si `INVITE_CODE` est absent, trop court ou identique au mot de passe administrateur.

Dans **Settings**, conserve ces commandes :

Build Command :
```
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build
```

Start Command :
```
corepack pnpm start
```

## 2. Remplacer les fichiers sur GitHub

1. Décompresse cette archive sur ton ordinateur.
2. Ouvre le dépôt `Ewan-create27/Pari-long-terme`, branche `main`.
3. À la racine du dépôt, utilise **Add file → Upload files**.
4. Glisse **le contenu** du dossier décompressé : les dossiers `app`, `lib`, `server`, `migrations`, `tests`, ainsi que `client.tsx`, `render.yaml`, `README.md` et cette notice. Ne glisse pas le ZIP ni un dossier supplémentaire contenant tout le projet.
5. GitHub remplace les fichiers de même chemin et ajoute les nouveaux. Il faut notamment que `server/accounts.ts`, `app/negotiation.tsx` et `migrations/0003_personal_accounts.sql` soient bien présents.
6. Clique sur **Commit changes**.
7. Render redéploie automatiquement si cette option est activée. Sinon utilise **Manual Deploy → Deploy latest commit**.

Le fichier `.env.example` est seulement un modèle local ; tu peux le remplacer aussi, mais il n’est pas nécessaire au déploiement. Ne publie jamais de vrai fichier `.env` ni tes mots de passe sur GitHub.

Au démarrage, les migrations s’appliquent automatiquement à Neon. Les vrais paris, photos, résultats et participants sont conservés. Les anciens exemples identifiés comme démonstration sont supprimés si la mise à jour précédente n’avait pas encore été appliquée. Comme pour toute migration, garde une sauvegarde préalable si ta base contient des données importantes.

## 3. Retrouver les personnages existants

Les anciennes sessions communes sont fermées. Chacun doit désormais avoir son compte personnel.

**Si un personnage existe déjà, récupère son code avant de créer son compte**, pour éviter de créer un doublon :

1. Sur l’écran de connexion, ouvre **Administration · anciens profils et accès oubliés**.
2. Saisis ton nouveau `ADMIN_PASSWORD` et affiche les personnages à reprendre.
3. Clique sur **Créer un code** à côté de la bonne personne.
4. Transmets ce code uniquement à cette personne. Il expire après 24 heures et ne fonctionne qu’une fois. Générer un nouveau code invalide l’ancien.
5. Cette personne choisit **Créer mon personnage** puis renseigne le code d’invitation, son identifiant, son propre mot de passe et le **code de reprise**.
6. L’ancien personnage garde son prénom, son avatar et tout son historique. Les champs prénom/avatar du formulaire ne le remplacent pas ; il pourra les modifier après connexion.

Tu peux suivre la même procédure pour reprendre ton propre personnage. L’administration reste accessible en se déconnectant.

Un nouvel ami sans personnage existant laisse le code de reprise vide. Il choisit un prénom, un avatar, un identifiant unique et un mot de passe d’au moins 12 caractères. Les photos s’importent ensuite depuis **Profil → Modifier mon personnage**.

Partage l’URL de l’application et `INVITE_CODE` avec tes amis, jamais `ADMIN_PASSWORD`. Il n’y a pas d’envoi automatique d’invitations par e-mail.

## 4. Fonctionnement des nouveaux paris

1. Le créateur choisit **son propre camp**, décrit le pari, propose l’enjeu et les rappels.
2. Le pari devient **Ouvert**, même si personne n’est encore en face.
3. Chaque ami peut ouvrir sa fiche, rejoindre Pour ou Contre, ou simplement ne pas participer.
4. Le camp devient définitif dès la création ou la confirmation de participation. Un participant peut accepter ou refuser l’enjeu et proposer autre chose tant que le pari reste ouvert. Il ne peut plus changer de camp ni quitter puis rejoindre le pari. Le créateur peut toujours archiver son pari.
5. Une contre-proposition remplace l’enjeu à discuter ; son auteur l’accepte en la soumettant. Les autres accords sont remis à zéro. L’arrivée d’un nouveau participant remet également tous les accords à zéro. Les camps existants restent inchangés.
6. Quand il y a au moins une personne de chaque côté et que chacun a accepté la dernière version, le créateur peut cliquer **Lancer le pari avec l’accord de tous**.
7. Après confirmation, les participants, les camps et l’enjeu sont fixés. Le créateur peut programmer les rappels, archiver ou clôturer le pari.

Enjeux disponibles : aucun enjeu, argent sans paiement, gage, récompense, autre engagement. Pour les gages et récompenses, précise qui offre ou réalise quoi, pour qui. L’historique garde les versions successives.

Un pari ouvert ne peut pas attribuer de victoire ou défaite avant d’être accepté et lancé. Il peut être archivé, annulé ou clôturé comme indéterminé.

Les anciens paris sont conservés comme déjà lancés. Ils n’avaient pas de créateur identifié : leurs actions de gestion demandent le mot de passe administrateur. La consultation reste possible pour la bande.

## 5. Accès et notifications

- Chacun modifie uniquement son propre personnage. Consulter le profil d’un ami ne change pas l’identité connectée.
- **Profil → Modifier mon mot de passe** ferme toutes les sessions du compte après modification.
- Pour un mot de passe oublié, l’administrateur utilise la section Administration de l’écran de connexion. Il renseigne l’identifiant et un nouveau mot de passe dans le formulaire principal, puis **Réinitialiser l’accès**. Il transmet ce mot de passe à la bonne personne, qui peut le modifier. La récupération par e-mail est désormais disponible après configuration de Resend et vérification de l’adresse : voir `INSTRUCTIONS-RECUPERATION-EMAIL.md`.
- Le bouton d’actualisation recharge les paris ; l’application les recharge aussi au retour dans l’onglet. Il n’y a pas de mise à jour instantanée par WebSocket.
- Chaque appareil doit activer ses notifications depuis Profil. Les rappels sont envoyés uniquement aux membres du pari abonnés aux notifications.
- Le planificateur externe existant reste nécessaire, avec la même URL `/api/cron` et le même `CRON_SECRET`. La cadence horaire actuelle est conservée.
- Les rappels s’arrêtent à l’archivage ou à la clôture. Restaurer un pari ne réactive pas les anciens rappels : il faut les reprogrammer.

## Vérifications réalisées sur le code livré

Compilation TypeScript et build de production ; tests sur PostgreSQL embarqué compatible PGlite : migration d’une ancienne base, reprise unique d’un personnage, mots de passe hachés, sessions personnelles et révocation, droits d’accès, création solo, trois participants, contre-propositions concurrentes, accords par version, verrouillage, archivage/restauration, clôture, photos, persistance après redémarrage, appel du planificateur et suppression ciblée des démos.

Le code est fourni prêt à mettre à jour. Il n’a pas été publié directement sur ton Render et l’envoi réel de notifications sur tes téléphones n’a pas été testé depuis cet environnement.
