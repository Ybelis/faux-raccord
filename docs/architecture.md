# Architecture

Faux Raccord relie les mentions d'un même accessoire dans un scénario et propose des points de continuité à relire. La génération ne décide pas à la place du scripte : chaque point conserve deux passages sources et une décision humaine distincte.

## Composants et circulation des données

```mermaid
flowchart LR
  Personne["Utilisateur"] --> UI["Interface React"]
  UI <--> Stockage["IndexedDB · appareil de l'utilisateur"]
  UI --> API["API locale Node.js"]
  API --> Import["Import PDF / texte et segmentation"]
  API --> Pipeline["Extraction et comparaison"]
  API --> Recherche["Recherche BM25"]
  API --> Bibliotheque["MovieSum · catalogue et import explicite"]
  Pipeline --> Adaptateur["Adaptateur de modèle"]
  Recherche --> Adaptateur
  Adaptateur --> Groq["Groq · service externe"]
  Adaptateur --> Ollama["Ollama · machine locale"]
  UI --> Export["Projet JSON / rapport Markdown"]
```

Le serveur lit les secrets dans son environnement. Le navigateur reçoit la disponibilité du fournisseur, les résultats et les mesures d'exécution. Il ne reçoit pas la clé. Avec Groq, les scènes sélectionnées et les extraits utiles quittent la machine. Avec Ollama, le moteur tourne sur la machine qui exécute le serveur local. Les documents restent aussi dans IndexedDB ; ce stockage n'est ni une sauvegarde distante ni une synchronisation d'équipe.

Le même cœur ESM peut être compilé dans un Worker. Le développement et les vérifications actuelles se font en local ; la publication n'est pas nécessaire pour exécuter le produit.

## Analyse de continuité

```mermaid
flowchart TD
  Texte["Scènes avec identifiants et pages"] --> Lots["Lots de 3 scènes"]
  Lots --> Extraction["LLM · accessoires et mentions en JSON"]
  Extraction --> Validation["Validation des champs et des citations"]
  Validation --> Objets["Regroupement prudent des objets"]
  Objets --> Candidats["Règles · état ou possession incompatibles"]
  Candidats --> BM25["BM25 · passages du même scénario"]
  BM25 --> Comparaison["LLM · expliqué / ambigu / contradiction"]
  Comparaison -->|"expliqué"| Ecarte["Aucun point affiché"]
  Comparaison -->|"ambigu ou contradiction"| Revue["Deux passages, question et décision humaine"]
  Revue --> Enregistrer["Décision et note enregistrées sur l'appareil"]
```

Une mention absente ne crée jamais à elle seule un candidat. Les changements d'état examinés sont ceux du dictionnaire explicite de `findCandidates()`, par exemple brisé → intact ou vide → plein. Ce dictionnaire ne couvre pas tous les changements possibles. Une réparation ou un remplissage explicite peut annuler un candidat. Les ellipses, flashbacks et transferts restent une source d'erreurs.

Les noms connus sont réinjectés dans les lots suivants pour réduire les variations de nommage. Le regroupement ne garantit pas l'identité physique : deux objets peuvent être confondus, ou un seul objet peut rester séparé sous deux noms.

## Questions sur le scénario

```mermaid
flowchart LR
  Question["Question"] --> Recherche["BM25 · 5 passages au maximum"]
  Recherche -->|"aucun passage"| Absence["NOT FOUND"]
  Recherche --> Generation["LLM · réponse et identifiants de sources"]
  Generation --> Verification["Contrôle des identifiants cités"]
  Verification -->|"source inexistante ou réponse sans citation"| Absence
  Verification -->|"sources connues"| Reponse["Réponse et extraits consultables"]
```

La recherche découpe chaque scène en passages de 1 000 caractères au maximum, avec 150 caractères de recouvrement. Les limites de scène sont conservées. Ces valeurs sont des choix initiaux : aucune étude comparative de tailles de passages n'a encore démontré qu'elles sont optimales.

Le RAG est lexical, sans embeddings ni entraînement des poids. Il privilégie les noms et accessoires explicitement mentionnés. Il peut manquer une paraphrase ou une question française sur un texte anglais. La présence d'un identifiant valide ne prouve pas que la réponse est sémantiquement justifiée ; l'utilisateur garde accès à l'extrait pour le vérifier.

## Frontières de confiance

| Frontière | Contrôle | Limite restante |
|---|---|---|
| Fichier importé | Formats, taille, pages, volume de texte ; PDF sans évaluation de scripts | Pas d'OCR ; segmentation imparfaite |
| Texte fourni au LLM | Instructions des documents traitées comme données ; absence de clé dans les prompts | Résistance aux injections non garantie |
| Extraction LLM | Schéma contrôlé et recherche des citations dans la scène | La correspondance normalise espaces, casse et accents ; elle ne valide pas l'interprétation |
| Réponse à une question | Rejet des identifiants absents des passages fournis et des réponses sans citation | Une source existante peut être mal interprétée |
| Point de continuité | Deux passages, statut et note de revue séparés | Couverture limitée et erreurs possibles du modèle |
| Partage | Export explicite par l'utilisateur ; aucune action automatique vers un tiers | L'export est un fichier à gérer par l'équipe |

## Repères dans le code

| Composant | Fichier |
|---|---|
| Interface et parcours | `src/main.jsx`, `src/components/`, `src/styles.css` |
| Stockage et exports | `src/storage.js` |
| Scènes, pages et citations | `src/core/parser.js` |
| Découpage des passages et BM25 | `src/core/retrieval.js` |
| Contrats de génération | `src/core/prompts.js` |
| Extraction, candidats, comparaison, questions | `src/core/pipeline.js` |
| Fournisseurs et requêtes du modèle | `src/core/model.js` |
| Routes et limites HTTP | `worker/api.js` |
| Catalogue et provenance des imports externes | `worker/sources.js` |
| Exécution locale et compilation | `scripts/dev.mjs`, `scripts/build.mjs` |

La séparation de ces fonctions prépare une éventuelle extension agentique. Aucun agent autonome, outil d'envoi ou planificateur n'est annoncé comme déjà réalisé.
