# Vérification des exigences du projet

Référence : **GenAI — Project kickoff, 9 octobre 2026**, 23 pages PDF. Les numéros ci-dessous désignent les pages du PDF, qui ne correspondent pas toujours aux numéros affichés sur les diapositives. Vérification du 2 novembre 2026.

Le projet contient les composants techniques et les livrables documentaires demandés. Cela ne signifie pas que tous les critères de notation sont acquis : le besoin réel, la validation humaine des références, les contributions des trois étudiants et la démonstration ne se prouvent pas par le code seul. Aucun entretien, accord utilisateur ou résultat absent des fichiers n'est présumé.

## Exigences du produit

| Exigence du PDF | État | Preuve dans le projet et limite |
|---|---|---|
| Problème réel pour un utilisateur précisément défini (p.3–4) | Partiel | Public et situation définis dans le README. Aucun utilisateur réel nommé ni entretien documenté. Remplir [la validation utilisateur](user_validation.md) après une séance réelle. |
| Produit exécuté de bout en bout (p.3) | Réalisé techniquement | Import → scènes → extraction → recherche/comparaison → revue → export. Les scripts de vérification de parcours contrôlent aussi l'interface ; les résultats d'analyse enregistrés sont identifiés comme tels. |
| Au moins un LLM, API ou local, choix justifié (p.3) | Réalisé, comparaison de modèles limitée | Groq par défaut, Ollama en local ; adaptateur dans `src/core/model.js`. Le choix de référence est documenté. La personnalisation ne démontre pas que chaque modèle fonctionne aussi bien. |
| RAG sur une collection réelle, ou LoRA, ou les deux (p.3) | Réalisé avec un corpus étroit | RAG BM25 sur les passages réels de Valkaama ; comparaison et questions sourcées. Une œuvre, 56 scènes : pas une validation multi-auteurs. Aucune LoRA annoncée. |
| Jeu de cas réels, au moins une métrique et une baseline (p.3,9) | Partiel : réel et synthétique à distinguer | `eval/qa-real.json` définit 24 questions sur les scènes non modifiées de Valkaama ; `eval/qa-real.mjs` compare prompt simple et QA avec recherche. Les citations sont vérifiées par script, les annotations attendent une relecture humaine. Les 60 cas de continuité sont synthétiques, pas des faux raccords authentifiés dans un film. |
| Politique écrite, au moins un garde-fou et un court red team (p.3) | Réalisé, couverture limitée | `docs/use_policy.md`, validation des citations et identifiants, contrôles d'import, trois appels adversariaux réels dans `eval/red-team-results.json`. Trois essais ne prouvent pas une sécurité générale. |
| Interface essayable (p.3) | Réalisé techniquement | Application React locale ; installation et lancement dans le README. Le benchmark ne remplace pas un test d'usage. |
| Modalité image/audio/vidéo « encouraged » (p.3,21) | Facultatif, non réalisé | Le produit traite le texte. Importer un PDF avec texte n'est pas une analyse visuelle. L'absence de modalité doit être assumée, pas présentée comme une exigence manquante obligatoire. |

## Données et reproductibilité

| Exigence ou recommandation | État | Preuve ou action nécessaire |
|---|---|---|
| Données publiques avec licence, propres ou synthétiques (p.6,18) | Réalisé pour les données embarquées documentées | `data/README.md`, source auteur, attribution et licence de Valkaama ; démonstration et cas synthétiques identifiés. L'accès à d'autres scénarios n'accorde pas automatiquement leur réutilisation. |
| Documents d'entreprise seulement avec autorisation écrite (p.6) | Aucun document d'entreprise embarqué | La politique impose le droit d'usage et le droit de transfert au fournisseur pour les imports. Une vraie autorisation éventuelle relève de l'équipe, pas d'une case cochée dans l'application. |
| Pas de données personnelles sans anonymisation et consentement requis (p.6) | Périmètre actuel limité | Fictions publiées/synthétiques ; crédits des auteurs conservés. Pour une séance utilisateur ou un import confidentiel, recueillir l'accord approprié et limiter les données conservées. |
| Vérifier les licences des modèles et jeux (p.6) | Référence documentée ; autres modèles à vérifier | Fiche système pour `gpt-oss-20b` et Valkaama. Un modèle choisi librement dans les réglages exige sa propre vérification de licence avant le rendu. |
| Préférer le local et les offres gratuites (p.6) | Option disponible | Ollama local et API Groq. L'accès au fournisseur et ses quotas restent à vérifier sur la machine de démonstration. La gratuité future n'est pas garantie. |
| Ne jamais committer les clés (p.6,17) | Réalisé par conception du dépôt | `.env` ignoré ; `.env.example` sans secret ; clé conservée côté serveur, absente des exports. Vérifier de nouveau avant tout partage. |
| README permettant de lancer la démo (p.6,8) | Réalisé | Node.js, installation, configuration, lancement et scripts de vérification dans `README.md`. Chaque étudiant doit le suivre sur sa machine. |
| Versions modèles et bibliothèques fixées (p.6) | Partiel pour les poids API | `package-lock.json`, identifiants de modèles, version de prompts, paramètres et hash de code. L'API Groq n'expose pas un snapshot immuable des poids : pas de reproductibilité bit à bit annoncée. |
| Examiner dix documents, parser et lire le texte avant de construire (p.18) | Recommandation non démontrée pour dix œuvres | Un vrai PDF complet parsé, tests de pages/scènes et requêtes sourcées. Dix scènes ne sont pas dix œuvres ; ne pas revendiquer une diversité de corpus inexistante. |
| Données synthétiques étiquetées, échantillon validé (p.18) | Étiquetage fait ; validation humaine à faire | `synthetic` et statut d'annotation dans les données ; faire relire un échantillon puis les références utilisées pour le score. |

## Évaluation

| Exigence ou recommandation | État | Preuve ou limite |
|---|---|---|
| 20 cas en semaine 1, 50–100 pour le rendu (p.19) | Volume actuel atteint ; chronologie initiale non attestée | 60 cas synthétiques (10 développement, 50 test) et un jeu réel QA distinct de 24 questions. Ne pas les additionner pour faire croire à 84 tests de continuité comparables. |
| Cas difficiles et sans réponse dès le départ (p.19) | Cas actuels présents ; historique non prouvé | Flashbacks, homonymes, transitions, absences de mention et injections ; quatre questions sans réponse dans le jeu réel QA. Les négatifs de continuité ne sont pas des questions sans réponse. |
| Métrique principale et baseline prompt seul (p.19) | Réalisé pour le benchmark enregistré | Précision par cas signalé, rappel et F1 ; même LLM et mêmes textes entre méthodes. Pour le QA réel, grille lexicale + scène attendue, ou abstention correcte. Chaque protocole conserve sa propre portée. |
| Cible convenue avec l'utilisateur (p.19) | À faire | Le seuil prototype de 80 % de précision n'est pas un accord utilisateur. Recueillir et documenter une cible avant de déclarer le produit utile. |
| Incertitude, analyse des échecs et coût (p.8–9,21) | Réalisé avec limites exposées | `docs/evaluation_report.md` et résultats bruts : Wilson 95 %, confusion, quatre faux négatifs de possession, un faux positif temporel, tokens et latences. Estimation catalogue distincte d'une facture. |
| Baseline comparée honnêtement (p.9) | Réalisé | La baseline a un meilleur F1 sur les 50 cas synthétiques : 91,3 % contre 87,2 %. Le système réduit les faux positifs ; il ne surpasse pas globalement la baseline. |
| Évaluation réelle du besoin et de la généralisation (p.3–4,9) | Partiel | Corpus réel et questions sourcées présents ; aucune mesure de gain de temps, aucune annotation métier indépendante ni benchmark sur plusieurs productions. |

Les intervalles ne corrigent ni les biais du jeu synthétique ni sa ressemblance entre cas. Après lecture des erreurs du jeu réservé, une correction doit être testée sur de nouveaux cas indépendants. Un modèle ou des paramètres différents n'héritent pas des scores enregistrés.

L’essai QA réel a produit dix paires de sorties exploitables sur vingt-quatre questions ; des refus de quota ont empêché une comparaison complète. Le rapport brut conserve les réponses et erreurs, sans revendication de score global de qualité. La reprise par checkpoint est prête pour une nouvelle exécution à configuration identique ; elle conserve également les réponses fausses. La grille exige aussi des références dans le texte de réponse : elle mesure donc un contrat de format en plus du contenu et reste à faire valider.

## Dépôt, équipe et usage de l'IA

| Exigence | État | Action ou preuve |
|---|---|---|
| Groupe de trois à quatre (p.6) | Groupe de trois déclaré | Renseigner les trois noms et leurs contributions réelles dans le README. |
| Dépôt partagé dès le premier jour, inviter les autres et le professeur (p.6,17) | À confirmer par l'équipe | Le code et son historique existent. Les invitations, accès et contributions humaines ne sont pas démontrés par l'application ; ne pas antidater l'historique. |
| Chaque membre contribue du code et explique le système entier (p.6–7) | À faire vérifier aux trois membres | Contributions effectives, revue croisée et exécution individuelle. Des rôles proposés ne prouvent pas le travail accompli. |
| Déclarer les outils IA et leurs usages (p.7) | Réalisé | Section dédiée dans le README. |
| Vérifier le contenu généré (p.7) | Réalisé techniquement, validation métier partielle | Tests automatiques, parcours, sources et résultats inspectables. Relecture humaine des annotations et des conclusions à terminer. |
| Fonctions séparées, données et configuration documentées pour l'extension agentique (p.2,11,17) | Réalisé techniquement | Modules distincts pour import, recherche, modèle, extraction et stockage ; prompts versionnés, configuration de moteur et exports. L'extension agentique n'est pas dans le périmètre actuel. |

## Livrables et présentation

| Exigence | État | Preuve ou préparation |
|---|---|---|
| Code, README, dépendances, prompts et configuration versionnés (p.8) | Réalisé | Sources, `package.json`, lockfile, `.env.example`, prompts et paramètres non secrets. Le starter n'impose pas Python, Streamlit ou un fichier `requirements.txt` à un projet Node.js. |
| Jeu de test et script d'évaluation (p.8) | Réalisé | `eval/testset.jsonl`, `eval/run.mjs`, jeux et scripts complémentaires. |
| Rapport d'évaluation d'une à deux pages (p.8) | Réalisé ; réexporter après mise à jour des résultats | [Rapport PDF](print/evaluation.pdf), HTML et Markdown. Le générateur contrôle les deux pages effectives avec unpdf et l'espace avant les pieds de page. |
| Fiche système d'une page (p.8) | Réalisé ; noms/contact à renseigner | [Fiche PDF](print/system-card.pdf), HTML et Markdown : but, périmètre, modèles, données, sécurité, évaluation et limites. Une page effective vérifiée avec unpdf. |
| Démo de cinq minutes, cinq minutes de questions (p.8) | À répéter | Déroulé dans `docs/defense.md`, avec un usage réel visé, un échec et sa gestion. |
| Vidéo de secours en cas de réseau indisponible (p.8,20) | Réalisé ; lecture à tester par l'équipe | Enregistrement actualisé de 69,7 secondes : interface courante, Valkaama, démonstration, preuves et revue. Analyses enregistrées identifiées ; aucun nouvel appel LLM. `scripts/record-demo.mjs` permet de le reproduire. Fichier de rendu conservé séparément du code. |
| Réponse individuelle à une question (p.7,9) | Préparation humaine nécessaire | Chaque étudiant doit pouvoir expliquer données, prompts, code, métriques et limites. La note de projet associe 60 % de note d'équipe et 40 % d'oral individuel. |
| Canvas de neuf rubriques et pitch de deux minutes (p.13,22) | Livrable de cadrage séparé | Le PDF indique que le canvas affiché suffit et qu'aucune diapositive supplémentaire n'est nécessaire. Les documents du professeur et le canvas restent hors du dépôt applicatif, selon la consigne du groupe. Ce tableau n'en certifie pas le contenu. |

## Ce qui relève du choix de conception

Le starter fournit des exemples de stack, des modèles et une structure de dépôt (p.14–17). Il n'impose ni Streamlit/Gradio, ni Python, ni un framework d'orchestration, ni une base vectorielle. Le projet doit justifier son choix et montrer qu'il fonctionne. La recherche hybride et le reranker sont des pistes du cours ; l'exigence minimale formulée p.3 reste RAG sur documents réels ou LoRA.

La section « 2-minute pitch » précise qu'un canvas à l'écran est suffisant. Les dates intermédiaires et le plan de quatre semaines sont des jalons ; des commits créés maintenant ne prouvent pas qu'un travail avait été effectué à un jalon passé.

## Priorités avant le rendu

1. Faire essayer le produit à une personne concernée, documenter son problème et convenir d'une cible utile.
2. Faire relire les références synthétiques et les questions réelles ; conserver les désaccords et les décisions, puis figer un nouveau jeu indépendant pour toute évolution du détecteur.
3. Lancer les évaluations et vérifications de la version retenue ; conserver les rapports, modèles et paramètres correspondants. Ne pas présenter les scores d'une autre configuration comme ceux de la configuration montrée.
4. Renseigner les noms, contributions effectives et accès au dépôt ; chaque membre lance et explique le produit entier.
5. Répéter cinq minutes de démonstration avec un échec, tester la lecture de la vidéo de secours, réexporter les deux documents courts après toute actualisation des rapports.

Barème d'équipe (p.9) : problème et valeur 15 %, technique 30 %, évaluation 25 %, sécurité 15 %, démonstration et communication 15 %. Aucune matrice de conformité ne remplace l'appréciation du professeur sur ces éléments.
