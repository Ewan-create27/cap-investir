# Cap : mise en ligne sur Render + Neon

Ce dossier remplace les ZIP précédents. Il contient maintenant le support PostgreSQL pour Neon. Aucun compte ChatGPT n’est nécessaire pour les visiteurs.

## 1. Mettre le code dans GitHub

Créer un dépôt privé `cap-investir` sur GitHub (New repository → Private). Depuis le dépôt, choisir Add file → Upload files, puis déposer le CONTENU du dossier Cap décompressé. Ne pas déposer le ZIP et ne pas ajouter un niveau de dossier Cap autour des fichiers.

À la racine du dépôt, on doit voir `package.json`, `package-lock.json`, `public`, `standalone`, `server` et `render.yaml`. Les fichiers d’environnement réels `.env`, mots de passe, codes de récupération et exports de données personnels ne doivent jamais y être ajoutés. `.env.example` ne contient que des exemples et peut être ajouté.

## 2. Récupérer la connexion Neon

Dans le tableau de bord du projet Neon : bouton Connect. Choisir la branche production, la base et le rôle proposés pour ce projet. Activer Connection pooling si proposé. Copier la chaîne de connexion (Connection string) commençant par `postgresql://`.

Copier uniquement l’URL : pas `psql`, pas de guillemets, pas les commandes du bloc « Agent prompt ». Garder les paramètres de l’URL fournis par Neon. Cette URL contient un mot de passe : la coller directement dans Render, jamais dans GitHub, une capture publique ou une conversation.

La création du projet Neon seule ne relie pas encore Render : l’étape suivante établit la liaison.

## 3. Créer le Web Service Render

Render → New → Web Service → GitHub → sélectionner le dépôt `cap-investir`.

| Réglage | Valeur |
| --- | --- |
| Name | cap-investir, ou un nom disponible |
| Language / Runtime | Node |
| Branch | main |
| Root Directory | Laisser vide si package.json est à la racine |
| Build Command | npm ci --omit=dev |
| Start Command | npm start |
| Instance Type | Free |
| Health Check Path (Advanced) | /healthz |

Variables Environment :

| Nom | Valeur |
| --- | --- |
| DATABASE_URL | La chaîne secrète copiée depuis Neon |
| NODE_VERSION | 24 |

Ne pas ajouter DATABASE_PATH, ni un disque payant, ni une base Render Postgres. Ne pas définir APP_ORIGIN avec localhost : le code lit automatiquement l’adresse HTTPS donnée par Render. Pour un futur domaine personnalisé seulement, définir APP_ORIGIN avec son origine HTTPS exacte sans slash final.

Cliquer sur Deploy Web Service. Le premier démarrage crée les tables de Cap dans Neon. Aucun SQL manuel n’est nécessaire et aucune commande Neon CLI n’est requise. La région du projet Neon existant peut être conservée pour ce premier lancement ; un serveur Render proche de la base limitera les délais réseau.

Le fichier render.yaml constitue une alternative via New → Blueprint : il fixe le plan Free et demande DATABASE_URL. Il n’est pas nécessaire pour la méthode manuelle ci-dessus.

## 4. Vérifier

Lorsque Render indique Live, ouvrir son adresse HTTPS. Créer son compte Cap, télécharger son code de récupération, créer un espace et un objectif. Sur téléphone, ouvrir cette même adresse et se connecter avec le même compte. Choisir le même espace pour retrouver ses données.

Pour reprendre l’ancienne version : avatar → Exporter cet espace, puis dans le nouveau Cap : avatar → Importer un fichier Cap. Chaque import crée un nouvel espace sans écraser les autres.

## 5. Limites et sauvegardes

Les offres gratuites sont soumises aux quotas et conditions des fournisseurs. Render peut mettre le site en veille ; la reprise peut être lente. Neon conserve les données séparément, y compris lors d’un redémarrage de Render. Aucun mécanisme de requêtes artificielles pour empêcher la veille n’est ajouté.

Après une mise en veille, attendre l’ouverture du site puis réessayer si nécessaire. Sans accès à ta chaîne de connexion privée, le projet Neon réel ne peut pas être vérifié depuis le dossier de code seul.

Pour les sauvegardes personnelles : exporter régulièrement les espaces depuis Cap. Pour sauvegarder aussi tous les comptes et sessions : utiliser pg_dump avec une connexion directe Neon et conserver l’archive dans un emplacement privé. La commande npm run backup est réservée au mode SQLite et refuse de fonctionner si DATABASE_URL est défini.

Si la connexion échoue, vérifier DATABASE_URL dans Environment sans publier sa valeur. Fournir seulement le texte d’erreur non sensible de Render pour le diagnostic. Ne pas choisir un plan payant pour corriger une configuration.

Documentation : https://render.com/docs/web-services et https://neon.com/docs/connect/connect-from-any-app
