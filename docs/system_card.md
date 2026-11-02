# Fiche système — Faux Raccord

**Objet.** Atelier de continuité textuelle pour scriptes et équipes de courts
métrages. Le besoin auprès d'un utilisateur réel reste à valider par le groupe.

**Entrées / sorties.** Scénarios PDF avec texte, TXT, Fountain ou Markdown.
Sorties : scènes, accessoires, mentions, points de continuité sourcés et décisions
de revue. Export projet JSON et rapport Markdown.

**Modèles.** Référence : `openai/gpt-oss-20b` via Groq, température 0,
raisonnement `low` ; Ollama en option locale. Catalogue, identifiant et réglages
sont personnalisables ; chaque modèle choisi exige un contrôle de compatibilité
et de licence. L'API Groq n'expose pas de snapshot immuable ; modèle, paramètres,
date et version des prompts accompagnent les nouvelles analyses.
Le modèle ouvert est sous [Apache 2.0](https://huggingface.co/openai/gpt-oss-20b).
Groq décrit un modèle MoE de 20B paramètres, dont 3,6B actifs, avec sa précision
TruePoint ; l'infrastructure et cette précision ne sont pas contrôlées par le groupe.
Les scores de référence ne s'appliquent pas aux autres configurations.

**Données.** Valkaama : Tim Baumann d'après Hendrik Behnisch, version 2007-06-30,
CC BY-SA 3.0 ; 56 scènes extraites avec leurs pages. Fiction synthétique
Les Heures Creuses, distincte du corpus réel. Évaluation : 60 cas synthétiques
contrôlés, dix pour développer et cinquante pour tester ; 24 questions distinctes
sur de vrais passages de Valkaama. Annotations assistées par IA, non encore
validées par les étudiants. MovieSum est une bibliothèque externe facultative,
hors benchmark ; sa licence de jeu déclarée CC BY-NC 4.0 ne garantit pas les
droits des œuvres sous-jacentes.

**Fonctionnement.** Segmentation déterministe des scènes ; extraction JSON par
lots ; rejet des citations introuvables ; suivi d'états et de possession ;
recherche BM25 de passages associés ; comparaison par le LLM ; revue humaine.
Les questions utilisent la recherche puis une réponse avec citations ou abstention.

**Évaluation.** Rapports complets dans `eval/report.json` et
`docs/evaluation_report.md`. Comparaison au même LLM avec prompt simple,
précision/rappel/F1, incertitude de Wilson à 95 %, erreurs et latence.
Le benchmark synthétique ne mesure pas la généralisation aux films réels.
Sur les 50 cas réservés : précision **par cas signalé** 94,4 % [74,2–99,0], rappel 81,0 %, F1
87,2 %. Baseline : précision 84,0 %, rappel 100 %, F1 91,3 %. Le système émet
moins de fausses alertes, mais n'est pas globalement supérieur à la baseline.
Les questions réelles testent séparément éléments de réponse, source et
abstention ; elles ne mesurent pas la continuité. Aucun gain de temps observé.

**Protections.** Pas de clé dans le navigateur ; limites de taille et de pages ;
PDF sans exécution de scripts ; recherche des citations après normalisation ; citations
inventées rejetées ; instructions des documents traitées comme données ;
sorties rendues comme texte ; décision finale conservée par l'utilisateur.

**Limites.** Pas de vision, d'OCR ni de planning de tournage. L'ordre narratif,
les objets homonymes et les transitions implicites restent difficiles. RAG
lexical : paraphrases et questions multilingues limitées. Les projets restent
sur l'appareil et ne sont pas synchronisés entre membres.

**Responsables.** Équipe de trois étudiants — noms et contact à renseigner.
