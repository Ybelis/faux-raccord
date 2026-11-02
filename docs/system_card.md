# Fiche système — Faux Raccord

**Usage.** Aide à la relecture de continuité d’accessoires pour les scriptes et petites équipes de court métrage. L’application rassemble des mentions et génère des alertes à examiner, chacune appuyée par deux passages. Le gain de temps métier n’a pas été mesuré.

**Entrées / sorties.** PDF avec texte, TXT, Fountain, Markdown ; scènes et pages, objets, alertes, décisions et notes de revue. Export projet JSON et rapport Markdown. Les projets sont conservés sur l’appareil, sans synchronisation d’équipe.

**Fonctionnement.** Segmentation déterministe ; extraction JSON par lots de trois scènes ; contrôle des citations ; suivi d’états et de possession ; recherche BM25 ; comparaison par LLM ; revue humaine. Les questions recherchent des passages puis produisent une réponse citée ou une abstention. Pipeline déclenché par l’utilisateur, sans choix autonome d’outils ni action extérieure.

**Modèles.** Profil de référence historique : `openai/gpt-oss-20b` via Groq, température 0, raisonnement low, licence Apache 2.0. Dernière expérience contrôlée : `openai/gpt-oss-120b`, Apache-2.0, même modèle pour la baseline et le système. Le modèle QA 120B est identifié séparément. Ollama est disponible pour l’inférence locale ; les petits modèles testés ne sont pas validés pour une extraction fiable. Les identifiants API ne sont pas des snapshots immuables. Modèle, réglages, date et version des prompts accompagnent les analyses ; un changement impose une nouvelle évaluation.

**Profil d’inférence contrôlé.** Profil continuity-free-v1 : extraction par lots de 3 scènes, plafond de 3000 tokens de sortie ; jugement par groupes de 2 candidats, plafond de 1000 tokens ; baseline en 2 lots de six scènes, plafond de 3000 tokens. Empreinte du profil : b0ebadb133d2.

**Données et droits.** Valkaama, Tim Baumann d’après Hendrik Behnisch, version 2007-06-30, 56 scènes, **CC BY-SA 3.0**. Source : [page officielle](https://www.valkaama.com/index.php?l=en&page=sources). Adaptation pédagogique sous la même licence : 15 erreurs délibérées et quatre contrôles sur 19 accessoires ajoutés, évaluation S001–S012. Les Heures Creuses et les vignettes sont synthétiques. MovieSum est une source facultative hors benchmark ; la licence déclarée du dataset ne garantit pas les droits des scénarios sous-jacents. Importer uniquement des textes autorisés.

**Évaluation.** Mesure réelle du système et de la baseline disponible. Sur les quinze injections : précision contrôlée 100,0 % [IC 95 % 64,6 %–100,0 %], rappel 46,7 % [24,8 %–69,9 %], F1 63,6 %. 0 alertes sur des objets non annotés sont exclues de ce score et restent à relire. Les annotations sont proposées avec assistance IA, sans relecture humaine attestée ; jeu visible, œuvre unique, intervalles descriptifs. Les 50 vignettes, les 24 questions et les 12 recherches sont des expériences distinctes, pas un score global.

**Protections et confidentialité.** Clés côté serveur ; limites de taille, pages et texte ; citations et identifiants vérifiés ; documents traités comme données ; sorties non exécutées. Groq reçoit les scènes ou extraits utiles après confirmation d’envoi ; Ollama permet de les traiter localement. Trois essais adversariaux réels documentés, portée limitée. Chaque décision finale appartient à l’utilisateur.

**Hors périmètre et limites.** Pas d’analyse image, audio ou vidéo, d’OCR ni de planning de tournage. Pas de reconstruction fiable de l’ordre narratif. Identité des objets, flashbacks et transferts implicites difficiles ; recherche lexicale limitée sur les paraphrases et les langues croisées. Une citation exacte ne prouve pas la justesse d’une alerte. Aucune promesse de détection exhaustive.

**Responsables.** Équipe de trois étudiants — noms et contact à renseigner. Politique : [use_policy.md](use_policy.md). Mesures : [evaluation_report.md](evaluation_report.md). Le guide interne est accessible dans l’application, rubrique « Documentation ».
