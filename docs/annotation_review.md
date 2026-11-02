# Audit des annotations et relecture à terminer

Cet audit a été effectué **avec assistance IA**, le 2 novembre 2026. Il ne constitue pas une validation humaine et ne change ni les références, ni les prédictions, ni les scores enregistrés. Le [fichier d’audit](../eval/annotation_audit.json) conserve les empreintes des deux jeux et une fiche par cas, avec les champs de relecture humaine encore vides.

## Ce qui a été contrôlé

| Contrôle | Résultat de cet audit |
|---|---|
| Identifiants des 60 cas synthétiques | Uniques ; dix développement et cinquante test |
| Références positives du test synthétique | 21 sur 50, cohérent avec le rapport enregistré |
| Signalement des données synthétiques | Présent sur les 60 cas, annotations encore proposées et non validées |
| Questions réelles | 24 identifiants uniques ; vingt questions avec réponse et quatre sans réponse |
| Citations de référence des vingt réponses QA | Toutes retrouvées par normalisation dans la scène attendue |
| Quatre informations supposées absentes | La lecture assistée des dix scènes n’a pas trouvé les marques, le montant ou la couleur demandés ; confirmation étudiante encore à faire |
| Cohérence générale des étiquettes | Pas d’inversion manifeste relevée ; plusieurs conventions et formulations méritent une relecture |

Une citation retrouvée établit son existence dans le texte. Cela ne valide pas à elle seule la question, le sens attendu, les synonymes de la grille ou le caractère représentatif du jeu.

## Points précis à relire

| Cas ou groupe | Observation | Décision à prendre par le groupe |
|---|---|---|
| C001 | Le motif « état irréversible » est trop fort pour une montre réparable ; le texte exclut toutefois une réparation avant son retour intact | Conserver la distinction entre formulation de la raison et étiquette du cas |
| C007, C013, C024, C030, C032, C059 | Une transition ou restitution est absente du texte. Le cas vise un point potentiel à relire ; il ne prouve pas nécessairement une impossibilité physique | Valider explicitement cette convention d’annotation |
| C042 | « The torch is unloaded / fully loaded » est une formulation inhabituelle pour une lampe à batterie | Noter le défaut de naturel ; toute reformulation produit une nouvelle version, pas un remplacement du test historique |
| C019, C051 | Un retour dans le passé explique l’état intact | Ne pas changer la référence négative parce que le détecteur se trompe |
| C001/C010/C049 ; C002/C014/C033 ; C008/C034 ; C009/C035 | Structures proches ou traductions entre développement et test | Décrire le split comme une séparation de fichiers et d’usage, sans affirmer une indépendance complète des situations |
| QA007 | « Table de nuit » peut désigner le meuble attendu, mais la grille cherche `chevet` ou `bedside` | Faire relire les synonymes ; noter qu’un échec lexical peut être une réponse sémantiquement valable |
| QA017 | « Demi-pleine » ou « mi-pleine » peuvent exprimer le bon niveau sans correspondre aux formulations retenues | Même vérification des variantes de langue |
| Toutes les réponses QA | Le score exige une source dans `citations` et un repère entre crochets dans le texte | Distinguer échec de format et erreur factuelle dans l’analyse des résultats |
| QA008 et autres questions d’état | Un mot attendu peut être présent dans une négation | Ne pas assimiler la grille lexicale à une compréhension du sens |

Exemple de diagnostic construit, **pas une sortie mesurée** : « Non, le verre n’est plus plein [S005-C2] » contient le mot `plein` et la bonne référence, mais contredit le texte de QA008. La recherche lexicale seule ne détecte pas ce problème. À l’inverse, un synonyme absent de la grille peut faire échouer une réponse correcte. Les résultats QA doivent donc être présentés comme conformité à une grille approximative, à compléter par une relecture des réponses.

## Se répartir les 84 références entre vous

| Relecteur à nommer | Cas synthétiques | Questions réelles |
|---|---|---|
| Membre A | C001 à C020 | QA001 à QA008 |
| Membre B | C021 à C040 | QA009 à QA016 |
| Membre C | C041 à C060 | QA017 à QA024 |

Lire le texte et la référence avant de consulter la prédiction du modèle. Dans `eval/annotation_audit.json`, chaque fiche possède `manualReview.reviewer`, `reviewedAt`, `decision` et `justification`, actuellement `null`. Renseigner uniquement après la relecture effective. Pour une abstention QA, vérifier la scène et les autres scènes couvertes afin de ne pas déclarer absente une information présente ailleurs dans le périmètre.

Discuter les cas ambigus en groupe et conserver les désaccords. Si l’étiquette ou la grille doit changer, créer une version distincte et identifier le résultat recalculé. Le rapport actuel reste la trace de son protocole initial. Une relecture assistée ne doit pas être rebaptisée « validation par trois étudiants » tant que chacun n’a pas réellement effectué son lot.

## Limite qui reste après la relecture

Même des annotations relues ne transforment pas des histoires synthétiques très proches en un échantillon représentatif de films. Les questions réelles portent sur dix scènes d’une seule œuvre et évaluent une autre tâche. Une nouvelle mesure de continuité sur des scénarios variés, annotés indépendamment, reste nécessaire pour annoncer une généralisation métier.
