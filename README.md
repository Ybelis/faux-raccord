# Faux Raccord

Faux Raccord aide à relire la continuité des accessoires dans le texte d’un scénario. Il rassemble leurs mentions, compare les changements d’état ou de possession et présente les passages qui méritent une vérification. L’équipe confirme ou écarte chaque point et conserve ses notes.

Le produit traite le **texte**, pas les images du film. Un point signalé est une proposition de relecture ; il ne prouve pas à lui seul une erreur de continuité.

## Positionnement pour le rendu Generative AI

Faux Raccord est une **application d’IA générative avec RAG**, organisée en étapes définies dans le code. Le LLM génère les mentions structurées des accessoires, les explications des points à vérifier et les réponses sourcées. Le code contrôle les citations et conserve les décisions de l’utilisateur.

Le PDF distingue le rendu Generative AI du 3 novembre et le cours Agentic AI qui commence les 4–5 novembre. Le produit actuel correspond au premier rendu. Voir [la formulation du projet et les sorties générées](docs/positionnement-generatif.md).

## Lancer l’application

Prérequis : **Node.js 24 ou ultérieur**, npm. Une clé Groq ou une installation Ollama est nécessaire pour lancer de nouvelles inférences. Les exemples et leurs analyses enregistrées restent consultables sans nouvelle inférence.

Dans le dossier `faux-raccord` :

```powershell
npm ci
```

Si `.env` n’existe pas, le créer depuis `.env.example` puis renseigner la clé **côté serveur** :

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

Ouvrir **http://127.0.0.1:4173**. Ne pas écraser un `.env` déjà configuré ni l’ajouter à Git. Python n’est pas nécessaire pour exécuter le produit ; il sert uniquement au script historique de récupération de Valkaama.

## Utiliser le produit

1. **Scénario** : ouvrir un exemple, importer un fichier ou rechercher un film dans MovieSum. Vérifier le texte et le découpage des scènes.
2. **Analyse** : choisir les scènes, le fournisseur et le modèle, autoriser le traitement puis lancer l’analyse.
3. **Relecture** : comparer les deux passages d’un point, confirmer ou écarter celui-ci et conserver une note. Les accessoires et les questions au scénario complètent cette étape.

Le **guide interactif** se relance depuis le menu et utilise une copie séparée de l’exemple. Les thèmes Papier, Ardoise et Système adaptent l’affichage. Les résultats d’évaluation sont accessibles depuis Documentation → Résultats d’évaluation.

Les projets sont conservés dans **IndexedDB sur cet appareil**. Ils ne se synchronisent pas entre les membres du groupe. Le projet JSON permet de sauvegarder et transmettre le travail ; le rapport Markdown conserve les points, citations et décisions. Une nouvelle analyse remplace le résultat précédent après confirmation.

## Comprendre le code et les chiffres

Pour préparer la présentation, commencer par ces trois documents :

- [Comprendre les résultats](docs/comprendre-les-resultats.md) : les 17 cas signalés correctement, la fausse alerte, les quatre cas manqués et les calculs correspondants.
- [Suivre une analyse dans le code](docs/code_walkthrough.md) : du document importé à la décision humaine.
- [Préparer la démonstration et les questions](docs/preparer-demain.md) : parcours de cinq minutes et travail réel à répartir entre trois membres.

Une démonstration du code peut aussi être exécutée sans clé :

```powershell
npm run explain
```

Ce script utilise le vrai parseur et le vrai pipeline, avec des **sorties de modèle simulées et annoncées**. Il affiche les scènes, les mentions validées, le candidat et ses preuves. Il explique le traitement ; il ne mesure pas la qualité d’un LLM.

## Fonctionnement

```text
Document → scènes et pages → extraction JSON par le LLM
         → contrôle des citations → suivi des accessoires
         → candidats d’état ou de possession → recherche BM25
         → comparaison par le LLM → relecture et décision humaine
```

Le parseur, la recherche, les appels de modèle et les décisions de continuité sont séparés dans `src/core/`. Les composants React sont dans `src/components/`, les routes dans `worker/` et la sauvegarde dans `src/storage.js`.

BM25 classe des passages de 1 000 caractères au maximum, avec un recouvrement de 150 ; cinq passages sont retenus au maximum. Le choix rend la recherche légère et explicable, mais ne résout pas toutes les paraphrases ou traductions. Aucune LoRA n’est utilisée. Une absence de mention ne suffit jamais à conclure qu’un objet a disparu.

Voir [les diagrammes et frontières de confiance](docs/architecture.md). Le même cœur ESM fonctionne avec le serveur local et peut être compilé dans un Worker. Aucune publication n’est nécessaire pour utiliser le projet.

## Fournisseurs et modèles

La référence du benchmark de continuité est **`openai/gpt-oss-20b` sur Groq**, température 0 et raisonnement `low`. Le modèle est accessible sans GPU local et fournit les réponses structurées demandées. Ce choix n’est pas issu d’une comparaison exhaustive de modèles.

Les réglages permettent de consulter le catalogue, de saisir un identifiant, de conserver une préférence par fournisseur et de tester une réponse JSON sans transmettre de scénario.

| Réglage | Utilité et limite |
|---|---|
| Température | Réduit ou augmente la variation ; 0 ne garantit pas une sortie identique |
| Plafond de sortie | Limite les tokens générés ; une limite trop basse peut couper le JSON |
| Raisonnement GPT-OSS | Faible, moyen ou élevé ; peut modifier coût et attente |
| Contexte Ollama | Mémoire disponible pour le texte, selon le modèle et la machine |

Les nouveaux résultats conservent les paramètres effectifs. **Une autre configuration n’hérite pas des scores du modèle de référence.** Les dépendances sont fixées dans le lockfile ; l’API Groq ne fournit pas un snapshot immuable des poids.

Ollama doit tourner sur la machine qui exécute le serveur. Les vérifications réelles de Qwen 1.7B et Llama 3.2 ont réussi pour la connexion JSON et une question sourcée. Leur extraction de l’exemple testé a échoué : les citations recopiées du contrat ont été rejetées. Le produit signale ce résultat inexploitable. Voir [les vérifications locales mesurées](eval/local-validation.json). Pour la démonstration de continuité, privilégier la configuration Groq évaluée et les analyses enregistrées.

## Données et sources

| Source | Contenu et usage |
|---|---|
| **Valkaama** | Vrai scénario de Tim Baumann d’après Hendrik Behnisch, version du 30 juin 2007, CC BY-SA 3.0 ; 56 scènes avec leurs pages |
| **Les Heures Creuses** | Fiction synthétique de démonstration ; ses incohérences ne sont pas attribuées à Valkaama |
| **MovieSum** | Index local de 2 200 titres/IMDb ; recherche hors ligne par titre, aperçu et import en ligne à la demande |

L’index MovieSum ne contient ni texte de scénario ni résumé. Les textes importés conservent leur provenance, leur portée et leurs repères XML, qui ne sont pas des pages PDF. La licence CC BY-NC 4.0 déclarée pour le dataset ne garantit pas les droits sur chaque œuvre sous-jacente. Les exports contenant un scénario restent soumis à ses conditions de redistribution.

Sources, attributions et transformations : [data/README.md](data/README.md). Les analyses fournies avec les exemples proviennent d’exécutions réelles et sont identifiées comme **analyses enregistrées**.

## Évaluer et tester

Les tests du logiciel et la mesure de qualité du modèle répondent à des questions différentes. Le [guide des tests](docs/tests.md) donne les fichiers, les entrées et les résultats attendus.

| Vérification | Ce qu’elle mesure |
|---|---|
| Tests automatiques et navigateur | Comportement du code et des parcours, avec fournisseurs simulés quand nécessaire |
| 50 cas synthétiques réservés | Classification par cas : au moins un point signalé ou aucun point |
| 24 questions sur Valkaama | Réponse, référence et format, avec quatre informations absentes |
| 12 recherches dans Valkaama | Présence de la bonne scène dans les cinq premiers résultats |
| Trois essais adversariaux | Résistance observée à trois tentatives de détournement, sans garantie générale |

Sur les 50 cas synthétiques, les références proposées contiennent 21 positifs et 29 négatifs :

| Méthode | Précision par cas signalé | Rappel | F1 | Latence médiane |
|---|---:|---:|---:|---:|
| Prompt simple | 84,0 % | 100,0 % | 91,3 % | 0,508 s |
| Extraction + recherche + comparaison | 94,4 % | 81,0 % | 87,2 % | 6,426 s |

Le système obtient 17 vrais positifs, un faux positif, quatre faux négatifs et 28 vrais négatifs. La précision vaut `17/18`, le rappel `17/21`. **La baseline a un meilleur F1.** Le pipeline réduit les fausses alertes dans ce jeu, au prix d’oublis et d’appels supplémentaires. Un cas positif signalé compte comme vrai positif même si la pertinence de chaque alerte n’a pas été évaluée individuellement.

Ces exemples sont synthétiques, parfois proches des cas de développement, et leurs annotations ne sont pas une vérité métier validée. L’intervalle de Wilson à 95 % de la précision du système est 74,2–99,0 % ; il ne corrige pas ces biais. L’[audit des références](docs/annotation_review.md) vérifie la structure et les citations, sans se présenter comme une relecture humaine.

Rapports : [évaluation complète](docs/evaluation_report.md), [benchmark de continuité](eval/report.json), [questions réelles](eval/qa-real-report.json). Le rapport QA indique sa propre configuration ; ses résultats ne doivent pas être mélangés à ceux du benchmark de continuité.

La comparaison QA 120B est complète : **19/24 réponses conformes avec RAG, 16/24 avec le prompt simple**, quatre abstentions correctes dans chaque méthode. La grille automatique reste limitée ; les latences incluent les attentes de quota. Les réponses fausses ont été conservées lors de la reprise.

```powershell
npm test
npm run eval
node eval/qa-real.mjs
npm run format:check
npm run build
```

Les deux validations de jeux ci-dessus sont hors ligne. Pour relancer une mesure avec de vrais appels :

```powershell
npm run eval:live
node --env-file=.env eval/qa-real.mjs --live --model=openai/gpt-oss-120b
```

Ces commandes consomment des quotas. La QA reprend ses checkpoints uniquement à code, données, protocole, modèle et paramètres identiques ; les réponses incorrectes sont conservées. Un quota journalier arrête l’exécution. Détails : [guide de reproduction](eval/README.md).

Avec le serveur local ouvert, les parcours se vérifient dans un navigateur réel :

```powershell
node scripts/check-ui.mjs
node scripts/check-flows.mjs
node scripts/check-experience.mjs
node scripts/check-evaluation.mjs
```

`CHECK_BROWSER_PATH` permet de choisir Chrome/Chromium et `CHECK_BASE_URL` de changer l’adresse. Les fixtures de modèle sont explicitement signalées ; ces parcours ne constituent pas une mesure de qualité du LLM. `npm run format` applique la convention de mise en forme du dépôt.

## Préparer la présentation

Les retours internes déjà reçus portaient sur la confusion entre pages et le manque d’explications. Ils ont conduit au parcours en trois étapes, au guide et à la lecture détaillée des métriques. Ils ne prouvent pas un gain de temps pour une équipe de tournage.

Le PDF ne demande pas explicitement un professionnel extérieur. En l’absence de contact métier, le groupe peut réaliser le [test interne proposé](docs/test-interne.md) : des tâches observables, des critères décidés avant l’essai et les résultats réellement obtenus. Présenter sa portée comme un test de prise en main, sans inventer d’entretien ni de validation métier.

| Membre | Contribution effectivement réalisée | Commit ou vérification |
|---|---|---|
| À renseigner | | |
| À renseigner | | |
| À renseigner | | |

Les trois membres doivent comprendre le système entier. [L’audit du PDF](docs/requirements_audit.md) distingue les preuves disponibles des points restant à valider. [Git et contributions](docs/git-et-contributions.md) explique l’attribution réelle des commits. Les [questions de soutenance](docs/defense.md) couvrent données, choix techniques, métriques et échecs.

Le [rapport PDF de deux pages](docs/print/evaluation.pdf) et la [fiche système d’une page](docs/print/system-card.pdf) se régénèrent sans inférence :

```powershell
node scripts/write-evaluation-docs.mjs
node scripts/print-deliverables.mjs --pdf
```

Une vidéo de secours peut être produite avec `node scripts/record-demo.mjs`. Elle montre les analyses enregistrées, sans simuler une nouvelle inférence.

## Sécurité, limites et outils

Groq reçoit les scènes ou passages nécessaires aux appels ; Ollama permet un traitement local. La clé n’est jamais envoyée au navigateur. Les citations doivent exister dans leurs scènes ; les réponses ne sont pas exécutées comme du code. Les contrôles ne prouvent pas que l’interprétation est juste. Voir la [politique d’utilisation](docs/use_policy.md), la [fiche système](docs/system_card.md) et le [journal des essais adversariaux](docs/red_team_log.md).

Limites : texte uniquement, sans OCR ni vision ; chronologie non reconstruite ; identité des objets et transitions implicites imparfaites. Import : 5 Mo, 160 pages, 180 000 caractères. Analyse : jusqu’à 60 scènes et 120 000 caractères sélectionnés. La qualité des petits modèles locaux n’est pas équivalente à celle du modèle de référence.

| Outil | Usage déclaré |
|---|---|
| Codex | Recherche des sources, implémentation, interface, tests, propositions de cas et documentation |
| Groq / GPT-OSS | Inférence du produit et mesures enregistrées |
| Canva | Canvas de cadrage et support initial, conservés hors du dépôt applicatif |

L’assistance IA est déclarée comme demandé dans le cours. Une attribution Git ne remplace ni une contribution réelle ni la compréhension du code. Le code est sous [licence MIT](LICENSE) ; les données conservent leurs licences et attributions propres.
