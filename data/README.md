# Données

Le corpus initial est le scénario anglais **Valkaama**, écrit par Tim Baumann,
d'après le roman de Hendrik Behnisch, version du 30 juin 2007.

- Source auteur : https://www.valkaama.com/index.php?l=en&page=sources
- Licence indiquée dans le PDF et sur la page source : **CC BY-SA 3.0**.
- Licence : https://creativecommons.org/licenses/by-sa/3.0/
- Préparation : extraction PDF par page, retrait des numéros de page isolés,
  segmentation par en-têtes de scène. Les identifiants de page sont conservés.
- Les adaptations et variantes de ce texte sont identifiées et partagées sous
  CC BY-SA 3.0 avec attribution. Le code de l'application a sa propre licence.
- Il s'agit du scénario, pas d'une transcription du film. Les changements
  entre scénario et film ne constituent pas des erreurs de continuité.
- Aucune liste d'accessoires ni aucun planning authentique n'est supposé exister.

La préparation historique utilise `scripts/fetch_corpus.py` avec Python et
`pdfplumber==0.9.0` (`python -m pip install pdfplumber==0.9.0`). `npm run data:fetch`
régénère `valkaama.json` et `valkaama.fountain` depuis le PDF de l’auteur ; les
différences de texte doivent être relues avant de remplacer des références.
Cette dépendance Python n’est pas nécessaire pour lancer l’application, importer
un PDF dans l’interface ou reproduire les évaluations déjà fournies.

Le projet de démonstration français et les variations d'évaluation sont des
**fictions synthétiques contrôlées**, distinctes du corpus réel. Ils servent
à montrer le traitement d'erreurs connues et ne sont jamais présentés comme
des défauts trouvés dans Valkaama. Les annotations de référence proposées par
Codex doivent être relues et validées par les étudiants avant le rendu.

Les imports de l'utilisateur restent sur son appareil, sauf les passages envoyés
au fournisseur de modèle qu'il choisit pour l'analyse. La clé du fournisseur est
conservée côté serveur. Ne pas importer de scénario confidentiel dans une API
externe sans autorisation ; choisir le mode local dans ce cas.

## Expérience contrôlée : 15 erreurs dans un seul scénario

Le dossier `controlled-script/` applique la consigne spécifique du professeur :
construire une référence en insérant 10 à 20 incohérences dans un scénario,
mesurer précision et rappel, et montrer les passages sources de chaque alerte.
Le scénario publié et son PDF ne sont pas modifiés.

| Fichier                                                      | Rôle                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `reference.json`                                             | Adaptation préparée, avec des accessoires ajoutés et des transitions cohérentes             |
| `project.json`                                               | Même adaptation, avec 15 phrases changées pour introduire des incohérences                  |
| `annotations.json`                                           | E01–E15, quatre contrôles négatifs, objets, passages avant/après et journal des changements |
| `license.json`                                               | Attribution, source officielle, licence CC BY-SA 3.0 et description des modifications       |
| `analysis.json` et `baseline.json`, lorsqu’ils sont présents | Sorties réelles enregistrées, avec modèle et provenance de l’exécution                      |

Les deux adaptations gardent les 56 scènes. Les changements et l’évaluation
portent sur les scènes 1–12 : quinze erreurs et quatre transitions expliquées.
Ce sont des accessoires construits pour l’expérience, pas des erreurs attribuées
à l’auteur. Les pages indiquent où se situe la scène dans l’original ; le PDF
original ne contient pas les phrases ajoutées.

La validation automatique vérifie les citations et l’empreinte de l’original.
Revenir sur les quinze modifications déclarées doit restituer la version
préparée, sans autre changement de texte. L’adaptation conserve l’attribution et
CC BY-SA 3.0 ; les annotations proposées avec assistance IA restent à relire
par les trois étudiants. Ce jeu visible est un benchmark de développement
contrôlé, pas une évaluation aveugle indépendante.

Le score porte sur les 19 accessoires annotés. Chaque injection peut être
associée à une seule alerte avec deux preuves ; les doublons et les alertes
injustifiées sur ce périmètre coûtent de la précision. Les alertes concernant
d’autres accessoires sont conservées à relire, hors du score contrôlé.
Protocole et commandes : [eval/README.md](../eval/README.md).

## Questions réelles d'évaluation

`eval/qa-real.json` contient 24 questions sur les dix premières scènes non
modifiées de Valkaama : vingt faits présents et quatre informations absentes.
Les questions et les grilles de réponse ont été proposées avec assistance IA.
Le script vérifie que les citations de référence existent ; cette vérification
ne remplace pas la relecture du jugement attendu par les étudiants.

Ce jeu ne crée pas de faux raccords dans Valkaama. Il évalue les questions
sourcées et l'abstention, séparément des cas synthétiques de continuité.
Les citations et références dérivées conservent l'attribution et la licence
CC BY-SA 3.0 de leur source.

## Bibliothèque externe MovieSum

La bibliothèque permet de consulter les métadonnées et d'importer explicitement
un scénario de [MovieSum](https://huggingface.co/datasets/rohitsaxena/MovieSum),
décrit dans le [dépôt des auteurs](https://github.com/saxenarohit/MovieSum).
La source annonce 2 200 scénarios XML : 1 800 dans `train`, 200 dans
`validation`, 200 dans `test`. Ces partitions appartiennent au dataset ; elles
ne sont pas les partitions du benchmark de Faux Raccord.

Les auteurs déclarent une licence **CC BY-NC 4.0** pour le jeu. Cela ne garantit
pas que tous les droits des films ou scénarios sous-jacents sont couverts.
L'application affiche cette réserve et demande de lire les conditions avant
un import. Cette confirmation ne constitue pas une autorisation juridique.
MovieSum n'est pas fourni intégralement dans ce dépôt et n'est pas utilisé
pour les scores de référence actuels.

L'import télécharge le XML à la demande, conserve source, partition, titre,
identifiant disponible et SHA-256. Les textes longs sont bornés à 60 scènes
et 180 000 caractères, avec une portée signalée. Les repères XML ne sont pas
des pages du PDF original. L’aperçu et l’import dépendent du service externe ;
la recherche de titres et Valkaama restent disponibles hors ligne.

### Index des titres

`data/moviesum-index.json` contient uniquement les 2 200 titres, identifiants
IMDb et repères de ligne/partition. Aucun scénario ni résumé n’y figure.
La recherche par titre ou IMDb s’effectue sur ces métadonnées locales et ne
dépend pas du service de recherche plein texte de Hugging Face.

Le script `scripts/fetch-moviesum-index.mjs` lit seulement les colonnes utiles
des fichiers Parquet par requêtes HTTP Range, avec un plafond de transfert.
L’index conserve la révision du dataset, sa date de préparation, l’attribution
et un condensat d’intégrité. Avant un aperçu ou un import, l’identifiant IMDb
attendu est comparé à la ligne distante pour éviter de sélectionner une autre
œuvre si le dataset a changé.
