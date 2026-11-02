# Présenter Faux Raccord comme un produit d’IA générative

## Formulation du projet

« Faux Raccord est une application d’IA générative avec RAG pour aider à relire la continuité des accessoires d’un scénario. Le modèle produit des fiches structurées, des explications et des réponses avec des sources. L’équipe vérifie les passages et prend la décision. »

Cette formulation décrit le fonctionnement implémenté, sans promettre une détection exhaustive ni une correction automatique du scénario.

## Où intervient la génération ?

| Entrée | Sortie générée par le LLM | Contrôle effectué par le code |
|---|---|---|
| Scènes du scénario | Objets JSON : noms d’accessoires, mentions, états, propriétaires et citations | Champs autorisés, identifiants et présence des citations dans la scène |
| Deux mentions et passages retrouvés | Explication d’un changement, interprétation prudente et question à relire | Candidats fournis uniquement ; les deux preuves restent celles du texte |
| Question et extraits retrouvés | Réponse formulée avec références, ou abstention | Identifiants des sources et cohérence des références |

Le découpage du document, le classement BM25, les calculs de métriques et la sauvegarde sont des traitements classiques. Le produit combine ces opérations à la génération ; il ne prétend pas que chaque ligne du logiciel est de l’IA.

## Pourquoi le RAG ?

La recherche retrouve des passages du scénario avant une comparaison ou une réponse. Ces passages deviennent le contexte fourni au modèle. Les sorties restent consultables avec leurs sources. Les poids du modèle ne sont pas réentraînés : le projet emploie le RAG, pas une LoRA.

## Ce que demande le PDF

La page 3 demande un produit comprenant au moins un LLM, du RAG sur des documents réels ou une LoRA, une évaluation avec baseline, des protections et une interface essayable. Le projet fournit ces éléments avec les limites documentées dans l’audit.

Le calendrier de la page 2 sépare deux rendus : Generative AI le 3 novembre, puis le cours Agentic AI les 4–5 novembre et un autre rendu le 1er décembre. La modularité prépare la réutilisation du code ; elle ne transforme pas le rendu actuel en système autonome.

Le programme actuel appelle les étapes dans un ordre fixé. Il ne choisit pas un objectif, ne planifie pas librement des actions et ne modifie pas des outils externes à la place de l’utilisateur. Le mot « agent » n’est donc pas utile pour présenter ce produit.

## Si le mot a déjà été employé à l’oral

« Nous avons employé le mot agent trop largement. Notre implémentation est un pipeline d’IA générative avec RAG : extraction structurée, recherche de passages et génération d’explications, puis validation humaine. C’est ce fonctionnement que nous montrons pour le rendu Generative AI. »

Le système peut manquer un objet ou mal interpréter un changement. La démonstration doit montrer une sortie générée, sa source et un échec connu, plutôt que promettre une autonomie ou une fiabilité qui n’ont pas été mesurées.

## Pourquoi le rendu actuel est textuel

Le tableau du brief indique une modalité **encouragée**, « image, audio ou vidéo » lorsqu’elle apporte une valeur réelle. Le périmètre retenu porte sur la relecture préparatoire du scénario ; ses données sont du texte. Un PDF contenant du texte et la vidéo de secours ne sont pas présentés comme une fonctionnalité multimodale.

Une dictée de question est techniquement une entrée audio, mais son utilité n’a pas été démontrée pour ce parcours. La comparaison d’une photo d’accessoire à l’état décrit dans une scène serait une extension plus proche du sujet, à condition de disposer de photos autorisées, d’un modèle de vision et d’une évaluation spécifique. Comparer des prises vidéo élargirait davantage le projet.

La recommandation n’est donc pas annoncée comme réalisée. Si une consigne orale la rend obligatoire, elle devra être ajoutée au périmètre ; l’implémentation actuelle ne peut pas en tenir lieu par simple changement de vocabulaire.

## Différence avec la suite du projet

Voir [l’évolution proposée](evolution-projet.md). Le type de données et l’autonomie sont deux axes distincts : traiter une image ne rend pas une application agentique ; un système agentique peut travailler uniquement avec du texte.
