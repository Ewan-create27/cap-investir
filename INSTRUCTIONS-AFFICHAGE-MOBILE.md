# Mise à jour de l’affichage mobile

Cette archive contient les fichiers à remplacer ou ajouter dans le dépôt existant. Ce n’est pas un dépôt complet : conservez les autres fichiers, notamment package.json et pnpm-lock.yaml.

## Installer la mise à jour

1. Décompressez `Pari-mise-a-jour-mobile.zip`.
2. Dans votre copie du dépôt GitHub, remplacez les fichiers correspondants en conservant les dossiers `app`, `lib`, `server`, `migrations`, `tests` et `public`.
3. Ajoutez également les nouveaux fichiers, notamment `app/mobile-refresh.css`. Ne supprimez pas les autres fichiers du dépôt et ne publiez jamais votre fichier `.env`.
4. Envoyez les changements sur la branche utilisée par Render (habituellement `main`).
5. Dans Render, ouvrez le service web. Si le déploiement automatique est activé, attendez sa fin. Sinon, lancez le déploiement manuel du dernier commit.
6. Ouvrez le site et rechargez la page. Sur une PWA déjà installée, fermez-la puis rouvrez-la si nécessaire.

Aucune nouvelle variable d’environnement n’est nécessaire pour cette mise à jour visuelle. Conservez votre configuration Neon et Render actuelle. Ne réinitialisez pas la base de données.

Commandes du service existant :

Build : `corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm build`

Start : `corepack pnpm start`

## Ce qui change

- Palette jaune, orange et rouge, sur un fond crème clair.
- Cartes de paris plus compactes et espaces harmonisés.
- Navigation, boutons, formulaires et fenêtres adaptés aux petits écrans.
- Textes répétitifs retirés, explications secondaires repliables.
- Déconnexion accessible en touchant l’avatar en haut à droite.
- Icône et couleurs de la PWA actualisées.

Cette archive reprend aussi les fichiers des précédentes mises à jour des comptes, de la récupération et des camps fixes. Les migrations déjà exécutées ne sont pas rejouées. La migration historique 0002 retire uniquement les données de démonstration identifiées, si elle n’avait jamais été appliquée. Les comptes et paris réels sont conservés.

## Vérifications effectuées

Compilation TypeScript et build de production réussis. Contrôles dans Chromium à 320, 390, 430, 768 et 1280 pixels : accueil, paris, amis, profil, création, détail et proposition d’enjeu, sans débordement horizontal ni erreur JavaScript. Connexion et création de personnage contrôlées à 320 pixels. Les contrôles d’interface utilisent des données de test isolées et ne modifient pas Neon.

Après déploiement, vérifiez sur votre téléphone la nouvelle couleur du bouton Créer, l’ouverture d’un pari et le menu de votre avatar. Le rendu sur Safari/iPhone réel reste à vérifier sur votre appareil.
