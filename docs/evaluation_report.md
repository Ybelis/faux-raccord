# Rapport d'évaluation — Faux Raccord

Exécution réelle Groq du 02/11/2026, modèle `openai/gpt-oss-20b`, prompts v1.0.0. Référence du code de l'exécution : `fc3b8d431ac6`. Prédictions détaillées : [report.json](../eval/report.json).

## Jeu et protocole

60 cas synthétiques contrôlés ont été proposés avec assistance IA : dix cas de développement et **50 cas réservés au test** (21 positifs, 29 négatifs). Ils couvrent états, possession, réparations/remplacements, objets homonymes, ellipses, absences de mention et injections. Les annotations restent **à relire et à valider par les étudiants**. Il ne s'agit ni d'erreurs trouvées dans des films ni d'une validation utilisateur.

La baseline reçoit le texte intégral de chaque cas avec un prompt simple. Le système reçoit les mêmes scènes : extraction structurée, validation des citations, suivi d'états, recherche BM25 puis comparaison LLM. Une alerte ambiguë compte comme un point signalé. Le modèle et la température sont identiques. Les appels et tokens supplémentaires du système sont comptés. Les cas de test n'ont pas servi à modifier le détecteur après lecture des résultats.

## Métriques et résultats

L'unité est le cas : une prédiction est positive dès qu'au moins une alerte est produite. Précision = cas positifs correctement signalés / cas signalés ; rappel = cas positifs signalés / cas positifs ; F1 = moyenne harmonique. Intervalles à 95 % calculés par Wilson sur les proportions. Ils ne corrigent ni la proximité de certains cas synthétiques ni l'absence d'échantillonnage représentatif des tournages.

| Méthode | Précision [IC 95 %] | Rappel [IC 95 %] | F1 | Latence médiane / cas |
|---|---|---|---|---|
| Prompt simple | 84,0 % [65,3 %–93,6 %] | 100,0 % [84,5 %–100,0 %] | 91,3 % | 0.508 s |
| Extraction + RAG + comparaison | 94,4 % [74,2 %–99,0 %] | 81,0 % [60,0 %–92,3 %] | 87,2 % | 6.426 s |

Système : 17 vrais positifs, 1 faux positif, 4 faux négatifs et 28 vrais négatifs. Baseline : 21, 4, 0, 25. Erreurs de fournisseur : 0 pour le système et 0 pour la baseline.

**Interprétation :** le système émet moins de fausses alertes, mais manque davantage de points. Le prompt simple obtient ici un meilleur F1. Le seuil visé de 80 % de précision est dépassé ponctuellement, mais la borne basse de l'intervalle du système reste inférieure à 80 %. Cela ne prouve pas une supériorité globale du pipeline.

## Analyse des échecs

- Quatre points de possession manqués : C013, C024, C032, C059. Exemple : un passeport conservé par un agent réapparaît chez sa propriétaire sans restitution décrite. Le suivi des transferts reste à améliorer ; l'extraction et les actions doivent être inspectées avant de choisir la correction.
- Une fausse alerte temporelle : C051. Un lecteur cassette cassé est vu intact dans une séquence explicitement située cinq ans plus tôt.
- Les erreurs JSON initiales et la fusion d'objets génériques ont des tests de régression ; ce ne sont pas des échecs masqués du benchmark final.

## Questions sur le corpus réel

La comparaison QA réelle est **incomplète** : 10/24 questions ont leurs deux sorties fournisseur disponibles ; erreurs d'infrastructure : 14 baseline, 10 système. Un quota journalier a arrêté l’exécution. Aucun score global de qualité n'est revendiqué sur cet essai. Les sorties obtenues, y compris les réponses incorrectes, sont conservées ; voir [le journal brut](../eval/qa-real-report.json). La commande de reprise est `node --env-file=.env eval/qa-real.mjs --live` ; les nouveaux checkpoints n'autorisent une réutilisation qu'à empreintes de code, données, modèle et paramètres identiques. Une erreur fournisseur peut être retentée, une réponse valide mais fausse ne doit pas être rééchantillonnée pour améliorer le score.

## Recherche, coût et limites

Sur **12 recherches de référence dans Valkaama**, la bonne scène est retrouvée dans les cinq premiers résultats : 100,0 %. Les citations de référence ont été contrôlées dans le texte. Cette mesure porte uniquement sur la recherche, pas sur la justesse d'une analyse de continuité ou d'une réponse générée.

Le système consomme 45405 tokens d'entrée et 16483 de sortie sur les 50 tests, contre 12977 et 4449 pour la baseline. Au [tarif catalogue Groq vérifié le 2 novembre 2026](https://console.groq.com/docs/model/openai/gpt-oss-20b) (0.075 USD/M en entrée, 0.3 USD/M en sortie), l'estimation est **0.008350 USD au total**, soit 0.000167 USD/cas, contre 0.000046 USD/cas. Hors cache, remises et éventuel plan gratuit ; il ne s'agit pas du montant effectivement facturé. Les latences incluent les éventuelles attentes de quota et ne prédisent pas celles d'un long scénario.

Prochaines étapes : faire relire les annotations, recueillir l'avis d'un scripte, compléter par de vrais dossiers de production et réserver un nouveau jeu indépendant avant de retoucher le détecteur. Aucun gain de temps utilisateur n'a encore été mesuré.
