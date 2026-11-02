// Documentation du produit, rendue par l’application.
// Les résultats chiffrés restent dans les rapports mesurés.
export const guideChapters = [
  {
    id: 'utiliser',
    title: 'Utiliser Faux Raccord',
    summary: 'Choisir un scénario, relire les passages signalés et conserver ses décisions.',
    sections: [
      {
        title: 'Un parcours en trois étapes',
        paragraphs: [
          'Faux Raccord aide à relire les accessoires dans le texte d’un scénario. Il propose des points à examiner ; une alerte n’est pas une erreur avérée.',
          'Dans Scénario, ouvrir un exemple ou importer un fichier et vérifier le découpage. Dans Analyse, choisir les scènes et le moteur. Dans Relecture, comparer les deux passages puis confirmer ou écarter le point avec une note.',
        ],
        bullets: [
          'Le guide interactif utilise une copie séparée de la démonstration et se relance depuis le menu.',
          'Papier, Ardoise et Système sont des thèmes d’affichage ; ils ne changent pas les résultats.',
          'Une analyse enregistrée provient d’une exécution passée, clairement indiquée. La consulter ne lance pas une nouvelle inférence.',
        ],
      },
      {
        title: 'Choisir un scénario',
        paragraphs: [
          'L’import accepte un PDF contenant du texte, un fichier TXT, Fountain ou Markdown. Un projet JSON exporté par Faux Raccord peut aussi être réimporté. Vérifier le découpage avant l’analyse ; un PDF scanné nécessite une extraction de texte préalable.',
        ],
        table: {
          columns: ['Source', 'Contenu', 'Repères et conditions'],
          rows: [
            [
              'Valkaama original',
              'Le scénario publié par Tim Baumann, avec ses pages',
              'Il sert de source ; les erreurs injectées ne lui sont pas attribuées.',
            ],
            [
              'Valkaama — expérience contrôlée',
              'Une adaptation identifiée comportant 15 incohérences ajoutées',
              'Le journal donne les changements, leurs deux passages et la licence de l’adaptation.',
            ],
            [
              'Les Heures Creuses',
              'Une fiction synthétique pour apprendre le parcours',
              'Exemple de prise en main, distinct du scénario réel et de l’expérience contrôlée.',
            ],
            [
              'MovieSum',
              'Une recherche locale parmi les titres et IMDb ; aperçu et import en ligne',
              'Les droits du dataset ne garantissent pas ceux de chaque œuvre ; les repères sont des scènes XML.',
            ],
          ],
        },
      },
      {
        title: 'Lire un point avant de décider',
        paragraphs: [
          'Lire les deux citations, ouvrir leurs scènes et vérifier qu’il s’agit du même accessoire. Un changement peut être expliqué par une réparation, un transfert, une ellipse ou un retour dans le passé.',
          'Confirmer signifie que l’équipe retient le point ; écarter conserve une décision contraire. La note est sauvegardée avec ce statut. Une décision humaine ne réentraîne pas le modèle.',
          'Si toutes les citations du modèle sont rejetées, le résultat est signalé comme inexploitable. Zéro accessoire dans ce cas ne permet pas d’affirmer que le scénario ne contient aucune incohérence.',
        ],
      },
      {
        title: 'Conserver et partager le travail',
        paragraphs: [
          'Les projets sont conservés dans le navigateur sur cet appareil. Il n’y a pas de synchronisation entre appareils ou utilisateurs. Le projet JSON conserve texte, sources, résultats et décisions ; il peut être réimporté. Le rapport Markdown rassemble les points de relecture.',
          'Une nouvelle analyse remplace le résultat précédent après confirmation. Exporter la version à conserver avant de la relancer.',
          'Les exports contiennent du texte du scénario. Ses conditions de redistribution restent applicables.',
        ],
      },
    ],
  },
  {
    id: 'fonctionnement',
    title: 'Données et fonctionnement',
    summary:
      'Comprendre ce que génère le modèle, ce que vérifie le programme et d’où viennent les textes.',
    sections: [
      {
        title: 'Ce qui est généré',
        paragraphs: [
          'Le modèle génère des mentions structurées d’accessoires, des explications et des réponses sourcées. Le traitement suit un ordre défini ; la décision finale appartient au lecteur.',
        ],
        table: {
          columns: ['Entrée', 'Sortie du modèle', 'Contrôle du code'],
          rows: [
            [
              'Scènes du scénario',
              'JSON : accessoire, état, propriétaire, citation',
              'Champs autorisés, scène existante et citation retrouvée',
            ],
            [
              'Deux mentions et leur contexte',
              'Explication et point à vérifier',
              'Candidats fournis uniquement, sans remplacer les preuves',
            ],
            [
              'Question et passages retrouvés',
              'Réponse avec références ou NOT FOUND',
              'Identifiants connus et cohérence des références',
            ],
          ],
        },
      },
      {
        title: 'Du scénario aux passages à relire',
        code: 'Scénario → scènes et pages → extraction des accessoires\n         → contrôle des citations → changements candidats\n         → recherche du contexte → comparaison par le modèle\n         → deux passages consultables → décision du lecteur',
        paragraphs: [
          'Exemple : une montre brisée est ensuite décrite intacte. Les mentions peuvent produire un candidat. Le contexte peut révéler une réparation ou un flashback : le candidat n’est donc pas automatiquement une erreur.',
          'Une citation exacte garantit la présence du passage, pas la justesse de son interprétation.',
        ],
      },
      {
        title: 'Recherche et réglages du moteur',
        paragraphs: [
          'BM25 utilise des passages de 1 000 caractères au maximum, avec 150 caractères de recouvrement et cinq résultats au maximum. Le recouvrement limite les coupures ; les passages ne mélangent pas deux scènes. Ce sont des valeurs initiales explicables, pas des paramètres démontrés optimaux.',
          'La recherche est lexicale, sans embeddings ni LoRA. Les noms et mots exacts l’aident ; paraphrases et questions françaises sur un texte anglais peuvent la mettre en difficulté. Un score BM25 sert au classement, pas à exprimer une confiance.',
          'Groq est un fournisseur distant ; Ollama exécute des modèles sur la machine du serveur. Température, budget de sortie et paramètres compatibles sont appliqués réellement. Les deux configurations locales contrôlées, qwen3:1.7b et llama3.2:latest, ont échoué à l’extraction sur un court exemple malgré une connexion JSON réussie. Ce contrôle limité ne permet pas de juger toute leur famille.',
          'Le profil continuity-free-v1 limite chaque extraction à 3 000 tokens de sortie et chaque jugement à 1 000, avec deux candidats comparés par requête. Un budget plus petit choisi par l’utilisateur reste respecté. Ces plafonds évitent de dépasser les limites de transport ; ils ne garantissent pas un quota disponible. Le profil effectif accompagne la mesure.',
          'Le rapport conserve le modèle, les paramètres et une référence du code. Les bibliothèques sont fixées dans le lockfile, mais l’identifiant API n’est pas un snapshot immuable des poids. Un autre modèle n’hérite pas des anciens scores.',
        ],
      },
      {
        title: 'Choisir un modèle selon l’usage',
        paragraphs: [
          'La tâche demande du texte structuré, des citations exactes en anglais et des explications en français. La fidélité des états, actions et négations compte autant que le format JSON. Les fonctions de vision, d’audio et d’outillage autonome ne sont pas nécessaires à ce traitement.',
          'Le profil distant mesuré utilise openai/gpt-oss-120b sur Groq : API compatible avec les sorties JSON, licence Apache-2.0 et absence de poids à charger sur le poste. Le 120B a été retenu après épuisement du quota 20B. La comparaison publiée oppose le système au prompt simple avec le même 120B ; elle ne démontre pas une supériorité du 120B sur le 20B.',
          'Pour un traitement local, les candidats ci-dessous ont été retenus à partir des fiches des éditeurs et du catalogue Ollama, consultés le 2 novembre 2026. Ils ne sont ni installés par l’application ni évalués dans le rapport actuel. Les poids indiqués excluent le cache de contexte et la mémoire du moteur.',
        ],
        table: {
          columns: ['Candidat local', 'Poids catalogue', 'Motif de sélection', 'Licence et état'],
          rows: [
            [
              'qwen2.5:7b-instruct-q4_K_M',
              '4,7 Go',
              'Modèle instruction dont la fiche cite explicitement le JSON et les données structurées ; anglais et français.',
              'Apache-2.0 ; candidat à évaluer, mémoire à vérifier sur un GPU de 6 Go.',
            ],
            [
              'qwen3.5:4b-q4_K_M',
              '3,3 Go',
              'Profil multilingue plus compact, laissant davantage de marge au contexte sur un GPU de 6 Go.',
              'Apache-2.0 ; qualité d’extraction non mesurée.',
            ],
            [
              'phi4-mini:3.8b',
              '2,5 Go',
              'Autre famille instruction multilingue, conçue notamment pour des ressources limitées.',
              'MIT ; comparateur compact non mesuré.',
            ],
          ],
        },
        bullets: [
          'Avec 6 Go de VRAM, commencer à 8 192 tokens de contexte, une requête et un modèle chargé à la fois. Un modèle de 5 à 6 Go de poids peut déborder vers la RAM une fois le cache ajouté.',
          'Vérifier le placement CPU/GPU avec ollama ps. Un contexte annoncé de 128k ou plus ne garantit pas que la machine puisse le charger.',
          'Évaluer les mêmes cas, prompts et budgets : JSON exploitable, citations exactes, états et négations corrects, précision/rappel, durée et mémoire. Une réparation et une information absente doivent aussi être testées.',
          'Conserver identifiant, quantification, digest des poids, version Ollama et réglages. Un autre modèle ne reprend pas les scores existants.',
          'Le schéma JSON d’Ollama peut contraindre les champs ; l’application utilise actuellement le mode JSON et ses propres validations. Aucun de ces mécanismes ne garantit les faits. La désactivation du raisonnement dépend du modèle.',
        ],
        links: [
          {
            label: 'GPT-OSS 120B sur Groq',
            href: 'https://console.groq.com/docs/model/openai/gpt-oss-120b',
          },
          {
            label: 'Qwen2.5 : fiche officielle',
            href: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct',
          },
          {
            label: 'Qwen2.5 7B Q4_K_M : poids Ollama',
            href: 'https://ollama.com/library/qwen2.5:7b-instruct-q4_K_M',
          },
          {
            label: 'Qwen3.5 4B : fiche officielle',
            href: 'https://huggingface.co/Qwen/Qwen3.5-4B',
          },
          {
            label: 'Qwen3.5 4B Q4_K_M : poids Ollama',
            href: 'https://ollama.com/library/qwen3.5:4b-q4_K_M',
          },
          {
            label: 'Phi-4-mini : fiche Microsoft',
            href: 'https://huggingface.co/microsoft/Phi-4-mini-instruct',
          },
          { label: 'Phi-4-mini : poids Ollama', href: 'https://ollama.com/library/phi4-mini:3.8b' },
          { label: 'Mémoire et contexte Ollama', href: 'https://docs.ollama.com/context-length' },
          {
            label: 'Sorties structurées Ollama',
            href: 'https://docs.ollama.com/capabilities/structured-outputs',
          },
          {
            label: 'Contrôle du raisonnement Ollama',
            href: 'https://docs.ollama.com/capabilities/thinking',
          },
        ],
      },
      {
        title: 'Provenance et licence des données',
        paragraphs: [
          'Valkaama est le scénario anglais de Tim Baumann, d’après le roman de Hendrik Behnisch, version du 30 juin 2007. Le PDF et la page de l’auteur indiquent CC BY-SA 3.0. Les adaptations gardent l’attribution, signalent les changements et conservent cette licence. Le code possède sa licence MIT distincte.',
          'Les quinze incohérences de l’expérience sont des modifications volontaires. Le texte original et son PDF restent distincts. Dans l’adaptation, les numéros de page situent les scènes dans l’original ; le PDF original ne contient pas les phrases ajoutées.',
          'MovieSum fournit un index local de métadonnées et un import explicite. Sa licence de jeu déclarée CC BY-NC 4.0 ne garantit pas tous les droits des œuvres sous-jacentes. Aucun texte complet MovieSum n’est embarqué dans le dépôt.',
        ],
        links: [
          {
            label: 'Page source de Valkaama',
            href: 'https://www.valkaama.com/index.php?l=en&page=sources',
          },
          {
            label: 'Licence CC BY-SA 3.0',
            href: 'https://creativecommons.org/licenses/by-sa/3.0/',
          },
          {
            label: 'MovieSum et sa fiche de données',
            href: 'https://huggingface.co/datasets/rohitsaxena/MovieSum',
          },
        ],
      },
    ],
  },
  {
    id: 'evaluation',
    title: 'Résultats et tests',
    summary: 'Lire les mesures, leurs références et les limites de ce qu’elles démontrent.',
    sections: [
      {
        title: 'Une expérience contrôlée',
        paragraphs: [
          'L’expérience principale utilise une adaptation de Valkaama avec quinze incohérences ajoutées volontairement et quatre transitions expliquées. Les références identifient les objets et les deux passages attendus. Elles ont été proposées avec assistance IA ; leur validation humaine n’est pas encore attestée.',
          'Le scénario adapté garde ses 56 scènes. L’évaluation porte sur les scènes 1–12, contenant 15 injections et quatre transitions expliquées. Seuls ces 19 accessoires sont annotés. C’est un jeu de développement contrôlé visible, pas un test indépendant tenu secret.',
          'Les cinquante vignettes synthétiques et les vingt-quatre questions sur des passages réels sont des expériences complémentaires. Leurs unités et configurations diffèrent ; leurs scores ne forment pas un résultat global.',
        ],
      },
      {
        title: 'Mesurer par erreur et par alerte',
        paragraphs: [
          'Une injection est une incohérence attendue, identifiée avant l’exécution avec l’objet et les deux passages qui la prouvent. Une alerte retrouvée est rapprochée de cette référence. Une association doit être inspectable et ne doit pas compter plusieurs fois la même injection.',
          'Vrai positif : une injection est retrouvée avec ses deux preuves valides. Faux positif : une alerte sur un accessoire annoté est injustifiée, dupliquée ou accompagnée de preuves non conformes. Faux négatif : une injection n’a pas été retrouvée avec les preuves exigées. Un simple signalement quelque part dans le scénario ne suffit pas à retrouver les 15 erreurs.',
          'Le faux positif du prompt simple dans cette mesure est lié à une citation approximative de la montre : il a reconnu le changement, mais a modifié les mots du passage. Le score mesure donc « erreur reconnue avec preuves valides », pas seulement la plausibilité de l’explication.',
          'Les alertes sur les autres objets sont conservées à relire, mais exclues du score contrôlé faute d’annotations exhaustives. La précision affichée ne décrit donc pas toutes les alertes possibles du scénario. Le rapport donne leur nombre séparément.',
        ],
        code: 'Précision = TP / (TP + FP)\nRappel    = TP / nombre d’injections attendues\nF1        = 2 × précision × rappel / (précision + rappel)',
        bullets: [
          'La précision répond : quelle proportion des alertes est justifiée par la référence ?',
          'Le rappel répond : quelle proportion des erreurs injectées est retrouvée ?',
          'Le F1 combine les deux ; il ne décide pas du compromis utile à la place du lecteur.',
          'L’intervalle de Wilson décrit l’incertitude du petit échantillon. Les observations appartiennent au même scénario et ne sont pas indépendantes : il ne corrige ni ce biais ni une annotation discutable.',
        ],
      },
      {
        title: 'Comparaison et échecs observés',
        paragraphs: [
          'La baseline reçoit le même texte et le même modèle, avec un prompt direct. Le système ajoute extraction, contrôles et recherche avant comparaison. Le rapport garde les prédictions, les associations, les faux positifs et les injections manquées, y compris si la baseline obtient un meilleur résultat.',
          'Les références et correspondances ont été proposées avec assistance IA, sans validation humaine attestée. Après étude des erreurs, une modification du détecteur doit être évaluée sur de nouveaux cas indépendants.',
          'Dans le cas E03, le passage précise que la gourde n’a pas été remplie, mais l’extraction lui attribue l’action fill. Le changement vide → plein est alors considéré comme expliqué et écarté avant comparaison. La recherche ne peut pas corriger un candidat déjà éliminé : une négation mal interprétée peut donc faire manquer une incohérence.',
          'Latence médiane : une moitié des cas prend moins de temps et l’autre davantage. Les attentes de quota peuvent être incluses ; elles ne mesurent alors pas uniquement la vitesse du modèle. Tokens et tarifs datés permettent une estimation de coût, pas une facture garantie.',
        ],
      },
      {
        title: 'Ce que vérifient les tests',
        table: {
          columns: ['Vérification', 'Ce qu’elle démontre', 'Ce qu’elle ne démontre pas'],
          rows: [
            [
              'Tests logiciels',
              'Règles du parseur, citations, limites, paramètres, sauvegardes et calculs ; des fournisseurs sont simulés lorsque nécessaire.',
              'Que le LLM comprend correctement tout scénario.',
            ],
            [
              'Contrôles navigateur',
              'Parcours dans un navigateur : thèmes, guide, import, revue et export.',
              'Un gain de temps observé auprès d’un utilisateur métier.',
            ],
            [
              'Expérience contrôlée sur Valkaama',
              'Détection des incohérences insérées dans une adaptation identifiée.',
              'Une performance généralisée à tous les films.',
            ],
            [
              'QA réelle historique',
              'Réponse, référence et format sur des passages réels ; la grille lexicale a des limites de synonymes et de négation.',
              'La détection des erreurs de continuité.',
            ],
            [
              'Red team',
              'Comportement observé face à quelques tentatives de détournement.',
              'Une certification générale de sécurité.',
            ],
          ],
        },
        paragraphs: [
          'Les tests logiciels et les contrôles navigateur vérifient le fonctionnement du programme. Ils ne mesurent pas la compréhension du scénario par le modèle et ne remplacent pas le benchmark de continuité.',
        ],
      },
      {
        title: 'Consulter les preuves',
        paragraphs: [
          'Les rapports donnent les configurations et commandes de reproduction. Les fichiers JSON conservent les prédictions détaillées, leurs sources et les associations aux références.',
          'Une analyse enregistrée est une exécution passée, consultable sans nouvel appel au modèle. Les mesures n’autorisent pas à supposer une performance identique avec une autre configuration.',
        ],
        links: [
          {
            label: 'Rapport d’évaluation — PDF',
            href: '/docs/print/evaluation.pdf',
          },
          {
            label: 'Fiche système — PDF',
            href: '/docs/print/system-card.pdf',
          },
          {
            label: 'Rapport d’évaluation — source',
            href: '/docs/evaluation_report.md',
          },
          {
            label: 'Journal des essais adversariaux',
            href: '/docs/red_team_log.md',
          },
        ],
      },
    ],
  },
  {
    id: 'limites',
    title: 'Limites et confidentialité',
    summary:
      'Connaître le périmètre de l’outil, les protections et les conditions de traitement des textes.',
    sections: [
      {
        title: 'Périmètre de la relecture',
        paragraphs: [
          'Faux Raccord traite le texte du scénario et les accessoires explicitement mentionnés. Il ne vérifie ni les images, ni l’audio, ni le montage, et ne fournit pas de planning de tournage.',
          'Un objet peut être oublié à l’extraction, confondu avec un autre ou mal situé dans le temps. Les transferts implicites, flashbacks, homonymes et paraphrases restent difficiles. Une absence de mention ne prouve pas une disparition.',
          'Les contrôles de citations réduisent les preuves inventées. Ils ne garantissent ni une interprétation correcte ni une détection exhaustive. Les scores observés sur une adaptation contrôlée ne démontrent pas un gain de temps ou une utilité validée en tournage.',
        ],
      },
      {
        title: 'Où vont les données ?',
        paragraphs: [
          'Les projets sont conservés dans le navigateur sur cet appareil, sans synchronisation. La clé API reste dans l’environnement du serveur et n’est pas incluse dans les projets exportés.',
          'Avec Groq, l’analyse envoie les scènes sélectionnées au fournisseur ; une question envoie les passages retrouvés et la question. Utiliser uniquement des textes dont le transfert est autorisé.',
          'Avec Ollama, l’inférence a lieu sur la machine qui héberge le serveur. Un moteur local adapté permet de garder ce traitement sur cette machine. Les aperçus et imports MovieSum nécessitent toutefois un accès au service externe.',
        ],
      },
      {
        title: 'Droits et protections',
        paragraphs: [
          'L’utilisateur vérifie les droits de ses imports et des textes partagés. Un document accessible en ligne n’est pas automatiquement réutilisable. Les données personnelles doivent être autorisées ou anonymisées selon le contexte.',
          'Le programme borne la taille des imports, contrôle les identifiants et vérifie les citations. Les instructions présentes dans un scénario sont traitées comme des données ; les sorties du modèle ne sont pas exécutées comme du code ou du HTML.',
          'Chaque point doit être relu dans son contexte avant toute correction du scénario. Une décision confirmée ou écartée reste une décision du lecteur.',
        ],
        links: [
          {
            label: 'Politique d’utilisation',
            href: '/docs/use_policy.md',
          },
          {
            label: 'Fiche système',
            href: '/docs/system_card.md',
          },
        ],
      },
    ],
  },
];
