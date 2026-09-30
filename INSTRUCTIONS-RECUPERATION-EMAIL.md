# Mot de passe oublié : recevoir un code par e-mail

Cette archive met à jour le projet existant. Elle inclut aussi les fichiers de la précédente mise à jour des comptes personnels et paris ouverts. Ne supprime pas les autres fichiers de ton dépôt. Aucune réinitialisation des vrais comptes ou paris n’est déclenchée par cette mise à jour.

## Ce qui change

- Une adresse e-mail est demandée lors de la création d’un personnage.
- Après inscription, le profil s’ouvre pour vérifier cette adresse avec un code.
- Les comptes déjà créés peuvent ajouter et vérifier leur adresse dans **Profil → Mon adresse de récupération**.
- À la connexion : **Mot de passe oublié ? → adresse e-mail → code reçu → nouveau mot de passe**.
- Le code comporte six chiffres, expire après dix minutes et fonctionne une seule fois. Un nouvel envoi remplace le précédent.
- Après cinq erreurs, il faut demander un nouveau code. Les envois sont espacés d’au moins une minute et limités à cinq par heure et par compte/type de demande, même après redémarrage du serveur.
- Une réinitialisation réussie ferme toutes les sessions du compte. Il faut ensuite se reconnecter avec son identifiant habituel et son nouveau mot de passe.
- L’adresse e-mail n’est pas visible par les amis. Changer d’adresse exige le mot de passe actuel et un code envoyé à la nouvelle adresse. L’ancienne reste active jusqu’à cette confirmation.

## 1. Configurer l’expéditeur dans Resend

L’envoi utilise l’API HTTPS de Resend, et non le serveur e-mail de ton ordinateur.

1. Crée ton compte sur https://resend.com.
2. Pour envoyer aux amis, ouvre **Domains** et ajoute un domaine que tu possèdes. Un sous-domaine dédié convient aussi.
3. Ajoute les enregistrements DNS fournis par Resend chez le fournisseur de ce domaine. Attends que Resend indique que l’envoi est vérifié.
4. Choisis une adresse d’expédition sur ce domaine, par exemple `connexion@ton-domaine.fr`.
5. Dans **API Keys**, crée une clé avec le droit d’envoyer depuis ce domaine. Garde-la privée.

**Un domaine d’expédition vérifié est nécessaire pour envoyer à tous les participants.** Tu ne peux pas vérifier le domaine `onrender.com` ni utiliser une adresse Gmail comme si le domaine t’appartenait. L’application peut garder son URL Render : le domaine sert ici à l’expéditeur des e-mails.

Pour un premier essai personnel, Resend autorise `onboarding@resend.dev` uniquement vers l’adresse associée à ton compte Resend. Ce mode de test ne permet pas d’envoyer à tous tes amis. Si tu n’as pas de domaine, ce prérequis reste à régler avant l’activation pour la bande.

Documentation :
- https://resend.com/docs/dashboard/domains/introduction
- https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
- https://resend.com/docs/api-reference/emails/send-email

## 2. Ajouter deux variables dans Render

Dans le service existant, ouvre **Environment** et ajoute :

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | La clé privée Resend, commençant généralement par `re_` |
| `EMAIL_FROM` | `Pari à Long Terme <connexion@ton-domaine.fr>` |

Remplace l’exemple par ton vrai expéditeur vérifié. Pour le test personnel seulement : `Pari à Long Terme <onboarding@resend.dev>`.

Garde les variables existantes : `DATABASE_URL`, `ADMIN_PASSWORD`, `INVITE_CODE`, `SESSION_SECRET`, `CRON_SECRET`, etc. Aucun mot de passe ni aucune clé ne doit aller sur GitHub.

Si ces deux variables sont absentes, l’application continue à fonctionner, mais affiche que l’envoi des codes n’est pas configuré.

## 3. Mettre le code sur GitHub

1. Décompresse le ZIP.
2. Ouvre `Ewan-create27/Pari-long-terme`, branche `main`.
3. **Add file → Upload files** : glisse le contenu du dossier extrait à la racine du dépôt. Ne glisse pas le ZIP ni un dossier englobant supplémentaire.
4. Valide avec **Commit changes**. Les fichiers existants correspondants sont remplacés ; les autres restent en place.
5. Laisse Render redéployer, ou utilise **Manual Deploy → Deploy latest commit**.

La nouvelle migration `migrations/0004_email_recovery.sql` s’exécute automatiquement au démarrage. Aucun changement manuel de table dans Neon n’est nécessaire.

Conserve les commandes Render :

Build :
```
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build
```

Start :
```
corepack pnpm start
```

## 4. Faire le premier test réel

1. Connecte-toi à ton personnage.
2. Dans ton propre **Profil → Mon adresse de récupération**, renseigne ton adresse et ton mot de passe actuel.
3. Clique **Recevoir un code de vérification**.
4. Consulte ta boîte mail, y compris les indésirables. Saisis le code dans l’application pour confirmer l’adresse.
5. Déconnecte-toi. Clique **Mot de passe oublié ?**, indique la même adresse, récupère le nouveau code et choisis un nouveau mot de passe.
6. Reconnecte-toi avec ton identifiant habituel et le nouveau mot de passe.

Chaque ami doit vérifier sa propre adresse avant de pouvoir récupérer son compte par e-mail. Sans adresse vérifiée, la récupération administrateur reste disponible.

L’écran de récupération affiche volontairement le même message pour une adresse connue et inconnue, afin de ne pas révéler les comptes. Un message générique n’est donc pas une garantie de livraison. Si aucun e-mail n’arrive, vérifie l’adresse, sa confirmation dans Profil et les envois/erreurs dans le tableau de bord Resend. Un renvoi avant une minute ne déclenche pas un nouvel e-mail. Une erreur d’envoi rend le code correspondant inutilisable.

## Validation du code livré

TypeScript et build de production validés. Tests automatisés sur base temporaire : association d’adresse, contrôle du mot de passe actuel, confidentialité, codes expirés et incorrects, limite de tentatives/envois, usage unique même avec deux validations simultanées, persistance après redémarrage, fermeture des sessions, changement d’adresse, échec de livraison et maintien du fonctionnement des paris existants.

Le service Resend a été simulé pendant les tests : aucun e-mail réel n’a été envoyé, aucune clé réelle n’a été utilisée. Le premier test dans ta boîte mail reste à faire après configuration.

Commandes pour les développeurs :
```
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
node tests/recovery.mjs
```

Les codes ne sont jamais enregistrés en clair ni renvoyés dans l’API : la base conserve une empreinte HMAC liée à la demande. Ils sont liés au compte, à l’usage attendu et au mot de passe au moment de leur création. Une modification du mot de passe les invalide.

La requête de remise à zéro complète fournie précédemment reste compatible : les demandes de récupération sont automatiquement supprimées avec les comptes. Cette mise à jour n’exécute pas cette remise à zéro.
