// Source unique de la documentation interne, rendue par l'application.
// Les résultats mesurés restent dans leurs rapports JSON ; ce guide explique leur lecture.
export const guideChapters = [
  {
    id: 'utiliser',
    title: 'Utiliser Faux Raccord',
    summary: 'Lancer le projet, choisir un scénario, relire les preuves et conserver le travail.',
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
        title: 'Choisir les données',
        paragraphs: [],
        table: {
          columns: ['Source', 'Ce que l’on ouvre', 'Point à vérifier'],
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
              'Ce n’est ni un film réel ni le scénario principal de la nouvelle évaluation.',
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
        title: 'Lire un point sans se fier au seul résumé',
        paragraphs: [
          'Lire les deux citations, ouvrir leurs scènes et vérifier qu’il s’agit du même accessoire. Un changement peut être expliqué par une réparation, un transfert, une ellipse ou un retour dans le passé.',
          'Confirmer signifie que l’équipe retient le point ; écarter conserve une décision contraire. La note est sauvegardée avec ce statut. Une décision humaine ne réentraîne pas le modèle.',
          'Si toutes les citations du modèle sont rejetées, le résultat est signalé comme inexploitable. Zéro accessoire dans ce cas ne permet pas d’affirmer que le scénario ne contient aucune incohérence.',
        ],
      },
      {
        title: 'Sauvegarde, partage et confidentialité',
        paragraphs: [
          'Les projets sont conservés dans IndexedDB sur cet appareil. Il n’y a pas de synchronisation entre les trois membres. Le projet JSON conserve texte, sources, résultats et décisions ; il peut être réimporté. Le rapport Markdown rassemble les points de relecture.',
          'Une nouvelle analyse remplace le résultat précédent après confirmation. Exporter la version à conserver avant de la relancer.',
          'Groq reçoit les scènes ou passages nécessaires à l’inférence. La clé reste sur le serveur. Pour un document confidentiel, disposer de l’autorisation de transfert ou choisir un traitement local adapté. L’export reste soumis aux droits du scénario.',
        ],
      },
    ],
  },
  {
    id: 'fonctionnement',
    title: 'Données et fonctionnement',
    summary: 'Expliquer ce que génère le modèle et ce que contrôle le programme.',
    sections: [
      {
        title: 'Ce qui est généré',
        paragraphs: [
          'Le produit est une application d’IA générative avec RAG. Le LLM produit des mentions structurées d’accessoires, des explications et des réponses sourcées. Le code suit un ordre fixé et l’utilisateur prend la décision finale.',
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
        title: 'Suivre une analyse dans les fichiers',
        code: 'Document → scènes et pages → extraction JSON par lots\n         → contrôle des citations → suivi des accessoires\n         → candidats → recherche BM25 → comparaison LLM\n         → deux passages consultables → décision humaine',
        table: {
          columns: ['Fonction ou module', 'Responsabilité'],
          rows: [
            [
              'src/core/parser.js · parseScreenplay / locateQuote',
              'Repérer les en-têtes, conserver les pages et rechercher les citations après normalisation.',
            ],
            [
              'src/core/pipeline.js · validateExtraction / mergeObjects',
              'Refuser les preuves inventées et regrouper prudemment les mentions du même objet.',
            ],
            [
              'src/core/pipeline.js · findCandidates',
              'Créer des candidats pour des états ou possessions incompatibles. Une absence de mention n’est pas une disparition.',
            ],
            ['src/core/retrieval.js · retrieve', 'Classer les passages du même scénario par BM25.'],
            [
              'src/core/model.js et src/core/prompts.js',
              'Appeler le fournisseur et conserver les contrats de sortie et la version des prompts.',
            ],
            [
              'src/core/inference-profile.js',
              'Borner les sorties et répartir les jugements pour tenir les limites du fournisseur, sans changer les prompts.',
            ],
            [
              'worker/api.js, src/components/ et src/storage.js',
              'Relier les contrôles HTTP, l’interface et la sauvegarde sur l’appareil.',
            ],
          ],
        },
        paragraphs: [
          'Exemple : une montre brisée est ensuite décrite intacte. Les mentions peuvent produire un candidat. Le contexte peut révéler une réparation ou un flashback : le candidat n’est donc pas automatiquement une erreur.',
        ],
      },
      {
        title: 'Pourquoi ces réglages de recherche et de modèle ?',
        paragraphs: [
          'BM25 utilise des passages de 1 000 caractères au maximum, avec 150 caractères de recouvrement et cinq résultats au maximum. Le recouvrement limite les coupures ; les passages ne mélangent pas deux scènes. Ce sont des valeurs initiales explicables, pas des paramètres démontrés optimaux.',
          'La recherche est lexicale, sans embeddings ni LoRA. Les noms et mots exacts l’aident ; paraphrases et questions françaises sur un texte anglais peuvent la mettre en difficulté. Un score BM25 sert au classement, pas à exprimer une confiance.',
          'Groq est le fournisseur distant de référence ; Ollama utilise les modèles installés sur la machine du serveur. Température, budget de sortie et paramètres compatibles sont appliqués réellement. Un JSON valide ne garantit pas une bonne extraction : les petits modèles locaux testés ont précisément produit des citations rejetées.',
          'Le profil continuity-free-v1 limite chaque extraction à 3 000 tokens de sortie et chaque jugement à 1 000, avec deux candidats comparés par requête. Un budget plus petit choisi par l’utilisateur reste respecté. Ces plafonds évitent de dépasser les limites de transport ; ils ne garantissent pas un quota disponible. Le profil effectif accompagne la mesure.',
          'Le rapport conserve le modèle, les paramètres et une référence du code. Les bibliothèques sont fixées dans le lockfile, mais l’identifiant API n’est pas un snapshot immuable des poids. Un autre modèle n’hérite pas des anciens scores.',
        ],
      },
      {
        title: 'Provenance et licence des données',
        paragraphs: [
          'Valkaama est le scénario anglais de Tim Baumann, d’après le roman de Hendrik Behnisch, version du 30 juin 2007. Le PDF et la page de l’auteur indiquent CC BY-SA 3.0. Les adaptations gardent l’attribution, signalent les changements et conservent cette licence. Le code possède sa licence MIT distincte.',
          'L’original dans data/valkaama.json et le PDF restent intacts. Le dossier data/controlled-script/ contient la version préparée, l’adaptation avec erreurs, les annotations et la provenance. Chaque incohérence de cette expérience est une modification volontaire, pas un défaut prétendument trouvé dans l’œuvre publiée.',
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
    summary:
      'La vérité de référence, les calculs et la portée exacte des différentes vérifications.',
    sections: [
      {
        title: 'La consigne ajoutée pour notre groupe',
        paragraphs: [
          'Le professeur demande 10 à 20 erreurs de continuité insérées volontairement dans un seul scénario, une mesure de précision et de rappel, le passage source de chaque alerte dans la démonstration et la licence confirmée du scénario.',
          'L’expérience contrôlée repose sur une adaptation de Valkaama avec 15 injections. Les fichiers project.json, reference.json, annotations.json et license.json dans data/controlled-script/ permettent de distinguer le texte préparé, les modifications et leur provenance.',
          'Le scénario adapté garde ses 56 scènes. L’évaluation porte sur les scènes 1–12, contenant 15 injections et quatre transitions expliquées. Seuls ces 19 accessoires sont annotés. C’est un jeu de développement contrôlé visible, pas un test indépendant tenu secret.',
          'Le rapport principal est celui de cette expérience. Les 50 vignettes synthétiques et les 24 questions réelles des expériences précédentes restent des preuves complémentaires ; elles ne remplacent pas la nouvelle consigne.',
        ],
      },
      {
        title: 'Mesurer par erreur et par alerte',
        paragraphs: [
          'Une injection est une incohérence attendue, identifiée avant l’exécution avec l’objet et les deux passages qui la prouvent. Une alerte retrouvée est rapprochée de cette référence. Une association doit être inspectable et ne doit pas compter plusieurs fois la même injection.',
          'Vrai positif : une injection est retrouvée. Faux positif : une alerte sur un accessoire annoté est injustifiée ou compte à nouveau une injection déjà retrouvée. Faux négatif : une injection n’a pas été retrouvée. Un simple signalement quelque part dans le scénario ne suffit pas à retrouver les 15 erreurs.',
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
        title: 'Comparer honnêtement les méthodes',
        paragraphs: [
          'La baseline reçoit le même texte et le même modèle, avec un prompt direct. Le système ajoute extraction, contrôles et recherche avant comparaison. Le rapport garde les prédictions, les associations, les faux positifs et les injections manquées, y compris si la baseline obtient un meilleur résultat.',
          'Le journal d’injections et les correspondances doivent être relus par les étudiants. Une vérification automatique ou assistée par IA n’est pas une validation humaine. Après avoir étudié les erreurs, une modification du détecteur doit être évaluée sur de nouveaux cas indépendants.',
          'Échec observé E03 : le passage précise que la gourde n’a pas été remplie, mais l’extraction lui attribue l’action fill. La règle RESET considère alors le changement vide → plein comme expliqué et écarte le candidat avant comparaison. La recherche ne peut pas corriger un candidat déjà éliminé. Montrer les deux passages et l’extraction permet de comprendre cet oubli ; la correction de cette négation reste à tester sur de nouveaux cas.',
          'Latence médiane : une moitié des cas prend moins de temps et l’autre davantage. Les attentes de quota peuvent être incluses ; elles ne mesurent alors pas uniquement la vitesse du modèle. Tokens et tarifs datés permettent une estimation de coût, pas une facture garantie.',
        ],
      },
      {
        title: 'Tests de code, benchmark et essais de sécurité',
        table: {
          columns: ['Vérification', 'Ce qu’elle démontre', 'Ce qu’elle ne démontre pas'],
          rows: [
            [
              'npm test',
              'Règles du parseur, citations, limites, paramètres, sauvegardes et calculs ; des fournisseurs sont simulés lorsque nécessaire.',
              'Que le LLM comprend correctement tout scénario.',
            ],
            [
              'Scripts check-*.mjs',
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
          'Le total des tests logiciels est celui affiché par la commande dans la version présentée. Il ne faut pas le confondre avec le nombre d’injections, de questions ou de scénarios évalués.',
        ],
      },
      {
        title: 'Reproduire et consulter les preuves',
        code: 'npm test\nnpm run explain\nnode eval/controlled-run.mjs\nnode --env-file=.env eval/controlled-run.mjs --live',
        paragraphs: [
          'La validation sans --live contrôle les données sans inventer un score. L’exécution --live appelle le fournisseur et consomme un quota. Le rapport indique la commande exacte et le modèle retenu pour reproduire la mesure.',
          'npm run explain déroule un exemple du code avec des sorties de modèle simulées et annoncées. Il sert à comprendre le pipeline, pas à mesurer sa qualité.',
          'Les rapports JSON restent les preuves détaillées. Une analyse enregistrée dans la démonstration est une exécution passée, pas une nouvelle inférence en direct.',
        ],
        links: [
          { label: 'Rapport d’évaluation — PDF', href: '/docs/print/evaluation.pdf' },
          { label: 'Fiche système — PDF', href: '/docs/print/system-card.pdf' },
          { label: 'Rapport d’évaluation — source', href: '/docs/evaluation_report.md' },
          { label: 'Journal des essais adversariaux', href: '/docs/red_team_log.md' },
        ],
      },
    ],
  },
  {
    id: 'equipe',
    title: 'Préparer l’oral et le travail à trois',
    summary: 'Une démonstration courte et du travail réel que chacun peut expliquer.',
    sections: [
      {
        title: 'Déroulé de cinq minutes',
        paragraphs: [],
        table: {
          columns: ['Temps', 'Action', 'Point à expliquer'],
          rows: [
            [
              '0:00–0:45',
              'Présenter le problème de suivi des accessoires et ouvrir Valkaama.',
              'Le périmètre textuel et la licence de la source.',
            ],
            [
              '0:45–1:30',
              'Ouvrir la version contrôlée et son journal de modifications.',
              'Les erreurs sont injectées volontairement dans une adaptation, pas attribuées à l’original.',
            ],
            [
              '1:30–3:00',
              'Choisir une alerte et ouvrir ses deux passages, puis prendre une décision.',
              'Citation retrouvée, interprétation à relire et décision humaine sont trois choses distinctes.',
            ],
            [
              '3:00–4:00',
              'Montrer une erreur manquée ou une fausse alerte réellement observée.',
              'La limite constatée et la manière dont le lecteur la traite.',
            ],
            [
              '4:00–5:00',
              'Présenter précision, rappel et baseline ; garder la vidéo de secours disponible.',
              'Le résultat de la version mesurée et la portée limitée de l’expérience.',
            ],
          ],
        },
      },
      {
        title: 'Les quatre questions à savoir traiter seuls',
        table: {
          columns: ['Question probable', 'Réponse à comprendre'],
          rows: [
            [
              'Pourquoi ces passages de 1 000 caractères ?',
              'Limiter le contexte et garder les sources consultables ; 150 caractères de recouvrement limitent les coupures. Ce choix initial n’a pas été démontré optimal.',
            ],
            [
              'Si la réponse n’est pas dans les documents ?',
              'La QA demande NOT FOUND ; le code s’abstient aussi en l’absence de sources valides. Une recherche qui manque le bon passage peut provoquer une abstention erronée.',
            ],
            [
              'Comment calculez-vous le score ?',
              'Montrer les injections attendues, les alertes et leurs associations ; calculer TP, FP et FN avant d’annoncer précision et rappel.',
            ],
            [
              'Que se passe-t-il si l’on change le modèle ?',
              'Le JSON, les citations, les objets et les délais peuvent changer. Une connexion réussie ne remplace pas une nouvelle évaluation.',
            ],
          ],
        },
        paragraphs: [
          'Pour expliquer le code, suivre une seule montre : texte → scène → mention JSON → citation contrôlée → candidat → comparaison → décision. Retrouver les fonctions correspondantes est plus utile que réciter toutes les lignes.',
        ],
      },
      {
        title: 'Se répartir des contributions réelles',
        table: {
          columns: ['Partie', 'Travail concret à réaliser', 'Relecture croisée'],
          rows: [
            [
              'Données et références',
              'Vérifier les 15 modifications, leurs passages et la licence ; corriger un défaut d’import observé ou ajouter un contrôle de provenance utile avec son test.',
              'Expliquer aussi le pipeline et le calcul du score.',
            ],
            [
              'Modèle et recherche',
              'Exécuter un exemple, inspecter les preuves rejetées et ajouter ou corriger un test pour un défaut réellement constaté.',
              'Vérifier aussi l’import et les décisions dans l’interface.',
            ],
            [
              'Interface et évaluation',
              'Effectuer les tâches de prise en main, vérifier les exports et les chiffres, corriger un problème observé.',
              'Vérifier aussi les données et les limites des prompts.',
            ],
          ],
        },
        paragraphs: [
          'L’historique actuel est attribué à Ybelis, sans auteur ou co-auteur Codex. Les futures contributions peuvent être faites par chaque membre sous sa propre identité et relues avant intégration. Réattribuer artificiellement les commits passés ne crée pas du travail accompli.',
          'La déclaration des outils IA reste dans le README, comme demandé dans le cours. Le nom Git n’est pas une preuve de compréhension ; chaque membre doit pouvoir expliquer le système entier et décrire sa contribution réelle.',
          'Chacun clone le dépôt partagé, configure son identité sur sa copie, crée une branche et commit uniquement ses changements réels. Les deux autres relisent la proposition avant intégration. Une annotation ou une documentation seule ne remplit pas la consigne demandant une contribution au code de chaque membre.',
        ],
        code: 'git config user.name "Votre nom"\ngit config user.email "Adresse associée à votre compte GitHub"\ngit switch -c prenom/donnees\ngit add chemin/du/fichier\ngit commit -m "Décrire le changement réellement effectué"',
      },
      {
        title: 'Un test interne de dix minutes',
        paragraphs: [
          'Les retours déjà reçus du groupe portaient sur les clics trop nombreux et le manque de compréhension. Ils ont conduit au parcours en trois étapes, au guide et aux explications de résultats. Ce sont des retours authentiques, pas une validation de gain de temps en tournage.',
          'Faire tourner trois rôles : utilisateur, observateur, chronométreur. Avant l’essai, convenir d’une cible, par exemple réussir trois tâches en moins de dix minutes avec au maximum une aide. Noter la cible initiale et les observations réelles, sans remplir des succès à l’avance.',
        ],
        bullets: [
          'Ouvrir la démonstration et identifier le caractère synthétique et l’analyse enregistrée.',
          'Relire un point, retrouver ses sources et enregistrer une décision motivée.',
          'Exporter le projet JSON, le réimporter et retrouver note et statut.',
          'Noter date, version, participant, durée, aides, tâches réussies et difficulté principale ; faire tourner les rôles.',
          'Présenter cet essai comme une vérification de prise en main. Il ne prouve pas le besoin métier des scriptes si aucun participant ne prépare réellement un tournage.',
        ],
      },
    ],
  },
  {
    id: 'exigences',
    title: 'Exigences et limites',
    summary:
      'Ce que demandent le cours et vos consignes, avec les preuves et les limites restantes.',
    sections: [
      {
        title: 'Le brief et la consigne propre au groupe',
        paragraphs: [
          'Implémenté décrit une fonction présente dans le code. Mesuré renvoie à un rapport d’exécution réel. Une relecture ou une contribution humaine reste à faire tant que les étudiants ne l’ont pas réellement accomplie.',
        ],
        table: {
          columns: ['Exigence', 'État', 'Preuve', 'Limite à dire'],
          rows: [
            [
              'Au moins un LLM et RAG ou LoRA',
              'Implémenté',
              'LLM Groq/Ollama, recherche BM25 sur les passages du scénario.',
              'Pas de LoRA, ni de qualité identique pour tous les modèles.',
            ],
            [
              '10–20 erreurs volontairement injectées dans un scénario',
              'Construit ; relecture humaine à faire',
              'Version contrôlée de Valkaama et journal de 15 injections dans data/controlled-script/.',
              'L’original reste intact ; la mesure est celle du rapport contrôlé, pas celle des anciennes vignettes.',
            ],
            [
              'Précision, rappel et baseline',
              'Protocole implémenté ; mesure dans le rapport',
              'Associations inspectables par alerte et référence ; rapport d’exécution avec le même modèle pour les deux méthodes.',
              'Un petit corpus contrôlé n’établit pas une généralisation métier.',
            ],
            [
              '20 cas au départ, 50–100 au final, avec cas piégeux et sans réponse',
              'Jeux disponibles, expériences distinctes',
              '50 vignettes de test historiques, 24 questions sur Valkaama dont quatre sans réponse ; 15 injections pour la consigne propre au groupe.',
              'Ces nombres ne s’additionnent pas pour prétendre avoir autant d’erreurs réelles indépendantes. Les annotations restent à relire.',
            ],
            [
              'Passage source pour chaque alerte',
              'Implémenté',
              'Deux preuves consultables avec leurs scènes ; citations introuvables rejetées.',
              'Un passage présent peut être mal interprété.',
            ],
            [
              'Licence du scénario confirmée',
              'Vérifié sur la source publiée',
              'Valkaama publié par l’auteur sous CC BY-SA 3.0 ; attribution et modifications conservées.',
              'Les droits d’une autre source doivent être vérifiés séparément.',
            ],
            [
              'Politique, garde-fou et red team',
              'Écrit, implémenté et essais enregistrés',
              'Politique écrite, contrôle des preuves, limites d’import et essais adversariaux enregistrés.',
              'Un petit nombre d’attaques ne certifie pas une résistance générale.',
            ],
            [
              'Interface et README reproductibles',
              'Implémenté',
              'Application React locale, dépendances fixées et commandes de lancement.',
              'Les poids de l’API ne sont pas fournis sous un snapshot immuable.',
            ],
            [
              'Prompts, configuration, tests et versions conservés',
              'Versionné',
              'src/core/prompts.js, paramètres effectifs dans les rapports, package-lock.json et scripts eval/.',
              'Relancer après un changement de code ou de modèle ; un ancien enregistrement ne mesure pas automatiquement la nouvelle version.',
            ],
            [
              'Licences des modèles et données ; pas de données personnelles sans autorisation',
              'Sources documentées ; imports à vérifier',
              'Licence du modèle et lien source dans le rapport ; licence et attribution de Valkaama dans les données. Les personnages du scénario sont fictifs.',
              'L’utilisateur doit vérifier les droits et les données personnelles de ses propres imports ; MovieSum ne garantit pas tous les droits sous-jacents.',
            ],
            [
              'Coût et secrets',
              'Contrôles implémentés',
              '.env ignoré, clé côté serveur, budget de sortie, tokens et coût indicatif des appels enregistrés.',
              'Le quota gratuit n’est pas garanti ; un tarif indicatif ne mesure pas une facture et n’inclut pas nécessairement tous les essais.',
            ],
            [
              'Rapport 1–2 pages et fiche système 1 page',
              'Livrables fournis',
              'Deux PDF dans docs/print/, avec leurs sources Markdown.',
              'Les noms et contributions doivent refléter le travail réellement effectué.',
            ],
            [
              'Utilisateur, situation et cible utile',
              'Retours internes présents ; validation métier non acquise',
              'Public visé défini et retours internes consignés ; test de prise en main proposé.',
              'L’utilité métier et un gain de temps réel restent à valider. Le PDF ne requiert pas explicitement un professionnel extérieur.',
            ],
            [
              'Trois à quatre étudiants, chacun contribue et explique',
              'Groupe déclaré ; travail humain à documenter',
              'Groupe de trois déclaré ; plan de travail et relecture croisée.',
              'L’outil ne peut pas fabriquer les contributions ni les réponses individuelles.',
            ],
            [
              'Outils IA déclarés et code vérifié',
              'Déclaration fournie ; compréhension à acquérir',
              'Section outils du README, tests du code et parcours navigateur ; exemple exécutable npm run explain.',
              'Chaque membre doit expliquer toute partie à l’oral. Les tests ne remplacent pas cette responsabilité.',
            ],
            [
              'Démo cinq minutes, questions, échec et vidéo de secours',
              'Parcours et enregistrement préparés',
              'Plan de démonstration dans ce guide ; script record-demo.mjs avec analyse réelle enregistrée, citations, métriques et limite observée.',
              'La vidéo doit correspondre à la version montrée. La répétition et la réponse individuelle restent du travail du groupe.',
            ],
          ],
        },
      },
      {
        title: 'Vérification de vos demandes',
        paragraphs: [],
        table: {
          columns: ['Demande', 'Choix du projet'],
          rows: [
            [
              'Nom Faux Raccord et idée utile, explicable',
              'Suivi textuel d’accessoires, preuves et revue humaine ; l’originalité absolue n’est pas une mesure revendiquée.',
            ],
            [
              'Pas de Streamlit, interface soignée et responsive',
              'React, thèmes Papier/Ardoise/Système et contrôles navigateur à plusieurs tailles.',
            ],
            [
              'Moins de clics et tutoriel relançable',
              'Trois étapes principales, comparaison dans la même vue et guide isolé du projet réel.',
            ],
            [
              'Données disponibles, sources multiples et ajout de scénarios',
              'Valkaama, import utilisateur et MovieSum ; provenance conservée et conditions affichées.',
            ],
            [
              'Personnalisation Groq/Ollama',
              'Catalogue, modèle libre, paramètres, préférences et contrôle de connexion ; les limites de qualité restent visibles.',
            ],
            [
              'Code et chiffres faciles à expliquer',
              'Fonctions séparées, commentaires sur les choix, exemple exécutable et guide interne unique.',
            ],
            [
              'Éviter l’accumulation de documents',
              'Ce guide remplace les notes redondantes ; seuls les livrables de cours sont conservés séparément.',
            ],
            [
              'Travailler en local pour le moment',
              'Lancement et vérification locaux ; aucune nouvelle publication nécessaire.',
            ],
            [
              'Commits du projet uniquement',
              'Code, données de l’application et livrables ; documents du professeur et canvas hors du dépôt applicatif.',
            ],
          ],
        },
      },
      {
        title: 'GenAI, modalité et suite agentique',
        paragraphs: [
          'La page 2 du PDF sépare le rendu Generative AI du 3 novembre et le cours Agentic AI qui commence les 4–5 novembre. Le rendu actuel est un pipeline défini : le modèle produit des informations et explications, le lecteur décide.',
          'Une future version agentique pourrait recevoir un objectif global, choisir les scènes ou outils nécessaires après comparaison de versions, demander des informations manquantes et suivre l’avancement. Ces fonctions ne sont pas déjà implémentées.',
          'Image, audio et vidéo sont indiqués comme encouragés lorsqu’ils apportent une valeur réelle. Le périmètre actuel est textuel ; ni l’import PDF ni la vidéo de secours ne sont une fonctionnalité multimodale. Comparer une photo d’accessoire au texte serait une extension pertinente à évaluer avec ses propres données. Une dictée de question n’a pas été ajoutée uniquement pour remplir une case.',
          'Le type de données et l’autonomie sont deux axes distincts. Traiter une image ne rend pas une application agentique ; un agent peut utiliser seulement du texte. Une éventuelle consigne orale supplémentaire doit être distinguée du brief écrit.',
        ],
      },
      {
        title: 'Les limites à garder visibles',
        paragraphs: [],
        bullets: [
          'Texte uniquement : pas de vision, d’OCR, de montage ni de planning de tournage.',
          'Identité des objets, transferts implicites, flashbacks, paraphrases et langues croisées restent difficiles.',
          'Le résultat d’un modèle ou d’une configuration ne vaut pas pour les autres modèles proposés.',
          'Les annotations proposées avec assistance IA attendent une vraie relecture humaine ; un audit automatique ne la remplace pas.',
          'Les projets restent sur l’appareil ; leur export ne dispense pas de respecter les droits de redistribution.',
        ],
        links: [
          { label: 'Politique d’utilisation', href: '/docs/use_policy.md' },
          { label: 'Fiche système', href: '/docs/system_card.md' },
        ],
      },
    ],
  },
];
