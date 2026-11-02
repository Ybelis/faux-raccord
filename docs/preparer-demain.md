# Préparer la présentation de demain

Objectif : chacun doit pouvoir lancer le projet, suivre une analyse et expliquer une limite, sans réciter tout le code. Le travail ci-dessous reste à effectuer par le groupe. Il ne constitue pas une liste de contributions déjà réalisées.

## Un noyau commun pour les trois membres

Chaque personne doit pouvoir expliquer cette chaîne, avec ses propres mots :

```text
Document → scènes → objets et citations → changements candidats
         → recherche de contexte → comparaison → décision humaine
```

Le modèle produit des propositions. Le code contrôle des formats, retrouve les citations et prépare les comparaisons. L’utilisateur conserve le dernier mot. La recherche BM25 ne réentraîne pas le modèle : elle choisit les passages qui lui seront fournis.

Lire ensuite [le parcours du code](code_walkthrough.md), [les métriques](comprendre-les-resultats.md) et [les tests](tests.md). Chacun doit retrouver `parseScreenplay()`, `validateExtraction()`, `findCandidates()`, `retrieve()` et `answerQuestion()` dans le dépôt.

## Se répartir un travail vérifiable

| Personne | Travail à faire maintenant | Preuve utile à conserver | À expliquer à un autre membre |
|---|---|---|---|
| A : données et sources | Ouvrir le vrai PDF, vérifier plusieurs limites de scènes et pages ; relire un lot des références de continuité et de QA | Identifiants des cas relus, décision, commentaire et date ; défaut éventuel décrit précisément | Pourquoi Valkaama est réel, pourquoi la démo est synthétique, ce qu’autorise la licence et ce que les repères XML signifient |
| B : traitement et évaluation | Suivre l’exemple de montre dans le pipeline ; recalculer les quatre nombres et les métriques ; exécuter les tests sur sa machine | Sortie de tests, calculs, explication d’un cas manqué et d’une fausse alerte | Différence entre une règle, un appel LLM, une recherche et une référence de test |
| C : parcours et démonstration | Faire tout le parcours sur ordinateur et mobile ; préparer l’import, une revue et un export ; tester la vidéo de secours | Notes d’usage, problème reproductible ou capture ; fichier exporté puis réimporté | Sauvegarde sur l’appareil, guide isolé, transmission Groq et réglages du moteur |

Les trois personnes échangent ensuite leurs parties : A explique le pipeline, B effectue la démonstration, C recalcule les métriques. Chaque membre renseigne dans le README ce qu’il a réellement fait. Une relecture, un test ou une correction réelle peut être documenté ; un rôle proposé n’atteste pas à lui seul une contribution au code.

Si un défaut est découvert, le corriger dans une branche personnelle, expliquer le problème et garder une vérification pertinente. Utiliser sa propre identité Git pour ce travail. Pour une contribution au code exigée par le cours, chaque personne doit réaliser et comprendre une modification réelle ; créer des commits vides ou changer les auteurs ne remplit pas ce besoin.

## Revoir les annotations sans déplacer le résultat

Pour chaque cas, lire le texte avant la prédiction. Noter : référence proposée, décision du relecteur, justification et éventuel désaccord. Il faut distinguer « changement impossible » et « transition inexpliquée à relire ». Ne pas utiliser le score obtenu pour choisir l’étiquette attendue.

Un audit assisté par IA peut signaler une ambiguïté ; il ne remplace pas votre relecture. Les fichiers originaux restent figés avec le rapport de référence. Toute correction d’étiquette exige une version distincte et un nouveau calcul clairement identifié, pas le remplacement silencieux du score affiché.

## Ce que vous pouvez tester entre vous ce soir

Vous pouvez effectuer un **test d’usage interne avec les trois membres**, sans contacter une personne extérieure. Suivre [la fiche de test interne](test-interne.md) : une personne utilise l’application, une observe et une mesure le temps ; puis les rôles tournent. Les tâches sont concrètes : ouvrir un scénario, comprendre les deux passages d’un point, sauvegarder une décision et la retrouver dans un export.

Décider de la cible avant de commencer et noter les réussites, les demandes d’aide et les blocages réels. Le résultat peut être présenté comme une vérification de compréhension de l’interface au sein du groupe. Il ne démontre ni un gain de temps en tournage ni un avis indépendant de scripte. Vous connaissez déjà le produit : ce biais doit être annoncé.

Le PDF demande une personne réelle avec un problème identifiable et une cible convenue ; il n’impose pas le mot « professionnel » ou « externe ». Si aucun membre ne rencontre réellement le problème métier visé, le test interne ne suffit pas à valider ce besoin. Présenter alors le public comme une hypothèse définie et la validation métier comme une limite restante, sans inventer d’entretien.

## Démonstration de cinq minutes

| Temps | Action | Phrase à maîtriser |
|---|---|---|
| 0:00–0:40 | Présenter le problème et l’utilisateur visé | « Nous aidons à relire les accessoires dans le texte ; nous n’analysons pas les images du film. » |
| 0:40–1:20 | Ouvrir Valkaama et sa provenance | « Le corpus réel contient 56 scènes ; le résultat fourni précise combien ont été analysées. » |
| 1:20–2:50 | Ouvrir Les Heures Creuses, comparer les passages et prendre une décision | « Cette fiction est synthétique et contrôlée. Le modèle propose un point ; notre décision reste séparée. » |
| 2:50–3:40 | Montrer un accessoire, une source et un export | « Les projets restent dans ce navigateur. Le JSON transmet le scénario et la revue au groupe. » |
| 3:40–5:00 | Montrer baseline, résultats et un échec | « Moins de fausses alertes, mais quatre cas manqués : la baseline a un meilleur F1 dans ce jeu. » |

Une analyse en direct doit rester courte et vérifiée à l’avance, avec le même modèle que celui annoncé. Un résultat déjà enregistré doit être nommé comme tel. En cas de quota ou de problème réseau, expliquer l’erreur et passer au résultat enregistré ou à la vidéo ; ne pas simuler une nouvelle analyse.

## Huit questions à se poser sans lire ses notes

1. **Pourquoi un LLM ?** Pour repérer des objets, leurs noms et des relations formulées de façons variées ; les règles seules ne lisent pas ces descriptions avec la même souplesse.
2. **Pourquoi du RAG ?** Pour rechercher les passages associés et donner au modèle un contexte consultable. Ici, la recherche est lexicale et limitée par les paraphrases et les langues.
3. **Que garantit une citation retrouvée ?** Que ce passage existe dans le texte après normalisation, pas que l’interprétation du modèle est juste.
4. **Pourquoi n’est-ce pas seulement un chatbot ?** Le produit structure les objets et leurs mentions, suit les changements, présente une revue et garde les décisions.
5. **Pourquoi votre F1 est-il inférieur à la baseline ?** Le pipeline diminue les fausses alertes mais manque quatre cas positifs. Son compromis et sa traçabilité doivent être jugés avec l’utilisateur.
6. **Le 100 % de recherche prouve-t-il la qualité ?** Non : douze requêtes retrouvent leur scène dans les cinq premiers passages ; cela ne mesure pas la réponse du LLM.
7. **Que fait un test avec un faux modèle ?** Il contrôle le logiciel de manière reproductible, sans prétendre mesurer le vrai modèle.
8. **Qu’est-ce qui reste fragile ?** Identité des objets, transferts implicites, chronologie, grille d’évaluation et généralisation à d’autres scénarios. Une limite connue doit être montrée avec un exemple.

Pour approfondir les objections, utiliser [les réponses de soutenance](defense.md). Avant de partir, chaque personne doit avoir lancé l’application, ouvert les résultats bruts, expliqué un test et vérifié la vidéo de secours.
