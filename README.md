# Faux Raccord

Faux Raccord aide une équipe de tournage à relire la continuité des accessoires dans un scénario. Il rassemble leurs mentions, relève des changements d'état ou de possession et présente les passages à comparer. L'utilisateur confirme ou écarte chaque point et conserve sa note de revue.

Le produit analyse le texte du scénario. Il ne regarde pas les plans du film et ne garantit pas une détection exhaustive. Son utilité et le gain de temps restent à valider avec un scripte.

## Installation

Prérequis : **Node.js 24 ou ultérieur**, npm et, pour l'inférence, une clé Groq ou un serveur Ollama local. Python sert uniquement au script historique de récupération du corpus ; il n'est pas nécessaire pour lancer l'application.

Depuis le dossier `faux-raccord` :

```powershell
npm ci
```

Si le fichier `.env` n'existe pas encore, le créer depuis l'exemple, puis y renseigner la clé côté serveur :

```powershell
Copy-Item .env.example .env
```

```dotenv
GROQ_API_KEY=...votre clé...
GROQ_MODEL=openai/gpt-oss-20b
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
PORT=4173
```

```powershell
npm run dev
```

Ouvrir **http://127.0.0.1:4173**. La clé reste dans l'environnement du serveur ; elle n'est pas transmise au navigateur ni incluse dans les exports. Ne pas versionner `.env`.

Pour utiliser Ollama, démarrer son serveur et installer le modèle choisi, par exemple `ollama pull qwen3:1.7b`. L'inférence s'exécute sur la machine qui lance le serveur applicatif. La compatibilité et la licence d'un modèle différent sont à vérifier avant de l'employer.

## Utiliser l'application

Le parcours suit trois étapes :

1. **Scénario** : ouvrir un exemple ou importer un PDF avec texte, TXT, Fountain ou Markdown ; vérifier les scènes et leur découpage.
2. **Analyse** : choisir le moteur, le modèle et les scènes à examiner ; confirmer que leur traitement est autorisé ; lancer l'analyse.
3. **Relecture** : comparer les deux passages d'un point signalé, confirmer ou écarter ce point, puis ajouter une note. Les accessoires et les questions sur le texte complètent cette revue.

Un guide interactif peut être relancé depuis l'application. Les thèmes Papier, Ardoise et Système modifient l'affichage. Les résultats et la documentation restent séparés du parcours de travail.

Les exemples incluent des **analyses enregistrées**, réellement exécutées et signalées dans l'interface. Elles permettent d'explorer le produit sans attendre un appel. Lancer une nouvelle analyse appelle le modèle sélectionné et remplace le résultat du projet courant.

Les projets sont sauvegardés dans **IndexedDB sur cet appareil**. Ils ne se synchronisent pas entre les membres du groupe. Exporter le projet JSON pour le sauvegarder ou le transmettre ; le rapport Markdown conserve les points, les citations et les décisions de revue.

## Moteurs et réglages

La configuration de référence utilise `openai/gpt-oss-20b` sur Groq : température 0, raisonnement `low`. Le modèle est accessible sans GPU local et fournit les réponses JSON demandées. Ce choix est mesuré dans les rapports ; il n'est pas présenté comme le meilleur après une comparaison exhaustive de modèles.

Les réglages permettent de consulter les modèles disponibles chez le fournisseur, d'indiquer un identifiant et de vérifier une réponse JSON sans envoyer de scénario. Ce contrôle consomme une requête et, chez Groq, peut compter dans les quotas ou la facturation. Il vérifie la connexion et le format, pas la qualité métier.

| Réglage | Portée |
|---|---|
| Fournisseur et modèle | Groq ou Ollama local ; préférences conservées par fournisseur |
| Température | 0 à 1 ; 0 conseillé pour comparer les exécutions |
| Limite de sortie | Choix de 1 024 à 16 000 tokens ; des plafonds propres aux étapes s'appliquent aussi |
| Raisonnement | `low`, `medium`, `high` pour GPT-OSS sur Groq |
| Contexte Ollama | 4 096 à 131 072 tokens, selon les capacités du modèle et de la machine |

Les paramètres effectifs accompagnent les nouvelles analyses et leurs usages. **Changer le modèle ou les paramètres n'hérite pas des scores enregistrés.** Les dépendances sont fixées dans le lockfile ; l'identifiant Groq ne fournit pas un snapshot immuable des poids.

La connexion JSON Groq a été vérifiée sur la machine de développement. Le catalogue Ollama répond, mais le contrôle de `qwen3:1.7b` avec le contexte par défaut n’a pas abouti dans les 60 secondes prévues. Le fonctionnement de l’inférence locale reste donc à valider sur la machine de démonstration ; un modèle installé ne suffit pas à garantir une réponse dans ce délai.

## Architecture et choix

Le parseur conserve les scènes et pages. Le LLM extrait des mentions structurées ; le code rejette les citations introuvables, regroupe les objets et crée des candidats d'état ou de possession. BM25 retrouve les passages associés, puis le LLM compare les preuves. La décision finale reste distincte du résultat généré.

Le RAG lexical utilise des passages de 1 000 caractères avec un recouvrement de 150 et cinq résultats au maximum. Ces paramètres initiaux privilégient une implémentation légère et explicable ; ils n'ont pas encore fait l'objet d'une étude d'optimisation. Les paraphrases et les questions multilingues restent difficiles. Aucune LoRA n'est utilisée.

Le frontend React et l'API Node.js partagent un cœur ESM également compilable dans un Worker. Les fonctions d'import, de recherche, d'extraction, de comparaison et de stockage sont séparées.

- [Diagrammes et frontières de confiance](docs/architecture.md)
- [Suivre une analyse dans le code](docs/code_walkthrough.md)
- [Vérifier chaque exigence du PDF](docs/requirements_audit.md)
- [Préparer les questions et la démo](docs/defense.md)

## Données

**Valkaama** est un scénario réel de Tim Baumann, d'après Hendrik Behnisch, version du 30 juin 2007, publié sous CC BY-SA 3.0. Le corpus embarqué contient 56 scènes et conserve leurs pages. C'est une seule œuvre : elle ne représente pas la diversité des productions. Source, licence et transformations sont décrites dans [data/README.md](data/README.md).

**Les Heures Creuses** est une fiction synthétique de démonstration, avec des changements contrôlés et des transitions normales. Les 60 cas du benchmark de continuité sont eux aussi synthétiques et explicitement identifiés. Leurs incohérences ne sont jamais attribuées à Valkaama. Un jeu QA distinct pose des questions sur les vrais passages de ce scénario, sans en modifier les événements.

Les annotations assistées par IA doivent être relues par les étudiants. L'accès public à un autre scénario ne suffit pas à autoriser son intégration ou sa redistribution.

La bibliothèque externe donne aussi accès au catalogue MovieSum et à un import explicite. Aucun scénario MovieSum n'est embarqué dans ce dépôt ni utilisé pour les scores ci-dessous. La licence CC BY-NC 4.0 déclarée pour le jeu ne garantit pas les droits des œuvres sous-jacentes ; les conditions et la portée de chaque extrait restent à vérifier. Les repères XML ne sont pas des pages PDF. Voir [la provenance et les restrictions](data/README.md).

Le catalogue et l’import MovieSum ont été vérifiés avec de vraies requêtes. La recherche plein texte dépend de l’index Hugging Face, qui renvoyait une erreur serveur lors de la vérification ; la navigation par collection et pagination reste disponible. Valkaama reste accessible sans cette connexion.

## Évaluation

Le benchmark enregistré compare un prompt simple au pipeline sur les **mêmes 50 cas synthétiques réservés** ; dix autres cas servent au développement. Une prédiction est positive dès qu'au moins un point est signalé dans le cas.

| Méthode | Précision par cas signalé [IC 95 %] | Rappel | F1 | Latence médiane par cas |
|---|---|---|---|---|
| Prompt simple | 84,0 % [65,3–93,6] | 100,0 % | 91,3 % | 0,508 s |
| Extraction, recherche et comparaison | 94,4 % [74,2–99,0] | 81,0 % | 87,2 % | 6,426 s |

Le système réduit les fausses alertes de quatre à une, mais manque quatre cas positifs. **La baseline obtient un meilleur F1.** Ces scores ne valident ni la généralisation aux films réels ni la pertinence de chaque alerte d'un long scénario. Les intervalles n'éliminent pas le biais d'un jeu synthétique.

Deux vérifications réelles distinctes complètent cette mesure : douze recherches de scènes dans Valkaama et un jeu de 24 questions sourcées, dont quatre sans réponse. Le premier évalue la recherche ; le second compare QA avec recherche et prompt avec texte intégral sur les mêmes dix scènes. Sa grille automatique d'éléments de réponse et de citations reste à relire ; elle ne mesure pas la continuité.

```powershell
npm test
npm run eval
node eval/qa-real.mjs
node eval/retrieval-real.mjs
npm run build
```

`npm run eval` et `node eval/qa-real.mjs` vérifient leurs jeux sans fabriquer de score. Pour mesurer réellement l'inférence, avec une clé configurée et en consommant des appels :

```powershell
npm run eval:live
node --env-file=.env eval/qa-real.mjs --live
node --env-file=.env eval/red-team.mjs
```

L'évaluation QA reprend automatiquement avec la même commande `--live`.
Après chaque méthode, elle conserve un checkpoint dans `.local/` et actualise
le rapport. Les réponses fournisseur obtenues, y compris celles jugées fausses,
sont reprises uniquement si code, données, corpus, protocole, modèle et paramètres
correspondent. Les erreurs d'infrastructure ne sont pas mises en cache comme
réponses et peuvent être retentées. Un quota journalier identifié arrête
l'exécution ; attendre son renouvellement avant de reprendre.

Un JSON invalide est un échec de contenu : il est conservé et ne peut pas
être rééchantillonné jusqu'à obtenir une réponse correcte. Les tokens qui
ne sont pas disponibles pour cette réponse sont signalés séparément.

Un rapport `incomplete` distingue les questions prévues, celles terminées et
les erreurs fournisseur. Ses scores globaux restent `null` : une panne ou un
quota ne doit pas être présenté comme une performance du modèle. Les tokens
et latences des réponses reprises conservent leurs mesures d'origine ; les
compteurs indiquent séparément les méthodes reprises et nouvellement exécutées.
Le journal d'essais et les anciennes versions du rapport restent dans `.local/`.
Un ancien résultat ne partageant pas les empreintes du code courant reste une
preuve archivée, pas un résultat réutilisé sous une nouvelle version.

La commande `node eval/qa-real.mjs`, sans `--live`, vérifie les références hors
ligne, sans clé et sans appel au fournisseur.

Pour vérifier l’interface, laisser le serveur local ouvert et lancer les scripts suivants dans un second terminal. Ils utilisent Chrome ou Chromium ; `CHECK_BROWSER_PATH` permet d’indiquer son emplacement et `CHECK_BASE_URL` de changer l’adresse du serveur.

```powershell
node scripts/check-ui.mjs
node scripts/check-flows.mjs
node scripts/check-experience.mjs
npm run format:check
```

Les vérifications navigateur couvrent les parcours, les thèmes, le guide, le stockage et les exports. Leurs réponses de modèle et de bibliothèque sont des fixtures explicitement signalées ; elles ne mesurent pas la qualité du LLM. Les appels de référence et leurs résultats sont conservés séparément dans `eval/`.

`npm run format` applique la convention de mise en forme du dépôt. Les commentaires du cœur expliquent les choix de traitement ; le [parcours du code](docs/code_walkthrough.md) les relie à une analyse complète.

Rapports : [évaluation](docs/evaluation_report.md), [résultats de continuité](eval/report.json), [références QA réelles](eval/qa-real.json), [résultats adversariaux](eval/red-team-results.json). Les sorties mesurées conservent modèle, paramètres disponibles, date, tokens et version de code selon leur protocole. Les anciennes mesures appartiennent à leur configuration de référence.

Les versions paginées sont disponibles dans [le rapport PDF de deux pages](docs/print/evaluation.pdf) et [la fiche système PDF d'une page](docs/print/system-card.pdf). Pour les actualiser depuis les rapports JSON, sans appeler le modèle :

```powershell
node scripts/write-evaluation-docs.mjs
node scripts/print-deliverables.mjs --pdf
```

L'export PDF utilise Chrome installé sur Windows, ou le Chromium de Playwright sur une autre plateforme. `CHROME_PATH` peut désigner un exécutable différent. Sans `--pdf`, le script produit les HTML imprimables ; avec cette option, il vérifie aussi les nombres de pages et l'absence de chevauchement avec les pieds de page.

## Sécurité et limites

Les instructions d'un scénario sont traitées comme des données ; les sorties ne sont pas exécutées comme du code. Les citations extraites sont recherchées dans leurs scènes après normalisation. Les questions sans sources ou avec identifiants inventés conduisent à une abstention. Ces contrôles ne prouvent pas qu'une interprétation est juste ; chaque extrait reste consultable.

Groq reçoit les scènes sélectionnées ou extraits utiles aux appels. Pour un texte confidentiel, obtenir l'autorisation de transfert ou choisir l'inférence locale appropriée. L'équipe reste responsable des fichiers importés et exportés. Voir [politique d'utilisation](docs/use_policy.md), [fiche système](docs/system_card.md) et [journal de sécurité](docs/red_team_log.md).

Limites actuelles : texte uniquement, sans OCR ni vision ; chronologie narrative non reconstruite ; identité des objets heuristique ; dictionnaire de changements limité ; transferts implicites et flashbacks parfois mal interprétés. L'import accepte 5 Mo et 160 pages ; le texte est limité à 180 000 caractères, une analyse à 60 scènes et 120 000 caractères sélectionnés. Les quotas et la machine locale influencent l'attente.

## Équipe et préparation du rendu

Les trois membres doivent renseigner leurs contributions effectives, tester le produit sur leur machine et savoir expliquer le système entier. Les rôles proposés ne constituent pas une preuve du travail accompli.

| Membre | Contribution réelle | Relecture et vérifications réalisées |
|---|---|---|
| À renseigner | | |
| À renseigner | | |
| À renseigner | | |

Avant le rendu : rencontrer une personne concernée et convenir d'une cible utile ; relire les annotations ; vérifier les accès au dépôt ; répéter la démo de cinq minutes avec un échec ; tester la lecture de la vidéo de secours actualisée. Le [protocole de validation utilisateur](docs/user_validation.md) et la [matrice des exigences](docs/requirements_audit.md) distinguent les preuves actuelles des actions restantes.

La vidéo peut être réenregistrée avec `node scripts/record-demo.mjs` pendant que le serveur local tourne. Ce parcours utilise les analyses enregistrées, sans simuler de nouvel appel au modèle. Les vérifications de navigateur couvrent l'interface et incluent aussi des réponses HTTP de test explicitement prévues ; elles ne constituent pas une nouvelle mesure du LLM.

## Assistance IA

| Outil | Usage |
|---|---|
| Codex | Cadrage, recherche des sources, implémentation, interface, tests, propositions de cas et documentation |
| Groq / GPT-OSS | Inférence du produit et exécutions de référence de l'évaluation |
| Canva | Canvas de cadrage et support initial, conservés hors du dépôt applicatif |

Le groupe reste responsable des lignes de code, des données, des références et des conclusions. Aucune validation humaine n'est déduite de l'assistance IA.

## Licence

Le code est sous [licence MIT](LICENSE). Les données de Valkaama conservent leur attribution et leur licence CC BY-SA 3.0 ; la fiction de démonstration dispose de sa licence distincte. Voir [les précisions sur les données](data/README.md).
