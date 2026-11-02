# À quoi servent les tests ?

Un test automatique exécute une petite situation et vérifie un résultat précis. Par exemple : « cette citation n’existe pas dans le texte, donc elle ne doit jamais devenir une preuve ». Il peut protéger une règle du code sans appeler de LLM. Un benchmark, lui, compare des sorties du modèle à des références sur plusieurs cas. Les deux sont nécessaires, mais répondent à des questions différentes.

## Tests du logiciel : `npm test`

Les fichiers de [tests](../tests/) utilisent le module de test intégré à Node.js. Le résumé final donne le nombre exact de tests, leurs succès et leurs échecs. Le nombre peut évoluer quand on ajoute une régression ; il ne faut pas apprendre un total sans lire la sortie de la version présentée.

| Fichier | Responsabilité vérifiée | Exemple d’entrée et résultat attendu |
|---|---|---|
| [api.test.mjs](../tests/api.test.mjs) | Routes, import et limites | Le vrai PDF Valkaama devient 56 scènes ; une analyse sans autorisation est refusée ; la réponse de statut ne contient pas la clé |
| [core.test.mjs](../tests/core.test.mjs) | Parseur, citations, objets, recherche et décisions du pipeline | Une citation inventée est rejetée ; une réparation explique un changement ; ne pas mentionner un objet ne prouve pas sa disparition |
| [model.test.mjs](../tests/model.test.mjs) | Requêtes Groq/Ollama et paramètres | Le plafond de tokens choisi apparaît dans la requête ; une URL arbitraire du client ne redirige pas le fournisseur ; annulation et dépassement de délai sont distingués |
| [project-import.test.mjs](../tests/project-import.test.mjs) | Réimport d’une sauvegarde JSON | Une décision et sa note sont conservées ; deux scènes de même identifiant ou une preuve falsifiée font refuser le fichier |
| [sources.test.mjs](../tests/sources.test.mjs) | Import MovieSum et provenance | Les repères XML restent des repères XML ; une adresse distante arbitraire est refusée ; un extrait est explicitement borné |
| [qa-checkpoint.test.mjs](../tests/qa-checkpoint.test.mjs) | Reprise équitable de l’évaluation | Une réponse du modèle fausse selon la grille est conservée ; une erreur réseau reste réessayable ; une autre configuration ne réutilise pas les anciens résultats |
| [evaluation.test.mjs](../tests/evaluation.test.mjs) | Cohérence des chiffres affichés | Les quatre comptes sont recalculés depuis les prédictions individuelles ; aucun signalement ne produit pas une précision artificielle de 100 % |
| [rate-pacing.test.mjs](../tests/rate-pacing.test.mjs) | Respect des limites de débit | Les durées de renouvellement du quota sont lues sans changer le contenu envoyé au modèle |

### Exemple : empêcher une fausse preuve

1. Le texte fourni dit que le verre de la montre est brisé.
2. Le faux modèle de test répond avec une citation disant que la montre est bleue et neuve.
3. `validateExtraction()` appelle `locateQuote()`.
4. La citation est introuvable : elle est rejetée et n’entre pas dans les objets suivis.

Le test protège ce contrôle précis. Il ne prouve pas que la citation retrouvée est correctement interprétée. Un modèle pourrait citer une phrase réelle et se tromper sur son sens.

### Exemple : ne pas inventer une disparition

Un chargeur est dans la main d’un personnage dans la première scène. La scène suivante ne décrit ni le personnage ni le chargeur. Le résultat attendu est l’absence de candidat de disparition. Le code ne transforme pas un silence du scénario en fait nouveau.

### Exemple : ne pas tricher avec la reprise

Le fournisseur renvoie une réponse valide mais fausse. Le checkpoint conserve cette sortie, avec son temps et ses tokens, et la reprend telle quelle. Il ne relance pas jusqu’à obtenir une bonne réponse. Une erreur de transport ou de quota peut être retentée, car elle n’a pas fourni de réponse exploitable. Un JSON invalide produit par le modèle est un échec de contenu conservé.

## Vérifications de navigateur

Lancer d’abord `npm run dev`, puis les scripts dans un deuxième terminal. Ils utilisent un navigateur réel : Chrome installé ou Chromium de Playwright. Le README indique comment configurer son chemin si nécessaire.

```powershell
node scripts/check-ui.mjs
node scripts/check-flows.mjs
node scripts/check-experience.mjs
node scripts/check-evaluation.mjs
```

| Script | Ce qu’il vérifie |
|---|---|
| [check-ui.mjs](../scripts/check-ui.mjs) | Les trois étapes sont accessibles et les pages ne débordent pas à 1 440, 768, 390 et 360 pixels |
| [check-flows.mjs](../scripts/check-flows.mjs) | Notes, décisions, rechargement, IndexedDB, export, liens sources et vrai import Fountain ; parcours de question et d’analyse avec réponses de test |
| [check-experience.mjs](../scripts/check-experience.mjs) | Thèmes et préférence système, clavier et focus des fenêtres, réglages par fournisseur, consentement, périmètre et guide isolé qui restaure le projet |

Les réponses de modèle ou de bibliothèque simulées dans ces scripts sont des **fixtures**, c’est-à-dire des réponses fixées par le test. Elles permettent de contrôler le parcours sans dépendre d’Internet, du hasard du modèle ou d’un quota. Une réussite du parcours ne doit pas être présentée comme une nouvelle analyse Groq réussie. Les scripts produisent des comptes rendus et captures dans `artifacts/`, dossier ignoré par Git.

## Évaluations de la qualité

| Commande | Avec ou sans modèle ? | Ce qu’on regarde |
|---|---|---|
| `npm run eval` | Sans appel | Validité et séparation des cas du jeu synthétique ; aucun score inventé |
| `npm run eval:live` | Vrais appels | Baseline et pipeline sur 50 cas de test ; confusion, précision, rappel, F1, tokens et latence |
| `node eval/qa-real.mjs` | Sans appel ni clé | Les citations de référence des questions réelles existent dans le corpus |
| `node --env-file=.env eval/qa-real.mjs --live` | Vrais appels | Réponses et références, cas sans réponse ; checkpoint et état complet ou incomplet |
| `node eval/retrieval-real.mjs` | Recherche locale, sans LLM | La bonne scène figure parmi les cinq premiers résultats |
| `node --env-file=.env eval/red-team.mjs` | Vrais appels | Résistance observée à trois demandes adversariales ciblées |

Les commandes `--live` consomment le quota du fournisseur. Un test hors ligne peut passer alors qu’un appel réel est refusé pour quota ; ce n’est pas une contradiction entre les tests.

## Compilation et présentation

`npm run build` vérifie que l’interface et le serveur peuvent être compilés. `npm run format:check` vérifie une convention de mise en forme. Aucun de ces deux contrôles ne mesure la justesse du modèle.

La vidéo de secours utilise de vrais résultats enregistrés. Elle permet de montrer le parcours si le réseau est indisponible ; elle ne constitue pas une nouvelle exécution en direct. Pour répondre à « qu’avez-vous testé ? », toujours préciser **le comportement**, **l’entrée**, **le résultat attendu** et **la limite de ce que le test démontre**.
