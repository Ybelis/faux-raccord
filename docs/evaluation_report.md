# Rapport d’évaluation — Faux Raccord

État des preuves : 2 novembre 2026. [Rapport principal brut](../eval/controlled-report.json), [script reproductible](../eval/controlled-run.mjs).

## 1. Expérience principale demandée : un scénario, quinze erreurs

**Valkaama**, Tim Baumann d’après Hendrik Behnisch, version 2007-06-30, contient 56 scènes. Une adaptation pédagogique conserve ces scènes et ajoute 19 accessoires. Une version de référence est d’abord cohérente ; **exactement 15 phrases ultérieures sont modifiées pour créer 15 faux raccords**, avec quatre transitions expliquées laissées comme contrôles négatifs. L’évaluation porte sur les scènes S001–S012 du même scénario, où se trouvent toutes les injections. Ce ne sont pas des erreurs attribuées aux auteurs originaux.

La [page officielle de l’auteur](https://www.valkaama.com/index.php?l=en&page=sources) annonce la licence **CC BY-SA 3.0** du scénario. Attribution et modifications sont conservées dans [license.json](../data/controlled-script/license.json) ; l’adaptation reprend cette licence. La validation automatique vérifie les deux passages de chaque annotation et qu’annuler les quinze modifications restitue exactement la référence. Validation des fichiers : **réussie**. Annotations proposées avec assistance IA ; relecture humaine non encore attestée. Jeu de développement visible, pas test indépendant.

Le système applique le pipeline du produit : extraction structurée par lots de trois scènes, contrôle des preuves, suivi d’états, recherche BM25 et comparaison LLM. Protocole baseline : les mêmes 12 scènes en deux moitiés de 6 scènes, deux appels sans mémoire ni RAG ; aucune annotation fournie. Chaque paire annotée tient dans une moitié. Modèle de cette expérience : `openai/gpt-oss-120b` via groq, température 0. Modèle disponible dans le catalogue Groq et compatible JSON ; profil retenu après vérification du quota. Identique pour le système et la baseline ; aucun changement du pipeline. Licence modèle : Apache-2.0 ([texte de licence](https://github.com/openai/gpt-oss/blob/main/LICENSE)). Empreinte du pipeline : `317d4f315597`.

Profil continuity-free-v1 : extraction par lots de 3 scènes, plafond de 3000 tokens de sortie ; jugement par groupes de 2 candidats, plafond de 1000 tokens ; baseline en 2 lots de six scènes, plafond de 3000 tokens. Empreinte du profil : b0ebadb133d2.

## 2. Métriques, résultats et incertitude

L’unité est **l’alerte associée à une injection**, sur les 19 accessoires annotés. Un vrai positif (VP) doit identifier l’objet et fournir des citations valides dans les deux scènes attendues ; chaque injection ne peut compter qu’une fois. Une alerte erronée ou dupliquée sur ce périmètre est un faux positif (FP). Une injection non détectée est un faux négatif (FN). Les alertes sur les autres objets originaux sont signalées séparément, sans verdict automatique ; elles sont exclues de la précision contrôlée.

Précision = VP / (VP + FP) : parmi les alertes contrôlables, lesquelles sont justes ? Rappel = VP / 15 : combien d’erreurs introduites sont retrouvées ? F1 = 2 × précision × rappel / (précision + rappel). Les intervalles de Wilson à 95 % sont descriptifs : une seule œuvre, erreurs fabriquées et dépendantes, faible effectif. Ils ne démontrent pas une généralisation à d’autres scénarios.

**Mesure réelle du système et de la baseline disponible.**

| Méthode | VP / FP / FN | Précision [IC 95 %] | Rappel [IC 95 %] | F1 |
|---|---|---|---|---|
| Prompt simple | 6 / 1 / 9 | 85,7 % [48,7 %–97,4 %] | 40,0 % [19,8 %–64,3 %] | 54,5 % |
| Extraction + RAG + comparaison | 7 / 0 / 8 | 100,0 % [64,6 %–100,0 %] | 46,7 % [24,8 %–69,9 %] | 63,6 % |

Système : 7 alertes au total, dont 0 hors périmètre annoté à relire. Baseline : 7 alertes, dont 0 hors périmètre.

Interprétation : le système retrouve 7/15 injections et en manque 8. Aucune fausse alerte contrôlée observée ne signifie pas une précision garantie de 100 % : sa borne basse à 95 % est 64,6 %. La baseline retrouve 6/15 injections et produit 1 fausse alerte contrôlée. Un écart sur une seule œuvre ne démontre pas une supériorité générale.

**Échecs système.** E03 : yellow flask (S001 → S002) ; E04 : folded street map (S001 → S002) ; E06 : blue cigarette case (S004 → S005) ; E07 : green medicine vial (S004 → S005) ; E08 : red coin purse (S004 → S005) ; E11 : navy passport holder (S007 → S011) ; E12 : brown hip flask (S008 → S009) ; E15 : rear-door keyring (S008 → S009)  Les deux passages sont consultables dans l’interface et dans [annotations.json](../data/controlled-script/annotations.json). Une citation présente ne garantit pas une bonne interprétation.

Les traces d’extraction donnent des pistes, à vérifier humainement : E03/E06/E12 sont classés comme remplissages malgré la négation ; E04/E08/E15 conservent l’état « perdu » alors que l’objet réapparaît ; E07/E11 ont une mention manquante ou une identité séparée. Le résultat brut n’a pas été corrigé après ce diagnostic. La fausse alerte baseline vient d’une citation presque exacte (« the mechanism » au lieu de « its mechanism »), rejetée par le contrôle des preuves.



## 3. Tokens, coût et durée

| Exécution sur les 12 scènes | Requêtes physiques / appels logiques | Tokens entrée / sortie | Durées cumulées | Coût catalogue estimé |
|---|---|---|---|---|
| Prompt simple | 2 / 2 | 7 531 / 1 088 | 41,093 s | 0,001782 USD |
| Pipeline | 8 / 6 | 22 344 / 6 085 | 184,217 s | 0,007003 USD |

Tarif [openai/gpt-oss-120b](https://console.groq.com/docs/model/openai/gpt-oss-120b), vérifié le 2 novembre 2026 : 0.15 USD/M de tokens d’entrée et 0.6 USD/M de sortie. Non mesuré : quota gratuit. Coût théorique au tarif public, hors essais et réessais. Les durées ne sont pas des médianes sur plusieurs scénarios ; attentes de quota, cache et volume influencent le temps observé. La comparaison porte sur le coût des sorties mesurées, pas sur tous les essais de développement.

Les requêtes physiques comptent les divisions de transport du jugement ; les appels logiques comptent les lots avant cette division. Les durées cumulées conservent le temps des réponses reprises du cache, y compris la régulation de quota. Les 93,072 s de la dernière reprise ne sont pas la durée totale du système (184,217 s).

Notes d’exécution : Profil de sortie : extraction et baseline3000, jugement1000 pour les verdicts courts. Aucune réponse valide régénérée pour améliorer son score. Les profils précédents ont rencontré des plafonds de quota (Qwen OTPM1000, GPT-OSS20B TPD200000). Les refus restent dans executionAttempts ; les réponses de modèles différents ne sont pas mélangées. La durée cumulative est la somme des durées des appels validés, pauses quota comprises. resumedWallSeconds mesure seulement la dernière reprise ; les essais refusés et sondes ne sont pas inclus dans le coût théorique. Les 3 tentatives d’infrastructure antérieures sont conservées dans le rapport brut ; leurs sorties ne sont pas mélangées aux scores affichés.

## 4. Expériences secondaires et limites

L’ancien jeu séparé de **50 courtes vignettes synthétiques** reste disponible : système, précision 94,4 % [74,2 %–99,0 %], rappel 81,0 %, F1 87,2 % ; baseline 84,0 %, 100,0 %, 91,3 %. L’unité y est le **cas positif**, différente de l’alerte du benchmark principal. Le prompt simple obtient ici le meilleur F1. Modèle `openai/gpt-oss-20b`, exécution du 2 novembre 2026, code `fc3b8d431ac6` ; ces scores historiques ne valident pas rétroactivement le modèle du nouvel essai. [Résultats](../eval/report.json).

**24 questions sur de vrais passages inchangés** des dix premières scènes de Valkaama, modèle `openai/gpt-oss-120b` : 19/24 conformes avec RAG [IC 95 % 59,5 %–90,8 %], contre 16/24 avec prompt simple [46,7 %–82,0 %]. Abstentions correctes : 4/4 et 4/4. La grille lexicale vérifie réponse et citation, ou `NOT FOUND` ; synonymes et négations peuvent la tromper. Ce résultat mesure les réponses, pas la continuité. [Rapport QA](../eval/qa-real-report.json).

Recherche seule : 12 requêtes lexicales sur Valkaama, scène attendue dans les cinq premiers résultats dans 100,0 % des cas. Sécurité : 3/3 tests adversariaux réels réussis ; échantillon limité. [Journal](red_team_log.md).

L’utilité pour une équipe de tournage et le gain de temps ne sont pas validés. Le jeu principal est visible et ses annotations attendent une relecture humaine. Objets homonymes, possession implicite et flashbacks restent difficiles. La modalité image/audio/vidéo est encouragée dans le brief ; aucune n’est revendiquée ici. Réserver un autre scénario annoté avant de conclure sur la généralisation.

Reproduction sans inférence : `node eval/controlled-run.mjs`, puis `node scripts/write-evaluation-docs.mjs` et `node scripts/print-deliverables.mjs --pdf`. Nouvelle mesure payante ou soumise au quota : commande `commands.live` conservée dans le rapport brut.
