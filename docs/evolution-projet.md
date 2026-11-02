# Du rendu GenAI à une éventuelle version agentique

Ce document propose la suite ; il ne décrit pas des fonctionnalités déjà implémentées. Le calendrier du PDF distingue le rendu Generative AI du 3 novembre et le cours Agentic AI qui commence les 4–5 novembre.

## Aujourd’hui : produire des propositions à partir du scénario

L’utilisateur choisit un document, des scènes et un modèle. Le programme suit un ordre défini : extraction, contrôle des citations, suivi des accessoires, recherche de contexte, comparaison et affichage. Le LLM génère des informations structurées, des explications et des réponses. Le lecteur prend la décision.

Le code ne demande pas au modèle de choisir librement le prochain outil. Les boucles de lots et les reprises après un quota sont programmées : elles ne constituent pas une planification autonome.

## Plus tard : poursuivre un objectif en choisissant des étapes

Exemple d’objectif : « Prépare le dossier de continuité de la version 3 et identifie les décisions de la version 2 qu’il faut revoir. »

Une version agentique pourrait :

1. Vérifier quelles versions et quelles décisions sont disponibles.
2. Appeler un outil de comparaison des textes pour sélectionner les scènes modifiées.
3. Choisir les analyses et recherches nécessaires, plutôt que relancer systématiquement tout le scénario.
4. Demander une précision lorsqu’un document ou une information manque.
5. Conserver l’état d’avancement et les liens entre résultats et versions du texte.
6. Proposer le dossier final, puis obtenir l’accord avant de remplacer un document ou de le transmettre.

L’étape déterminante est le choix des outils et de leur ordre en fonction de l’objectif et des résultats. Ajouter le mot « agent », une boucle ou davantage d’appels LLM ne suffit pas.

| Aspect | Rendu actuel | Proposition pour la suite |
|---|---|---|
| Déclenchement | Action précise de l’utilisateur | Objectif de travail plus global |
| Parcours | Ordre fixé dans le programme | Choix des étapes à partir des résultats |
| Outils | Fonctions appelées par le programme | Fonctions exposées avec entrées, sorties et permissions explicites |
| État | Projet et décisions de revue | Avancement d’une tâche, versions et éléments encore manquants |
| Contrôle humain | Confirmer ou écarter un point | Valider aussi le plan et les actions qui modifient ou transmettent le travail |

Les fonctions actuelles de segmentation, recherche, analyse et export peuvent servir de base. La comparaison de versions, le planificateur et la mémoire de tâche restent à construire.

## Ce qu’il faudrait évaluer en plus

Le futur système devrait être testé sur la réussite d’une tâche complète : bonne version utilisée, bonnes scènes sélectionnées, questions posées au bon moment, absence d’action non autorisée, coût et capacité de reprise. La qualité des réponses et des citations resterait nécessaire, mais ne suffirait plus à évaluer le comportement global.

## La multimodalité est une autre décision

| Type de données | Valeur possible pour Faux Raccord | Données et vérification nécessaires |
|---|---|---|
| Image | Confronter une photo d’accessoire à une description de scène | Photos autorisées, état et objet attendus, modèle de vision, cas où l’image ne permet pas de conclure |
| Audio | Transformer des observations de tournage en notes relues | Enregistrements autorisés, transcription de référence, contrôle des noms et états |
| Vidéo | Comparer des accessoires entre deux prises | Prises comparables, repères temporels, annotations visuelles et évaluation des erreurs |

Ces pistes ne sont pas nécessaires pour définir un agent. Leur choix doit être justifié par le travail visé ; le rendu actuel reste une application textuelle d’IA générative avec RAG.
