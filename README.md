# Faux Raccord

Faux Raccord aide à relire la continuité des accessoires dans un scénario. Le
modèle extrait leurs mentions et explique les changements à examiner ; chaque
alerte donne accès à ses deux passages sources. Le lecteur confirme ou écarte
le point et conserve sa note.

C’est une **application d’IA générative avec RAG**, avec un parcours défini dans
le code. Elle analyse le texte, sans vision ni OCR. Une alerte est une proposition
de relecture, pas une erreur avérée.

## Lancer

Prérequis : **Node.js 24 ou ultérieur**, npm. Depuis ce dossier, lancer
**`start.bat` sous Windows** ou **`./start.sh` sous macOS/Linux**. Les scripts
préparent les dépendances et démarrent le serveur local.

Pour le faire manuellement :

```sh
npm ci
npm run dev
```

Ouvrir **http://127.0.0.1:4173**. Les exemples et les analyses enregistrées sont
consultables sans clé. Pour une nouvelle inférence, configurer Groq dans `.env`
à partir de [.env.example](.env.example), ou utiliser un modèle installé dans
Ollama sur la machine du serveur. Ne jamais ajouter `.env` à Git.

Le catalogue, l’identifiant du modèle et ses paramètres se règlent dans
l’application. Une connexion JSON réussie ne prouve pas la qualité d’extraction :
les petits modèles locaux testés ont produit des citations rejetées. Les scores
ne s’appliquent qu’à la configuration consignée dans chaque rapport.

## Utiliser et comprendre

Le parcours suit trois étapes : **Scénario → Analyse → Relecture**. Un tutoriel
relançable utilise une copie séparée de la démonstration. Les projets restent
sur cet appareil ; exporter le projet JSON pour sauvegarder ou partager notes
et décisions. Il n’y a pas de synchronisation entre les membres.

La **[documentation interne](http://127.0.0.1:4173/#/docs/utiliser)** rassemble
l’utilisation, le fonctionnement, les métriques, l’oral et l’audit des exigences
en cinq chapitres. Sa source unique est [data/project-guide.js](data/project-guide.js).
Les choix techniques et leurs limites y sont expliqués au même endroit.

```text
Scénario → scènes → extraction LLM → contrôle des citations
         → suivi des accessoires → candidats → recherche BM25
         → comparaison LLM → passages sources → décision humaine
```

Le cœur est dans `src/core/`, l’interface React dans `src/components/`, les routes
dans `worker/`. `npm run explain` déroule un exemple avec des sorties de modèle
**simulées et annoncées** : il explique le code, sans mesurer un LLM.

## Données et évaluation

Le scénario réel **Valkaama**, de Tim Baumann d’après Hendrik Behnisch, est publié
sous **CC BY-SA 3.0**. L’expérience principale utilise une adaptation identifiée
contenant **15 incohérences insérées volontairement**, conformément à la consigne
du professeur. Le scénario publié reste intact. Les changements, deux passages
de référence et l’attribution sont dans [data/controlled-script/](data/controlled-script/).
La mesure porte sur les scènes 1–12 du scénario complet et ses 19 accessoires
annotés : 15 incohérences et quatre transitions expliquées. Les autres alertes
sont conservées à relire, hors de cette précision contrôlée.

La précision mesure les alertes rapprochées des injections attendues ; le rappel
mesure les injections retrouvées. Les associations sont inspectables, sans
compter plusieurs fois la même erreur. Une baseline au même modèle reçoit un
prompt direct. Le rapport conserve les échecs et ne présume pas la supériorité
du pipeline. Les anciennes vignettes synthétiques et la QA réelle sont des
expériences complémentaires, distinctes de ce benchmark.

```sh
npm test
node eval/controlled-run.mjs
node --env-file=.env eval/controlled-run.mjs --live
npm run format:check
npm run build
```

La commande sans `--live` valide les références et les résultats enregistrés ;
elle n’invente aucun score. `--live` appelle le modèle et consomme un quota.
Sans `--model`, une nouvelle mesure reprend le modèle du rapport existant.
Les tests du code utilisent des fournisseurs simulés lorsque nécessaire ; ils
ne mesurent pas la qualité réelle du modèle. Détails et commandes historiques :
[eval/README.md](eval/README.md).

L’application propose aussi un import utilisateur et une bibliothèque MovieSum.
L’index local contient des métadonnées ; aperçu et import nécessitent le réseau.
La licence du dataset ne garantit pas les droits des œuvres sous-jacentes.
Sources, transformations et licences : [data/README.md](data/README.md).

## Livrables et limites

- [Rapport d’évaluation](docs/evaluation_report.md) · [PDF, deux pages](docs/print/evaluation.pdf).
- [Fiche système](docs/system_card.md) · [PDF, une page](docs/print/system-card.pdf).
- [Politique d’utilisation](docs/use_policy.md) · [Journal de red team](docs/red_team_log.md).

Groq reçoit les scènes ou extraits nécessaires aux appels ; Ollama permet un
traitement local. Les clés restent côté serveur, les preuves introuvables sont
rejetées et la décision finale reste humaine. Une citation présente ne garantit
pas une interprétation juste. Les limites concernent notamment les transferts
implicites, les objets homonymes, les flashbacks et la recherche multilingue.
L’utilité en tournage et les annotations attendent une validation humaine ; les
retours internes de prise en main ne remplacent pas cette validation métier.

## Équipe et outils IA

Le groupe comprend trois étudiants. Chaque membre doit contribuer réellement et
pouvoir expliquer l’ensemble du système. Les prochains commits doivent refléter
le travail accompli sous l’identité de leur auteur. L’historique ne doit pas être
réattribué pour simuler une répartition.

| Outil                                                       | Usage déclaré                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Codex                                                       | Recherche des sources, code, interface, tests, propositions de références et documentation |
| Groq / GPT-OSS et autres modèles indiqués dans les rapports | Inférence et mesures enregistrées                                                          |
| Canva                                                       | Canvas de cadrage et support initial, conservés hors du dépôt applicatif                   |

Le code est sous [licence MIT](LICENSE). Les scénarios et leurs adaptations
conservent leurs propres licences et attributions.
