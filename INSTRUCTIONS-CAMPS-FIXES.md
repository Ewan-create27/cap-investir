# Camps définitifs et propositions simplifiées

## Le nouveau fonctionnement

- Le créateur fixe son camp en créant le pari.
- Chaque ami choisit Pour ou Contre, puis confirme son choix avant de rejoindre.
- Dès la participation enregistrée, le camp est définitif. Il est impossible de changer de côté, y compris en quittant puis rejoignant le pari : la sortie du pari n’est plus proposée ni autorisée par le serveur.
- Refuser un enjeu ne change pas le camp. Aucun enjeu n’est validé pour le lancement tant que tous les participants ne l’ont pas accepté.

Sur la fiche, le participant voit simplement son camp fixe et l’enjeu proposé, avec :

1. **Accepter** pour donner son accord.
2. **Proposer autre chose** pour ouvrir un petit formulaire : type d’enjeu et description, ou montant/devise.
3. **Refuser cet enjeu**, en lien secondaire, pour exprimer son refus sans faire une autre proposition. Un accord peut être remplacé par un refus avant le lancement.

Les accords et refus détaillés se déplient sous un compteur. L’historique des propositions reste accessible dans une section repliée. L’enjeu n’est plus affiché deux fois dans la fiche d’un pari ouvert.

Une nouvelle proposition remplace celle qui est discutée, et demande l’accord de tous. Son auteur l’accepte en la soumettant. Les camps restent inchangés. L’arrivée d’un nouveau participant demande aussi de confirmer à nouveau l’enjeu.

Le créateur peut lancer le pari quand les deux camps sont représentés et que chacun a accepté. Un refus bloque le lancement. Après lancement, l’enjeu ne change plus non plus.

Les paris déjà présents gardent leurs camps et leurs données. Le verrouillage s’applique aux positions enregistrées au moment de la mise à jour ; il ne reconstitue pas d’anciens changements de camp.

## Installation

Cette archive est une mise à jour cumulative du projet existant : elle contient aussi les changements précédents des comptes personnels et des e-mails. Elle ne supprime aucun compte ni aucun vrai pari.

1. Décompresse le ZIP.
2. Ouvre `Ewan-create27/Pari-long-terme`, branche `main`.
3. **Add file → Upload files** : glisse le contenu du dossier décompressé à la racine du dépôt, sans dossier englobant supplémentaire. Ne supprime pas les autres fichiers existants.
4. **Commit changes**, puis attends le déploiement Render, ou utilise **Manual Deploy → Deploy latest commit**.

Aucune nouvelle variable Render n’est nécessaire pour ce changement. Conserve celles déjà configurées. La migration `migrations/0005_fixed_sides.sql` ajoute automatiquement le suivi des refus dans Neon au démarrage. Les anciens accords sont conservés comme acceptés.

Si les mises à jour précédentes n’avaient pas encore été installées, consulte aussi leurs notices : `INSTRUCTIONS-COMPTES-ET-PARIS.md` et `INSTRUCTIONS-RECUPERATION-EMAIL.md`.

## Validation

Compilation TypeScript et build de production. Tests sur base temporaire : refus de changement de camp pour le créateur et les participants, refus de quitter/rejoindre, adhésion identique sans changement de version, refus d’enjeu conservé et bloquant le lancement, passage d’un refus à une acceptation sans changer de camp, rejet des réponses sur une ancienne proposition et refus de modifier un pari déjà lancé. Les parcours de création, archivage, clôture et reprise des données existantes restent testés.

Le code est fourni prêt à déployer ; le service Render en ligne n’a pas été modifié directement.
