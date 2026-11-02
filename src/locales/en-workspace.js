export default {
  ' Système : {message}': ' System: {message}',
  ' Baseline : {message}': ' Baseline: {message}',
  'Lecture des scènes {first} à {last}…': 'Reading scenes {first} to {last}…',
  'Regroupement des accessoires…': 'Grouping props…',
  '{count} accessoires suivis. Vérification de {points} points…':
    '{count} props tracked. Checking {points} points…',
  'Analyse terminée.': 'Analysis complete.',
  'Jugement : candidats {first}–{last} du lot.':
    'Assessing candidates {first}–{last} in the batch.',
  'Les citations produites par le modèle ont été rejetées. Aucun accessoire exploitable n’a été extrait ; ce résultat ne permet pas de conclure à l’absence d’incohérence. Essayez un autre modèle.':
    'The model’s quotations were rejected. No usable props were extracted; this result does not establish that there are no inconsistencies. Try another model.',
  'Pipeline de production inchangé : extraction par lots de 3 scènes, rapprochement des états, récupération de contexte et jugement des candidats. Le transport divise les lots de jugement en groupes de2 (mêmes citations/contextes/prompt), sans mémoire additionnelle. Sortie : extraction3000, jugement1000, baseline3000.':
    'Unchanged production pipeline: extraction in batches of 3 scenes, state tracking, context retrieval and candidate assessment. Transport splits assessment batches into groups of 2 with the same quotations, context and prompt, without additional memory. Output limits: extraction 3,000, assessment 1,000, baseline 3,000 tokens.',
  'Les mêmes 12 scènes en deux moitiés de 6 scènes, deux appels sans mémoire ni RAG ; aucune annotation fournie. Chaque paire annotée tient dans une moitié.':
    'The same 12 scenes in two groups of 6, using two calls without memory or RAG; no annotations are provided. Every annotated scene pair fits within one group.',
  'Profil de sortie : extraction et baseline3000, jugement1000 pour les verdicts courts. Aucune réponse valide régénérée pour améliorer son score.':
    'Output profile: 3,000 tokens for extraction and the baseline, 1,000 for short assessment verdicts. No valid answer was regenerated to improve its score.',
  'Les profils précédents ont rencontré des plafonds de quota (Qwen OTPM1000, GPT-OSS20B TPD200000). Les refus restent dans executionAttempts ; les réponses de modèles différents ne sont pas mélangées.':
    'Earlier profiles hit quota limits: Qwen 1,000 output tokens per minute and GPT-OSS 20B 200,000 tokens per day. Rejected requests remain in executionAttempts; answers from different models are not mixed.',
  'La durée cumulative est la somme des durées des appels validés, pauses quota comprises. resumedWallSeconds mesure seulement la dernière reprise ; les essais refusés et sondes ne sont pas inclus dans le coût théorique.':
    'Cumulative duration adds the durations of validated calls, including quota waits. resumedWallSeconds measures only the latest resumed run; rejected attempts and probes are excluded from the theoretical cost.',
  'Expérience contrôlée principale': 'Primary controlled experiment',
  'EXPÉRIENCE DE CONTINUITÉ': 'CONTINUITY EXPERIMENT',
  '15 erreurs injectées dans un seul scénario': '15 injected errors in one screenplay',
  'Valkaama · adaptation': 'Valkaama · adaptation',
  'Une version préparée contient 19 accessoires ajoutés. Quinze de leurs transitions sont modifiées pour créer des incohérences ; quatre restent expliquées. Les 56 scènes sont conservées, les passages évalués se trouvent dans les scènes 1 à 12. Le scénario original reste intact.':
    'A prepared version contains 19 added props. Fifteen of their transitions are changed to create inconsistencies; four remain explained. All 56 scenes are retained. The evaluated passages are in scenes 1–12. The original screenplay is preserved.',
  'Ouvrir le scénario de test': 'Open test screenplay',
  'Unité : une alerte associée à une erreur injectée.':
    'Unit: one alert matched to one injected error.',
  'L’association exige l’objet et deux citations vérifiables dans les scènes attendues. Chaque erreur ne rapporte qu’un vrai positif ; les doublons coûtent de la précision.':
    'A match requires the prop and two verifiable quotations in the expected scenes. Each error can earn only one true positive; duplicate alerts reduce precision.',
  Méthode: 'Method',
  'Détectées (VP)': 'Detected (TP)',
  'Fausses alertes (FP)': 'False alerts (FP)',
  'Manquées (FN)': 'Missed (FN)',
  Précision: 'Precision',
  Rappel: 'Recall',
  F1: 'F1',
  'Prompt simple': 'Prompt-only baseline',
  Système: 'System',
  'Même texte et modèle pour les deux méthodes :': 'Both methods use the same text and model:',
  '. Les alertes sur les accessoires d’origine non annotés sont exclues de cette précision contrôlée :':
    '. Alerts concerning unannotated original props are excluded from controlled precision:',
  'pour le système,': 'for the system,',
  'pour le prompt simple. Ce score ne mesure donc pas toutes les fausses alertes possibles dans le scénario.':
    'for the prompt-only baseline. This score therefore does not measure every possible false alert in the screenplay.',
  'Comprendre les chiffres et leur incertitude': 'Understand the figures and their uncertainty',
  'Précision = VP / (VP + FP) : parmi les alertes dans le périmètre annoté, combien correspondent à une injection ? Rappel = VP / (VP + FN) : combien des 15 injections sont retrouvées ? F1 combine ces deux proportions.':
    'Precision = TP / (TP + FP): how many alerts within the annotated scope match an injected error? Recall = TP / (TP + FN): how many of the 15 injected errors are found? F1 combines both proportions.',
  'Le score exige aussi deux preuves littérales valides. Dans cet essai, le faux positif du prompt simple vient d’une citation approximative de la montre : l’erreur a été reconnue, mais la preuve est non conforme. Ce compteur ne signifie donc pas une contradiction inventée.':
    'The score also requires two valid verbatim quotations. In this run, the baseline false positive comes from an approximate quotation about the watch: it recognised the error, but its evidence was invalid. This count therefore does not mean that it invented a contradiction.',
  précision: 'precision',
  ') ; rappel': '); recall',
  '/ 15. IC descriptif à 95 % : précision': '/ 15. Descriptive 95% CI: precision',
  ', rappel': ', recall',
  '. Durée': '. Duration',
  'tokens d’entrée et': 'input tokens and',
  'de sortie. Coût catalogue indicatif :': 'output tokens. Indicative list-price cost:',
  'non défini': 'undefined',
  'non estimé': 'not estimated',
  'Une seule œuvre et des erreurs construites, dépendantes les unes des autres. Le corrigé est proposé avec assistance IA et doit être relu par l’équipe. Les intervalles de Wilson décrivent l’effectif ; ils ne prouvent aucune généralisation à un tournage réel. L’association automatique vérifie les objets et passages, sans être un jugement sémantique indépendant.':
    'One work, with constructed errors that are not independent. The answer key was proposed with AI assistance and needs human review. Wilson intervals describe the sample; they do not establish generalisation to real productions. Automatic matching checks props and passages, rather than providing an independent semantic assessment.',
  'Injections manquées par le système :': 'Injected errors missed by the system:',
  aucune: 'none',
  '. La baseline peut faire mieux sur ce jeu ; le rapport conserve aussi ses résultats.':
    '. The baseline may perform better on this dataset; its results are also retained in the report.',
  'Prompt simple :': 'Prompt-only baseline:',
  'Voir les associations des alertes aux erreurs attendues': 'Inspect alert-to-error matches',
  Alerte: 'Alert',
  Objet: 'Prop',
  Résultat: 'Result',
  'Erreur associée': 'Matched error',
  Détectée: 'Detected',
  'Fausse alerte': 'False alert',
  'Hors annotation': 'Unannotated',
  'La mesure contrôlée n’est pas encore complète. Aucun score n’est déduit des anciens tests.':
    'The controlled measurement is not complete yet. No score is inferred from earlier tests.',
  'Corrigé des 15 erreurs insérées et des 4 transitions expliquées':
    'Answer key: 15 injected errors and 4 explained transitions',
  'Ce corrigé sert à l’évaluation. Il n’est jamais envoyé au modèle pendant l’analyse. Les citations proviennent de l’adaptation de test et ont été proposées avec assistance IA ; une relecture humaine reste nécessaire.':
    'This answer key is used for evaluation. It is never sent to the model during analysis. The quotations come from the test adaptation and were proposed with AI assistance; human review is still needed.',
  'Erreur injectée': 'Injected error',
  'Transition expliquée': 'Explained transition',
  Avant: 'Before',
  Après: 'After',
  '· repère p.': '· page reference',
  'Source : Tim Baumann, scénario de Valkaama (30 juin 2007), d’après Hendrik Behnisch.':
    'Source: Tim Baumann, Valkaama screenplay (30 June 2007), based on Hendrik Behnisch.',
  'Publication de l’auteur': 'Author’s publication',
  'CC BY-SA 3.0': 'CC BY-SA 3.0',
  '. Les ajouts et modifications sont signalés, l’adaptation conserve cette licence.':
    '. Additions and edits are disclosed; the adaptation retains this licence.',
  'Vérifications complémentaires': 'Additional checks',
  'Évaluation non exécutée': 'Evaluation not run',
  'Le protocole et ses commandes sont disponibles dans le README.':
    'The protocol and commands are available in the README.',
  'Ce qui est mesuré : signaler les cas qui méritent une relecture.':
    'What is measured: flagging cases that need review.',
  'Un cas est un petit scénario ; il compte comme signalé dès qu’au moins un point est produit. Ce score ne mesure pas chaque alerte d’un film complet.':
    'A case is a short scenario; it counts as flagged as soon as at least one alert is produced. This score does not assess each alert in a full film.',
  'Comparer au prompt simple': 'Compare with the prompt-only baseline',
  'cas synthétiques': 'synthetic cases',
  'Les deux méthodes reçoivent les mêmes textes et utilisent le même modèle. Le prompt simple demande directement de repérer les changements. Le système extrait les accessoires, recherche le contexte, puis compare les passages.':
    'Both methods receive the same texts and use the same model. The baseline directly asks for changes. The system extracts props, retrieves context, then compares passages.',
  'Extraction + recherche + comparaison': 'Extraction + retrieval + comparison',
  'Latence médiane': 'Median latency',
  'Le compromis observé :': 'Observed trade-off:',
  'le système réduit les fausses alertes de': 'the system reduces false alerts from',
  à: 'to',
  ', mais manque': ', but misses',
  'cas positifs. Le prompt simple a ici un meilleur F1. Ces résultats ne prouvent pas une supériorité générale du système.':
    'positive cases. The baseline has a better F1 here. These results do not demonstrate that the system is generally better.',
  'Comment les cas ont-ils été préparés ?': 'How were the cases prepared?',
  '60 exemples synthétiques : 10 pour développer, puis 50 réservés pour cette exécution. Parmi les 50, 21 comportent un changement à relever et 29 n’en comportent pas selon les annotations proposées. Certains cas sont proches de ceux du développement ; la séparation des fichiers ne garantit pas leur indépendance.':
    '60 synthetic examples: 10 for development, then 50 reserved for this run. Of those 50, 21 contain a change to flag and 29 do not, according to the proposed annotations. Some cases resemble development examples; separate files do not guarantee independence.',
  'Les annotations ont été proposées avec assistance IA. Leur relecture automatique ne remplace pas une validation humaine. Les scores restent ceux de la version, du modèle et des paramètres enregistrés.':
    'Annotations were proposed with AI assistance. Automatic checks do not replace human validation. Scores apply only to the recorded version, model and settings.',
  'Comprendre les métriques': 'Understand the metrics',
  'D’OÙ VIENNENT LES POURCENTAGES ?': 'WHERE DO THE PERCENTAGES COME FROM?',
  'Lire les résultats en nombres de cas': 'Read results as case counts',
  'Méthode à expliquer': 'Method to explain',
  'cas positifs signalés': 'positive cases flagged',
  'Vrais positifs : le cas positif est signalé.': 'True positives: a positive case is flagged.',
  'fausses alertes': 'false alerts',
  'Faux positifs : le cas est signalé à tort.': 'False positives: a case is incorrectly flagged.',
  'cas positifs manqués': 'positive cases missed',
  'Faux négatifs : aucun point n’est signalé.': 'False negatives: no alert is produced.',
  'cas négatifs non signalés': 'negative cases not flagged',
  'Vrais négatifs : pas de fausse alerte.': 'True negatives: no false alert.',
  'Parmi les': 'Of the',
  'cas signalés, combien devaient l’être ?': 'flagged cases, how many should have been flagged?',
  'Elle indique la proportion de signalements justifiés dans ce jeu.':
    'It gives the proportion of justified alerts in this dataset.',
  'cas positifs, combien sont retrouvés ?': 'positive cases, how many are found?',
  'Il rend visibles les oublis du système.': 'It makes the system’s misses visible.',
  'Une mesure qui combine précision et rappel.': 'A measure combining precision and recall.',
  '2 × précision × rappel / (précision + rappel)': '2 × precision × recall / (precision + recall)',
  'Elle diminue si l’une des deux mesures est faible ; elle ne choisit pas le compromis à la place de l’utilisateur.':
    'It decreases when either measure is low; it does not choose the trade-off for the user.',
  'Pourquoi ne pas donner uniquement le pourcentage de bonnes décisions ?':
    'Why not report only the percentage of correct decisions?',
  'La justesse globale, ou accuracy, vaut ici (': 'Overall accuracy here is (',
  '. Elle mélange cas positifs et négatifs. Un système qui ne signale jamais rien réussirait déjà 29 cas sur 50, soit 58 %, tout en manquant les 21 changements. C’est pourquoi nous affichons précision et rappel séparément.':
    '. It mixes positive and negative cases. A system that never flags anything would already get 29 of 50 cases right, or 58%, while missing all 21 changes. That is why precision and recall are shown separately.',
  'Comment lire l’intervalle de confiance à 95 % ?':
    'How should the 95% confidence interval be read?',
  'Pour cette précision, l’intervalle de Wilson est': 'The Wilson interval for this precision is',
  '. Il montre que l’estimation reste incertaine avec peu de signalements. Il ne signifie pas que chaque alerte est fiable à 95 % et ne corrige ni les annotations discutables, ni le biais des cas synthétiques.':
    '. It shows the uncertainty of an estimate based on few alerts. It does not mean that each alert is 95% reliable, and does not correct disputed annotations or synthetic-case bias.',
  'La borne basse du système est de 74,2 %. Cette expérience ne permet donc pas d’affirmer qu’un seuil de 80 % est garanti.':
    'The system’s lower bound is 74.2%. This experiment therefore does not establish that an 80% threshold is guaranteed.',
  'Que signifient latence, tokens et coût ?': 'What do latency, tokens and cost mean?',
  'La latence médiane sépare les cas en deux moitiés : une moitié prend moins de temps, l’autre davantage. Elle inclut les attentes observées ; ce n’est pas un délai garanti pour un scénario complet.':
    'Median latency divides cases into two halves: half take less time, half take longer. It includes observed waiting times; it is not a guaranteed duration for a full screenplay.',
  'Les tokens sont les unités de texte comptées par le modèle. Pour cette méthode :':
    'Tokens are the text units counted by the model. For this method:',
  'en entrée,': 'input tokens,',
  'en sortie. Le coût estimé se calcule séparément pour l’entrée et la sortie à partir d’un tarif daté ; il ne correspond pas nécessairement à une facture.':
    'output tokens. Estimated cost is calculated separately for input and output using dated prices; it does not necessarily represent an invoice.',
  'PLUSIEURS VÉRIFICATIONS, PLUSIEURS QUESTIONS': 'DIFFERENT CHECKS ANSWER DIFFERENT QUESTIONS',
  'Ce que les autres tests permettent de conclure': 'What the other tests establish',
  'Tests du code et des parcours': 'Code and user-flow tests',
  'Vérifient le découpage des scènes, les citations, les limites d’import, les réglages, la sauvegarde et les boutons. Des fournisseurs simulés rendent ces contrôles reproductibles. Un test logiciel réussi ne prouve pas que le LLM comprend correctement un scénario.':
    'Check scene segmentation, quotations, import limits, settings, storage and controls. Mock providers make these checks reproducible. A passing software test does not prove that the LLM correctly understands a screenplay.',
  'Questions sur Valkaama': 'Questions about Valkaama',
  'Exécution complète': 'Run complete',
  'Comparaison incomplète': 'Comparison incomplete',
  'Profil QA :': 'QA profile:',
  '. Cette expérience est distincte du benchmark de continuité.':
    '. This experiment is separate from the continuity benchmark.',
  'questions disposent des deux sorties nécessaires. Les questions utilisent de vrais passages du scénario, dont quatre informations absentes. Cette expérience mesure une réponse, une référence et un contrat de format ; elle ne mesure pas les faux raccords.':
    'questions have both required outputs. The questions use real screenplay passages, including four facts absent from the text. This experiment assesses answers, references and a format contract; it does not measure continuity errors.',
  '. Avec recherche :': '. With retrieval:',
  '. La grille reste à faire relire.': '. The rubric still needs human review.',
  'Les erreurs de quota ou de connexion empêchent une comparaison complète. Aucun score global de qualité n’est revendiqué sur cet essai.':
    'Quota or connection errors prevent a full comparison. No overall quality score is claimed for this attempt.',
  'Recherche de passages': 'Passage retrieval',
  'requêtes de référence dans Valkaama. Le rappel à cinq résultats indique si la bonne scène apparaît parmi les cinq premiers passages.':
    'reference queries in Valkaama. Recall at five results indicates whether the expected scene appears among the first five passages.',
  'Résultat enregistré :': 'Recorded result:',
  'Cela ne vérifie pas la réponse générée ensuite.':
    'This does not check the answer generated afterwards.',
  'Essais adversariaux': 'Adversarial tests',
  'Des demandes essaient de détourner les instructions ou d’obtenir un secret. Les trois essais enregistrés n’ont pas réussi à le faire ; trois exemples ne prouvent pas une résistance générale.':
    'Requests attempt to override instructions or obtain a secret. The three recorded tests did not succeed; three examples do not establish general resistance.',
  'Ce qui est vérifié dans une citation': 'What is checked in a quotation',
  'Le code contrôle que les mots existent dans la scène et que les identifiants sont autorisés. Le modèle peut encore mal interpréter un passage réel. L’utilisateur doit donc lire les deux extraits avant de décider.':
    'The code checks that the words exist in the scene and that identifiers are allowed. The model can still misinterpret a real passage. The user must therefore read both extracts before deciding.',
  'Dernière exécution du projet': 'Latest project run',
  '· prompt': '· prompt',
  'appels ·': 'calls ·',
  'tokens d’entrée ·': 'input tokens ·',
  'citation(s) ou résultat(s) non conformes écartés.':
    'invalid quotation(s) or result(s) discarded.',
  'Aucune analyse dans ce projet.': 'No analysis in this project.',
  Intact: 'Intact',
  Brisé: 'Broken',
  Détruit: 'Destroyed',
  Présent: 'Present',
  Perdu: 'Lost',
  Vide: 'Empty',
  Plein: 'Full',
  Mouillé: 'Wet',
  Sec: 'Dry',
  Propre: 'Clean',
  Sale: 'Dirty',
  Ouvert: 'Open',
  Fermé: 'Closed',
  Allumé: 'Lit',
  Éteint: 'Unlit',
  Chargé: 'Loaded',
  Déchargé: 'Unloaded',
  'Non précisé': 'Unspecified',
  'À vérifier': 'To review',
  Confirmé: 'Confirmed',
  Écarté: 'Dismissed',
  'Source indisponible': 'Source unavailable',
  'Scène XML {number}': 'XML scene {number}',
  'Scène {number} · p. {pages}': 'Scene {number} · p. {pages}',
  '{count} erreurs injectées': '{count} injected errors',
  'Fiction synthétique': 'Synthetic fiction',
  'Scénario réel': 'Real screenplay',
  scènes: 'scenes',
  'Droits à documenter': 'Rights to document',
  'scènes analysées': 'scenes analysed',
  'Provenance et conditions d’utilisation': 'Source and terms of use',
  'Document ajouté par l’utilisateur.': 'Document added by the user.',
  'Consulter la source': 'View source',
  'Attribution :': 'Attribution:',
  '. Licence :': '. Licence:',
  'à documenter': 'to document',
  'Adaptation de test : les passages ajoutés et modifiés sont artificiels. Les pages situent les scènes dans l’original ; le PDF original ne contient pas ces ajouts.':
    'Test adaptation: added and edited passages are artificial. Page numbers locate scenes in the original; the original PDF does not contain these additions.',
  'Les repères proviennent des scènes XML de MovieSum. Ils ne correspondent pas aux pages d’un PDF original.':
    'These references come from MovieSum XML scenes. They do not correspond to pages in an original PDF.',
  'Lecture du scénario': 'Screenplay reader',
  Scènes: 'Scenes',
  'Chercher dans le texte': 'Search the text',
  'Scènes du scénario': 'Screenplay scenes',
  'Temps non précisé': 'Time unspecified',
  'repère XML': 'XML reference',
  'Aucune scène ne contient ce texte.': 'No scene contains this text.',
  'Scène précédente': 'Previous scene',
  'Scène suivante': 'Next scene',
  'TEXTE DU SCÉNARIO': 'SCREENPLAY TEXT',
  'Périmètre de lecture': 'Reading scope',
  'Les scènes sont examinées dans l’ordre du document.': 'Scenes are examined in document order.',
  'À partir de la scène': 'Start at scene',
  'Nombre de scènes': 'Number of scenes',
  'Sélection : scènes {first} à {last} · {count} sur {total}. Jusqu’à 60 scènes et 120 000 caractères par analyse.':
    'Selection: scenes {first} to {last} · {count} of {total}. Up to 60 scenes and 120,000 characters per analysis.',
  ' Réduisez la sélection : le texte est trop long.':
    ' Reduce the selection: the text is too long.',
  'Moteur utilisé': 'Selected engine',
  'Le même moteur extrait les accessoires et examine les changements.':
    'The same engine extracts props and examines changes.',
  'Groq · traitement distant': 'Groq · remote processing',
  'Ollama · traitement local': 'Ollama · local processing',
  'Modèle à choisir': 'Choose a model',
  Configurer: 'Configure',
  'J’autorise l’envoi des scènes sélectionnées à Groq et dispose des droits nécessaires.':
    'I authorise sending the selected scenes to Groq and hold the necessary rights.',
  'Je dispose des droits nécessaires pour traiter ces scènes en local.':
    'I hold the necessary rights to process these scenes locally.',
  'Remplacer l’analyse actuelle et ses décisions. Je peux l’exporter avant de continuer.':
    'Replace the current analysis and its decisions. I can export it before continuing.',
  'Analyser {count} scènes': 'Analyse {count} scenes',
  'Interrompre l’analyse': 'Stop analysis',
  'Résultat disponible': 'Results available',
  'Pas encore d’analyse': 'No analysis yet',
  'Analyse enregistrée': 'Recorded analysis',
  'Analyse exécutée': 'Analysis completed',
  'Scènes analysées': 'Scenes analysed',
  'Accessoires suivis': 'Tracked props',
  'Points à relire': 'Points to review',
  '{calls} appels · {seconds} s · prompt {version}':
    '{calls} calls · {seconds} s · prompt {version}',
  'Ce résultat enregistré provient d’une exécution réelle. Il est consultable sans nouvel appel au modèle.':
    'This recorded result comes from a real run. Viewing it does not call the model again.',
  'Ce résultat correspond à votre dernière exécution.': 'This result comes from your latest run.',
  'Relire les résultats': 'Review results',
  'Lancez une analyse, ou ouvrez l’exemple depuis le guide pour comprendre les résultats.':
    'Run an analysis, or open the tutorial example to understand the results.',
  'Ce que l’analyse fait': 'What analysis does',
  Repérer: 'Identify',
  'les accessoires et leurs états dans le texte.': 'props and their states in the text.',
  Comparer: 'Compare',
  'les changements en recherchant les passages liés.': 'changes using related passages.',
  Signaler: 'Flag',
  'les incompatibilités possibles avec deux citations.':
    'possible inconsistencies with two quotations.',
  'Une absence de mention ne prouve pas une disparition. Le modèle peut manquer une incohérence ou mal interpréter une scène.':
    'An absent mention does not prove that an object disappeared. The model can miss an inconsistency or misinterpret a scene.',
  'L’analyse précède la relecture': 'Analyse before reviewing',
  'Configurer l’analyse': 'Configure analysis',
  'Le texte est prêt. Lancez une analyse pour retrouver les accessoires et les points à vérifier.':
    'The text is ready. Run an analysis to identify props and points to review.',
  ' · résultat enregistré': ' · recorded result',
  'points relus': 'points reviewed',
  'Résultats de l’analyse': 'Analysis results',
  'Points à vérifier': 'Points to review',
  Accessoires: 'Props',
  'Question au scénario': 'Ask the screenplay',
  Afficher: 'Show',
  'Tous les points ({count})': 'All points ({count})',
  'Une alerte reste une hypothèse jusqu’à votre relecture.':
    'An alert remains a hypothesis until you review it.',
  'Extraction à reprendre': 'Extraction needs another run',
  'Aucun point dans cette sélection': 'No points in this selection',
  'Aucun changement signalé': 'No changes flagged',
  'Le modèle n’a pas fourni de preuves exploitables. Ce résultat ne permet pas de vérifier la continuité ; reprenez l’analyse avec un autre modèle.':
    'The model did not provide usable evidence. This result cannot establish continuity; run the analysis again with another model.',
  'Changez le filtre pour retrouver les décisions déjà prises.':
    'Change the filter to see decisions already made.',
  'Le système n’a pas signalé d’incompatibilité dans les scènes analysées. Cela ne garantit pas l’absence d’erreurs.':
    'The system did not flag an inconsistency in the analysed scenes. This does not guarantee that there are no errors.',
  'Points de continuité': 'Continuity points',
  Possession: 'Ownership',
  'État de l’accessoire': 'Prop state',
  'Passage {number}': 'Passage {number}',
  'Ce changement est-il intentionnel ?': 'Is this change intentional?',
  'Note pour l’équipe': 'Team note',
  'Contexte, correction à prévoir ou raison d’écarter le point…':
    'Context, suggested correction or reason for dismissing this point…',
  'La note est sauvegardée automatiquement. Votre décision peut être modifiée.':
    'The note is saved automatically. You can change your decision.',
  Écarter: 'Dismiss',
  'Confirmer le point': 'Confirm point',
  'Décision :': 'Decision:',
  'Remettre à vérifier': 'Mark for review again',
  'Point suivant': 'Next point',
  'Rechercher un accessoire': 'Search props',
  'Les apparitions sont classées dans l’ordre du document.':
    'Appearances are listed in document order.',
  'Aucun accessoire trouvé': 'No props found',
  'Essayez un autre nom, ou vérifiez le périmètre de l’analyse.':
    'Try another name, or check the analysis scope.',
  '{count} apparitions': '{count} appearances',
  'SUIVI D’ACCESSOIRE': 'PROP TRACKING',
  'Autres mentions :': 'Other mentions:',
  'Retrouver une information dans le texte': 'Find information in the text',
  'Le moteur recherche les passages pertinents, puis répond avec leurs références.':
    'The engine retrieves relevant passages, then answers with references.',
  'Votre question': 'Your question',
  'Qui possède l’enveloppe rouge ?': 'Who has the red envelope?',
  'Poser la question': 'Ask question',
  'Les passages retrouvés sont transmis à Groq lors de l’envoi de la question.':
    'Retrieved passages are sent to Groq when you submit the question.',
  'Les passages retrouvés sont traités par votre modèle local.':
    'Retrieved passages are processed by your local model.',
  'Recherche limitée aux {count} premières scènes. Une réponse absente du texte doit être indiquée comme introuvable.':
    'Search is limited to the first {count} scenes. Information absent from the text must be reported as not found.',
  'Information introuvable': 'Information not found',
  'Réponse avec références': 'Answer with references',
  'Les passages retrouvés ne permettent pas de répondre à cette question.':
    'The retrieved passages do not provide an answer to this question.',
  'Les textes du scénario, les citations et les résultats enregistrés restent dans leur langue d’origine.':
    'Screenplay text, quotations and recorded results remain in their original language.',
};
