# Faux Raccord

**Un atelier de continuité pour les petites équipes de tournage.** Importez un
scénario, suivez les accessoires et leurs états, puis relisez chaque point
signalé avec ses passages sources. L'utilisateur confirme ou écarte les alertes.

## Lancer le projet

Prérequis : **Node.js 24+**, npm et une clé Groq. Aucun environnement Python
n'est nécessaire pour exécuter l'application. Python sert seulement à reproduire
l'extraction initiale du corpus.

```powershell
cd faux-raccord
npm ci
Copy-Item .env.example .env  # seulement si .env n'existe pas
# Renseigner GROQ_API_KEY dans .env, sans ajouter ce fichier à Git.
npm run dev
```

Ouvrir **http://127.0.0.1:4173**. La clé reste côté serveur et n'est pas renvoyée
au navigateur. Les dépendances sont figées dans `package-lock.json`.

Pour une analyse locale : démarrer Ollama, installer `qwen3:1.7b` ou adapter
`OLLAMA_MODEL`, puis sélectionner Ollama dans les paramètres. Le mode hébergé
ne peut pas accéder à l'Ollama de votre ordinateur.

## Utilisateur et problème

Public visé : scriptes et petites équipes de courts métrages préparant un
tournage. Le problème est le suivi manuel d'accessoires, de leurs états et de
leurs propriétaires au fil des scènes. La valeur proposée est un suivi
consultable et des alertes vérifiables. **Aucun entretien utilisateur n'a encore
été réalisé** : tester l'utilité avec une personne concernée reste une étape
du groupe, pas un résultat acquis.

## Ce qui fonctionne

- Import PDF avec texte, TXT, Fountain, Markdown, ou restauration d'un projet.
- Découpage des scènes, conservation des pages sources et lecture du texte.
- Extraction LLM structurée des accessoires et de leurs mentions.
- Recherche BM25 dans des passages de 1 000 caractères, recouvrement de 150.
- Recherche des changements incompatibles, puis comparaison par le modèle.
- Rejet des citations absentes du texte et des identifiants inventés.
- Fiches d'accessoires, chronologie, revue humaine avec notes et statuts.
- Questions sur le scénario avec citations, ou `NOT FOUND`.
- Sauvegarde sur l'appareil et export JSON/rapport Markdown pour le groupe.
- Interface responsive en React, sans Streamlit.

## Fonctionnement et choix techniques

```text
PDF/TXT → scènes et pages → extraction JSON par lots de 3 scènes
        → validation exacte des citations → suivi des accessoires
        → candidats de continuité → recherche BM25 des passages associés
        → comparaison LLM → alertes sourcées → décision de l'utilisateur
```

Le modèle par défaut est `openai/gpt-oss-20b` via Groq, proposé dans le starter.
Il est accessible par une API compatible avec les échanges chat structurés.
L'API n'expose pas de snapshot immuable des poids : le modèle, la date, les
prompts et les tokens de chaque exécution sont enregistrés. Le choix sera à
revoir si le benchmark ou le test utilisateur le justifie.

L'extraction conserve les noms canoniques d'un lot à l'autre. Des objets
génériques de propriétaires différents ne sont pas fusionnés sans indice de
transfert. Le détecteur n'infère jamais une disparition à partir d'une absence
de mention. Une réparation ou un remplissage explicite peut lever un candidat.
Le second passage LLM examine aussi les extraits retrouvés pour éviter de
prendre une ellipse ou un flashback pour une contradiction.

BM25 a été retenu pour une première version explicable, reproductible et sans
base vectorielle supplémentaire. Il est moins adapté aux paraphrases ou aux
questions dans une autre langue. Une recherche hybride avec embeddings reste
une amélioration à mesurer, pas une fonctionnalité annoncée comme acquise.

Le frontend est en React/Vite. Le backend ESM utilise les mêmes fonctions en
local et dans un Cloudflare Worker. Les projets sont enregistrés dans
IndexedDB **sur l'appareil** ; ils ne se synchronisent pas entre navigateurs.
Les exports JSON permettent le partage. Aucun compte collaboratif n'est simulé.

## Données

Le corpus réel embarqué est **Valkaama**, scénario de Tim Baumann, d'après
Hendrik Behnisch, version 2007-06-30 : **56 scènes**, CC BY-SA 3.0. Les pages
et l'attribution sont conservées. Voir [data/README.md](data/README.md).

**Les Heures Creuses** est une fiction synthétique contrôlée de 12 scènes. Elle
illustre des changements inexpliqués et des transitions normales. Ce n'est pas
un film réel et ses incohérences ne sont pas attribuées à Valkaama.

Des analyses réellement exécutées avec Groq sont fournies pour les deux
scénarios. Elles sont marquées « Analyse enregistrée » dans l'interface. Une
nouvelle analyse appelle réellement le modèle et remplace ce résultat.

## Évaluation et sécurité

```powershell
npm test                       # tests automatiques déterministes
npm run eval                   # vérification du jeu de test, aucun faux score
npm run eval:live               # 50 cas de test réservés, appels Groq réels
node --env-file=.env eval/run.mjs --live --dev # 10 cas de développement
node eval/retrieval-real.mjs    # 12 recherches dans le corpus réel
node --env-file=.env eval/red-team.mjs
npm run build
```

Le jeu comporte 60 cas synthétiques contrôlés : **10 développement / 50 test**.
La baseline reçoit les mêmes textes avec un prompt simple. Le système utilise
l'extraction, la recherche et la comparaison. Les rapports contiennent les
prédictions, erreurs, tokens, latences et intervalles de Wilson à 95 %.
Les annotations proposées avec assistance IA doivent être relues par le groupe.
Ne pas présenter un score synthétique comme une performance validée sur des films.

Voir [le rapport](docs/evaluation_report.md), [la fiche système](docs/system_card.md),
[la politique d'utilisation](docs/use_policy.md) et [le journal de sécurité](docs/red_team_log.md).

## Organisation du code

| Fichier | Responsabilité |
|---|---|
| `src/main.jsx`, `src/styles.css` | Interface et flux de revue |
| `src/storage.js` | Sauvegarde locale et export |
| `src/core/parser.js` | Scènes et provenance des citations |
| `src/core/retrieval.js` | Découpage des passages et BM25 |
| `src/core/model.js` | Appels Groq/Ollama, erreurs et JSON |
| `src/core/prompts.js` | Prompts versionnés |
| `src/core/pipeline.js` | Extraction, validation, suivi, comparaison, questions |
| `worker/api.js` | Routes HTTP et limites d'import |
| `scripts/dev.mjs`, `scripts/build.mjs` | Exécution locale et compilation |
| `eval/` | Cas, référence et résultats mesurés |
| `tests/` | Régressions du cœur et import du vrai PDF |

## Limites

Analyse du **texte**, pas des images du film. PDF scannés sans OCR non pris en
charge. L'ordre des scènes n'est pas toujours l'ordre de l'histoire. Le modèle
peut manquer un objet, nommer différemment deux mentions ou mal interpréter un
transfert. La comparaison n'assure pas une détection exhaustive ; les alertes
restent des points de relecture. Les quotas Groq peuvent ralentir l'analyse.
L'import accepte 5 Mo et 160 pages, le texte 180 000 caractères et une analyse
jusqu'à 60 scènes sélectionnées.

## Outils IA utilisés

| Outil | Usage |
|---|---|
| Codex | Cadrage, recherche des données, code, interface, tests, cas et documentation |
| Groq / gpt-oss-20b | Moteur du produit et exécutions de l'évaluation |
| Canva | Scoping canvas et support de pitch |

Chaque membre devra comprendre le code, les données et les métriques avant
l'oral. Les annotations ne sont pas réputées validées par une personne réelle.

## Équipe de trois — à renseigner

| Membre | Travail principal proposé | Relecture croisée |
|---|---|---|
| À renseigner | Données, segmentation et cas de test | Pipeline et sources |
| À renseigner | Extraction, recherche et modèle | Interface et métriques |
| À renseigner | Interface, évaluation et démonstration | Données et protections |

## Démonstration de cinq minutes

1. Ouvrir Valkaama, expliquer l'origine et la licence du corpus.
2. Ouvrir Les Heures Creuses en précisant sa nature synthétique.
3. Consulter un accessoire puis les deux extraits d'une alerte.
4. Confirmer ou écarter un point et sauvegarder une note.
5. Montrer une question sans réponse, le benchmark et une limite réelle.

Préparer un enregistrement local de secours pour le rendu. Le projet se prête
ensuite à une extension agentique avec outils explicites d'import, de recherche
et de revue ; aucune action vers un tiers n'est automatisée actuellement.
