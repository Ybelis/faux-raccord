# Comprendre les résultats

Le logiciel peut fonctionner sans que ses conclusions soient toujours justes. C’est pourquoi le projet vérifie séparément le code, la qualité des réponses et l’utilité pour une personne. Les chiffres ci-dessous concernent une exécution précise de `openai/gpt-oss-20b`, enregistrée dans [le rapport brut](../eval/report.json), pas tous les modèles proposés dans les réglages.

## Commencer par l’unité de mesure

Le benchmark de continuité contient 60 petites histoires synthétiques : dix cas de développement et **50 cas réservés au test**. Chaque cas possède une référence proposée : « au moins un point à relire » ou « aucun point attendu ».

La prédiction devient positive dès que le système produit au moins une alerte dans ce cas. Le score mesure donc des **cas signalés**, pas la justesse individuelle de toutes les alertes d’un long scénario.

Exemple : une montre se brise, puis la même montre est intacte immédiatement, sans réparation. Un point est attendu. Si une réparation est décrite entre les deux, aucun point n’est attendu. Ces références ont été proposées avec assistance IA ; leur relecture humaine reste distincte des calculs.

## Les quatre nombres de départ

Sur les 50 cas, les références proposées contiennent 21 positifs et 29 négatifs.

| Référence du cas | Le système signale un point | Le système ne signale rien |
|---|---:|---:|
| Point attendu : 21 cas | **17 vrais positifs** : cas retrouvés | **4 faux négatifs** : cas manqués |
| Aucun point attendu : 29 cas | **1 faux positif** : fausse alerte | **28 vrais négatifs** : silence correct |

« Positif » ne signifie pas « bon ». Cela signifie « le système signale quelque chose ». Un faux positif dérange l’utilisateur pour un cas qui ne devait pas être signalé ; un faux négatif laisse passer un cas à relire.

La baseline, ou méthode de comparaison, utilise le même LLM sur les mêmes textes avec un prompt simple. Elle obtient **21 vrais positifs, 4 faux positifs, 0 faux négatif et 25 vrais négatifs**.

## Les trois métriques principales

### Précision : peut-on se fier aux cas signalés ?

Le système signale 18 cas : 17 attendus et une fausse alerte.

```text
Précision = vrais positifs / cas signalés
          = 17 / (17 + 1)
          = 94,4 %
```

Cela répond à « parmi les cas que le système me demande de relire, quelle proportion correspond à la référence ? ». Cela ne signifie pas qu’il a retrouvé 94,4 % des erreurs possibles.

### Rappel : combien de cas attendus retrouve-t-on ?

Parmi les 21 cas positifs, le système en retrouve 17 et en manque quatre.

```text
Rappel = vrais positifs / cas positifs attendus
       = 17 / (17 + 4)
       = 81,0 %
```

Un système qui ne signale presque rien peut limiter les fausses alertes tout en laissant passer beaucoup de problèmes. C’est pour cela qu’on lit précision et rappel ensemble.

### F1 : un compromis entre précision et rappel

Le F1 est leur moyenne harmonique. Il pénalise une méthode dont l’une des deux mesures est faible.

```text
F1 = 2 × précision × rappel / (précision + rappel)
   = 2 × vrais positifs / (2 × vrais positifs + faux positifs + faux négatifs)
   = 34 / 39
   = 87,2 %
```

| Méthode | Précision | Rappel | F1 |
|---|---:|---:|---:|
| Prompt simple | 84,0 % | 100,0 % | **91,3 %** |
| Extraction, recherche et comparaison | **94,4 %** | 81,0 % | 87,2 % |

**Le pipeline n’est pas globalement meilleur dans ce benchmark.** Il passe de quatre fausses alertes à une, mais manque quatre cas que la baseline retrouve. Il apporte aussi des accessoires suivis, des passages consultables et une revue structurée. L’intérêt de ce compromis doit être vérifié avec l’utilisateur ; il ne découle pas du seul nombre d’étapes techniques.

Si le professeur demande l’« accuracy », ou proportion de cas bien classés : `(17 + 28) / 50 = 90 %` pour le système, contre `(21 + 25) / 50 = 92 %` pour la baseline. Ce calcul dérivé compte ensemble les silences corrects et les détections ; il ne répond pas à la question spécifique de la fiabilité des alertes.

## Pourquoi afficher un intervalle de confiance ?

La précision de 94,4 % repose sur seulement 18 cas signalés. Une erreur de plus ferait sensiblement bouger le résultat. L’intervalle de Wilson à 95 % est **74,2–99,0 %** pour cette précision. Il rend visible l’imprécision liée au petit échantillon ; il ne garantit pas que les performances futures se situeront dans cet intervalle.

La borne basse est inférieure à l’objectif provisoire de 80 %. Ce résultat ne suffit donc pas à établir que cette cible est atteinte de manière solide. De plus, les cas sont synthétiques et parfois proches : le calcul d’un intervalle ne corrige ni ce biais ni l’absence de validation humaine. Le seuil de 80 % n’est pas encore une cible convenue avec un utilisateur réel.

## Temps, tokens et coût

La **latence médiane** est le temps du cas situé au milieu des temps triés ; pour 50 cas, on prend la moyenne des deux valeurs centrales. La moitié des cas est au-dessous de cette valeur et l’autre moitié au-dessus. Ce n’est ni le temps total ni une promesse de vitesse pour un scénario entier.

- Baseline : médiane de **0,508 seconde par cas**.
- Système : médiane de **6,426 secondes par cas**.

Le pipeline demande plusieurs appels au modèle, contrairement au prompt simple. Les durées peuvent aussi inclure des attentes de quota.

Un **token** est une unité de texte utilisée par le modèle ; ce n’est pas systématiquement un mot. Les tokens d’entrée comprennent notamment les instructions et les scènes ou passages ; les tokens de sortie correspondent à la réponse générée, selon la comptabilisation du fournisseur.

| Méthode | Tokens d’entrée | Tokens de sortie | Coût catalogue estimé pour les 50 cas |
|---|---:|---:|---:|
| Prompt simple | 12 977 | 4 449 | 0,002308 USD |
| Système | 45 405 | 16 483 | 0,008350 USD |

Le calcul utilise [le tarif conservé dans le projet](../eval/pricing.json) : 0,075 USD par million de tokens d’entrée et 0,30 USD par million de tokens de sortie. Pour le système : `45 405 × 0,075 / 1 000 000 + 16 483 × 0,30 / 1 000 000`. C’est une estimation au tarif catalogue vérifié à cette date, pas une facture. Un accès gratuit peut coûter zéro euro tout en imposant un quota.

## Les autres nombres ne mesurent pas la même chose

| Vérification | Ce qu’on lui donne | Ce qu’elle permet d’affirmer | Ce qu’elle ne prouve pas |
|---|---|---|---|
| Tests automatiques du logiciel | Entrées contrôlées, faux fournisseurs et un vrai PDF | Le comportement testé respecte les assertions | La qualité générale du LLM ou l’utilité métier |
| 50 cas de continuité | Petites histoires synthétiques et références fixes | Comparaison des deux méthodes sur ce jeu | Détection exhaustive dans de vrais films |
| 24 questions QA réelles | Dix scènes inchangées de Valkaama ; 20 questions avec réponse et quatre sans réponse | Réponse conforme à une grille, référence attendue ou abstention, si l’exécution est complète | Détection de continuité, jugement humain ou généralisation à d’autres œuvres |
| 12 recherches réelles | Requêtes et scènes attendues dans Valkaama | La scène attendue figure dans les cinq premiers passages pour ces douze requêtes | Que le LLM comprend ces passages ou répond correctement |
| Trois essais adversariaux | Injections et demande de secret | Les protections ont résisté à ces trois essais enregistrés | Une protection contre toutes les attaques |
| Test avec un utilisateur | Une vraie personne accomplit une tâche et donne son avis | Observations d’usage, difficultés et éventuel gain mesuré | Un résultat déjà acquis avant la séance |

Les tests automatiques étaient au nombre de 52 avant les corrections suivantes ; le total exact est affiché par `npm test`. Il ne faut pas confondre ce nombre d’assertions logicielles avec les 50 cas du benchmark.

La grille QA demande les mots ou expressions attendus, la bonne scène dans le champ `citations` et un repère entre crochets dans le texte de réponse. Une réponse sensée peut donc échouer sur le format ou un synonyme absent de la grille. Ce score est un indicateur strict à faire relire, pas un jugement sémantique universel. Un rapport interrompu par le quota doit être présenté comme incomplet, avec son nombre de réponses disponibles, sans en tirer de score global de qualité.

## Une réponse courte à retenir pour l’oral

« Sur nos 50 cas synthétiques, le système signale 18 cas : 17 étaient attendus et un est une fausse alerte. Sa précision est de 94,4 %. Il retrouve 17 des 21 cas positifs, soit 81 % de rappel. Le prompt simple a un meilleur F1 ; notre pipeline produit moins de fausses alertes et rend le suivi et la revue consultables. Ces résultats restent limités par le jeu synthétique et les annotations à valider. »
