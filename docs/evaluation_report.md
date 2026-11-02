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

Exécution réelle du 02/11/2026, modèle `openai/gpt-oss-120b`, code `317d4f315597`. **24 questions** sur les scènes 1–10 de Valkaama : vingt réponses appuyées par un passage inchangé et quatre informations absentes. Cette configuration QA est distincte du benchmark de continuité `openai/gpt-oss-20b`. Le profil 120B a été choisi pour son quota disponible après saturation du profil 20B ; il ne remplace pas rétroactivement les anciens scores. Les questions et grilles ont été proposées avec assistance IA ; citations contrôlées par script, relecture étudiante en attente. La baseline reçoit les dix scènes intégrales ; le système cherche sur les mêmes dix scènes.

| Méthode | Réponse conforme et scène citée, ou abstention correcte [IC 95 %] | Abstentions correctes | Durée médiane observée |
|---|---|---|---|
| Prompt simple | 16/24 · 66,7 % [46,7 %–82,0 %] | 4/4 | 57.003 s |
| Questions avec RAG | 19/24 · 79,2 % [59,5 %–90,8 %] | 4/4 | 0.573 s |

Les durées QA incluent la régulation des quotas de tokens ; elles ne comparent pas la vitesse intrinsèque des modèles. La grille exige les éléments lexicaux attendus, la scène dans le champ des citations et une référence dans le texte, ou `NOT FOUND` sans citation. Des synonymes valables peuvent être rejetés et une négation peut échapper à cette grille. C'est un indicateur automatique approximatif, pas un jugement sémantique indépendant. Les échecs observés du système sont : QA008, QA012, QA013, QA016, QA018. Tokens système : 44044 entrée, 1789 sortie ; baseline : 134090, 1711. [Résultats détaillés](../eval/qa-real-report.json). Cette mesure porte sur les questions, pas sur la continuité ; elle ne démontre pas une généralisation à d'autres œuvres.

## Recherche, coût et limites

Sur **12 recherches de référence dans Valkaama**, la bonne scène est retrouvée dans les cinq premiers résultats : 100,0 %. Les citations de référence ont été contrôlées dans le texte. Cette mesure porte uniquement sur la recherche, pas sur la justesse d'une analyse de continuité ou d'une réponse générée.

Le système consomme 45405 tokens d'entrée et 16483 de sortie sur les 50 tests, contre 12977 et 4449 pour la baseline. Au [tarif catalogue Groq vérifié le 2 novembre 2026](https://console.groq.com/docs/model/openai/gpt-oss-20b) (0.075 USD/M en entrée, 0.3 USD/M en sortie), l'estimation est **0.008350 USD au total**, soit 0.000167 USD/cas, contre 0.000046 USD/cas. Hors cache, remises et éventuel plan gratuit ; il ne s'agit pas du montant effectivement facturé. Les latences incluent les éventuelles attentes de quota et ne prédisent pas celles d'un long scénario.

Prochaines étapes : faire relire les annotations, recueillir l'avis d'un scripte, compléter par de vrais dossiers de production et réserver un nouveau jeu indépendant avant de retoucher le détecteur. Aucun gain de temps utilisateur n'a encore été mesuré.
