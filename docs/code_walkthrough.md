# Lire le code et expliquer une analyse

Ce guide suit un exemple jusqu'à sa décision de revue. Il sert à préparer l'oral : chaque membre doit pouvoir retrouver les fonctions, expliquer leurs entrées et reconnaître ce qu'elles ne garantissent pas.

## Point de départ

L'exemple suivant est fictif, comme celui de `tests/core.test.mjs` :

```text
1. INT. ATELIER - JOUR
Alice laisse tomber sa montre. Le verre de la montre est brisé.

2. EXT. COUR - JOUR - CONTINU
Alice regarde la même montre. Son verre est intact.
```

Le produit ne compare pas deux images. Il cherche si deux descriptions textuelles du même objet semblent incompatibles.

## 1. Lire le document

`worker/api.js` reçoit le fichier. Pour un PDF, `unpdf` extrait le texte page par page ; pour du texte, l'application lit directement les caractères. Le serveur contrôle le format, la taille et le nombre de pages.

`parseScreenplay()` dans `src/core/parser.js` repère les en-têtes INT./EXT. et produit les scènes `S001` et `S002`. Une scène contient son texte, son titre, ses pages et les segments de texte correspondant à ces pages. Si les en-têtes ne sont pas reconnus, le parseur effectue un découpage de secours et signale un avertissement : il faut le relire.

Un PDF sans texte exploitable est refusé. Aucun OCR ne reconstitue un scan.

## 2. Obtenir des mentions structurées

`analyze()` dans `src/core/pipeline.js` envoie des lots de trois scènes au modèle. Le prompt `EXTRACT_PROMPT` demande un JSON contenant les objets, leurs noms et leurs mentions : scène, citation, état, propriétaire, action et repère temporel.

Pour l'exemple, une sortie utile comporterait deux mentions de la montre : `broken` dans `S001`, puis `intact` dans `S002`. Ce résultat n'est jamais assuré : le modèle peut manquer une mention, inventer une citation ou mal attribuer un propriétaire.

`validateExtraction()` limite les champs et appelle `locateQuote()` pour chercher chaque citation dans sa scène. La recherche normalise casse, espaces, apostrophes et accents. Une citation absente est rejetée et le compteur de preuves rejetées augmente. Une citation retrouvée prouve l'existence du passage, pas la justesse de l'état interprété.

## 3. Suivre le même objet

`mergeObjects()` regroupe les mentions de noms canoniques compatibles et les trie dans l'ordre des scènes. Des noms connus sont fournis aux extractions suivantes pour favoriser la cohérence. Une protection évite certains regroupements d'objets génériques appartenant à des personnes différentes.

Ce traitement reste heuristique. Le nom « montre » n'est pas une preuve absolue d'identité ; inversement, deux noms différents peuvent désigner la même montre sans être réunis.

## 4. Créer un candidat

`findCandidates()` compare les mentions successives. Le dictionnaire `OPPOSITE` contient notamment `broken → intact`. La montre crée donc un candidat. Une mention de réparation explicite peut annuler ce changement grâce à `RESET`.

Il faut distinguer trois situations :

| Texte | Comportement attendu |
|---|---|
| Montre brisée, puis même montre intacte dans une continuité explicite | Créer un candidat à vérifier |
| Montre brisée, réparée, puis intacte | Transition expliquée |
| Montre brisée, puis scène qui ne parle pas de montre | Ne rien conclure sur sa présence ou son état |

Le détecteur ne couvre pas tous les changements possibles. Les catégories et directions examinées sont dans `OPPOSITE`, les transitions reconnues dans `RESET`. Ce périmètre doit être expliqué avant d'annoncer une extension.

## 5. Chercher le contexte et comparer

`retrieve()` dans `src/core/retrieval.js` recherche les noms de l'accessoire dans les scènes situées entre les deux mentions. Le découpage utilise des passages de 1 000 caractères au maximum, avec 150 caractères de recouvrement ; BM25 classe les passages et en conserve cinq au maximum.

Le prompt `JUDGE_PROMPT` reçoit le candidat, ses deux mentions et ce contexte. Il renvoie `explained`, `ambiguous` ou `contradiction`. Un résultat expliqué n'apparaît pas dans les points à relire. Une ambiguïté ou un repère temporel incertain est présenté plus prudemment.

Cette étape peut mal comprendre un flashback ou manquer une restitution implicite. L'analyse existante a justement un faux positif sur un retour dans le passé et quatre faux négatifs de possession dans son jeu synthétique réservé.

## 6. Faire relire et conserver la décision

L'interface présente les deux passages, leur scène et leur page. L'utilisateur confirme ou écarte le point, puis peut ajouter une note. `src/storage.js` enregistre le projet dans IndexedDB ; le rapport Markdown et le projet JSON sont des exports explicites.

Une confirmation utilisateur ne modifie pas les poids du modèle et ne réentraîne pas le détecteur. Elle conserve une décision de travail dans ce projet.

## 7. Répondre à une question

`answerQuestion()` suit un autre parcours : recherche BM25 sur les scènes fournies, génération à partir des passages, puis contrôle des identifiants cités. L'absence de passage, une réponse sans citation ou un identifiant inventé conduit à `NOT FOUND`.

Une réponse avec des sources valides peut encore être fausse. Le contrôle vérifie l'appartenance des identifiants, pas l'implication logique du texte. C'est la raison d'afficher les extraits et de tester des questions sans réponse.

## Où modifier quoi ?

| Modification souhaitée | Point d'entrée | Vérification nécessaire |
|---|---|---|
| Fournisseur, modèle ou paramètres d'inférence | `src/components/ModelSettings.jsx`, `src/model-settings.js`, `src/core/model.js` et configuration serveur | Appel de connexion, JSON, limites du modèle et nouvelle évaluation |
| Instructions de génération | `src/core/prompts.js` | Nouvelle version des prompts ; ne pas réutiliser un score d'une autre version |
| Taille des passages ou recherche | `src/core/retrieval.js` | Références réelles de recherche et questions multilingues |
| Nouvel état ou nouveau changement | `src/core/pipeline.js` et contrat du prompt | Cas positif, transition normale, absence d'information, test indépendant |
| Découpage d'un autre format de scénario | `src/core/parser.js` | Vérifier scènes et pages sur un vrai fichier |
| Nouveau jeu de test | `eval/` | Source, droit d'usage, jugement humain, séparation développement/test |
| Nouveau catalogue externe | `worker/sources.js`, `src/components/SourceBrowser.jsx` | Droits, provenance, bornes de téléchargement et indisponibilité du service |
| Texte ou disposition du produit | `src/main.jsx`, `src/components/`, `src/styles.css` | Parcours complet et affichage mobile/clavier |

## Ce que mesurent les chiffres existants

Dans `eval/run.mjs`, un cas est prédit positif dès qu'au moins une alerte est produite. Les 17 vrais positifs et le faux positif donnent une précision **par cas signalé** de `17 / 18 = 94,4 %`. Les 17 cas détectés sur 21 positifs donnent un rappel de `17 / 21 = 81,0 %`. Cela ne signifie pas que 94,4 % de chaque alerte d'un long scénario sont correctes.

Le prompt simple obtient un F1 de 91,3 %, le système 87,2 %. Le pipeline réduit les fausses alertes dans ce jeu, au prix d'oublis, de tokens et de latence. Les données synthétiques, les annotations non encore relues et l'unique scénario réel limitent la portée de cette comparaison.

`eval/qa-real.mjs` évalue séparément des questions sur de vrais passages de Valkaama. Sa grille vérifie des éléments de réponse et la citation de la scène attendue, ou une abstention. Elle n'évalue pas la détection de continuité et reste une approximation automatique à relire.
