# Préparer la démonstration et les questions

Les réponses ci-dessous décrivent le prototype et ses preuves actuelles. Elles ne remplacent pas l'exécution du code par les trois membres. Il faut pouvoir ouvrir la fonction ou le résultat cité, puis montrer un exemple.

## Questions sur le besoin

**Qui utilise le produit ?** Le public visé est un scripte ou une petite équipe préparant le suivi des accessoires d’un scénario. Les premiers retours internes du groupe ont porté sur la prise en main et ont conduit à simplifier le parcours. Le test interne permet d’observer cet usage ; il ne prouve pas un gain de temps en tournage. Aucun entretien métier n’est revendiqué.

**Pourquoi avez-vous parlé d’un agent ?** Le mot avait été employé trop largement. Le rendu actuel est une application d’IA générative avec RAG : le LLM produit des fiches, des explications et des réponses sourcées dans un parcours fixé par le code. Le calendrier p.2 sépare ce rendu du cours suivant. Voir [le positionnement du projet](positionnement-generatif.md).

**Quel gain apportez-vous face à une relecture manuelle ?** Une chronologie consultable, deux passages réunis pour chaque point signalé et une trace de la décision. Le gain de temps n'a pas encore été mesuré. Pour le démontrer, nous devons comparer une tâche réelle avec et sans outil, et compter le temps ainsi que les oublis et fausses alertes.

**Pourquoi parler de faux raccords si vous ne regardez pas le film ?** Le nom désigne ici des incohérences textuelles potentielles d'accessoires avant le tournage. Le produit n'analyse ni les plans ni le montage. Un changement volontaire de mise en scène ne devient pas automatiquement une erreur.

## Questions sur la technique

**Est-ce seulement un prompt ?** Non. Le parseur conserve scènes et pages ; le LLM extrait un JSON ; le code vérifie les citations et suit les objets ; des règles construisent des candidats ; BM25 retrouve du contexte ; un second prompt compare ; une personne tranche. Le parcours des questions utilise aussi recherche, génération et contrôle des citations. Voir [architecture](architecture.md) et [lecture du code](code_walkthrough.md).

**Pourquoi du RAG plutôt qu'envoyer le scénario entier ?** Il rend les sources consultables et borne le contexte de comparaison. C'est un choix d'architecture, pas une supériorité mesurée dans tous les cas. Sur les courts cas synthétiques, la baseline avec texte intégral a même un meilleur F1. Un benchmark de longs scénarios serait nécessaire pour démontrer l'avantage du découpage.

**Où est la collection réelle ?** Le corpus réel embarqué est le scénario Valkaama, segmenté en 56 scènes puis en passages. Les recherches portent sur ces unités du document choisi. C'est une collection de passages issue d'une seule œuvre, donc un corpus étroit. Ajouter des œuvres exige de vérifier leurs droits et de mesurer à nouveau, sans mélanger les objets de scénarios différents.

**Pourquoi BM25 sans embeddings ni reranker ?** Les noms d'accessoires sont souvent des indices lexicaux explicites ; BM25 est léger, reproductible et explicable. Il peut échouer sur une paraphrase ou une question française à propos d'un texte anglais. La recherche hybride suggérée dans le cours reste une piste à comparer, pas une obligation technique ni un résultat déjà acquis.

**Pourquoi 1 000 caractères et 150 de recouvrement ?** Pour limiter le contexte transmis tout en conservant un peu du passage voisin, sans traverser les scènes. Ce sont des valeurs initiales, pas un optimum démontré. Une ablation pourrait comparer plusieurs tailles et recouvrements sur les mêmes requêtes réelles réservées.

**Pourquoi ce modèle ?** L'exécution de référence utilise `openai/gpt-oss-20b` sur Groq, compatible avec le format JSON demandé et accessible sans GPU local. Les latences et tokens sont mesurés. Les réglages permettent d'autres choix ; les scores de ce modèle ne s'appliquent pas aux autres. Le choix n'est pas fondé sur une comparaison exhaustive de modèles.

**Que se passe-t-il si on change de modèle ?** La qualité de l'extraction, les noms d'objets, les limites de contexte, le JSON, la latence et les coûts peuvent changer. L'adaptateur vérifie la réponse structurée, mais il faut tester la connexion et relancer l'évaluation avant d'annoncer une qualité équivalente. Le modèle ne doit pas être changé pendant la présentation d'un score enregistré.

**Pourquoi pas de LoRA ?** Le projet emploie du RAG ; l'énoncé permet RAG ou LoRA. Nous n'avons pas un jeu suffisamment riche et validé pour justifier un entraînement. Une LoRA ne corrigerait pas à elle seule l'identité des objets ou la chronologie narrative.

**Comment savez-vous que deux objets sont les mêmes ?** Le nom canonique, les mentions et les propriétaires guident un regroupement heuristique. Certaines collisions d'objets génériques sont évitées, mais ce n'est pas une identification certaine. C'est une limite à montrer, pas à masquer.

**Vous détectez tous les changements d'état ?** Non. Le code examine les changements définis dans `OPPOSITE`, par exemple brisé → intact. Un état inconnu ou une absence de mention ne crée pas une contradiction. Les transferts et les temporalités restent difficiles.

## Questions sur les données et l'évaluation

**Les données sont-elles inventées ?** Le texte de Valkaama provient du scénario publié par l'auteur, avec ses pages et sa licence CC BY-SA 3.0. Les Heures Creuses et les 60 cas de continuité sont des fictions synthétiques signalées comme telles. Les questions QA réelles portent sur les événements non modifiés de Valkaama. Leur rédaction et leurs annotations ont été assistées par IA et doivent être relues par l'équipe.

**Que signifie votre précision de 94,4 % ?** Sur 50 cas synthétiques réservés, le système signale 18 cas, dont 17 positifs selon les références proposées : `17 / 18`. Il retrouve 17 des 21 positifs : rappel de 81,0 %. Le score porte sur des cas contenant au moins une alerte ; il ne mesure pas chaque alerte d'un scénario complet. Les références ne sont pas encore validées par des étudiants.

**Votre baseline est meilleure : à quoi sert le pipeline ?** Le prompt simple obtient un meilleur F1, 91,3 % contre 87,2 %. Le système réduit les fausses alertes de quatre à une mais manque quatre cas. Il apporte des états intermédiaires, des sources et un processus de revue. Sa supériorité globale n'est pas démontrée ; il faut vérifier si ce compromis est utile à l'utilisateur.

**Que prouvent les intervalles de confiance ?** Ils rendent visible l'incertitude liée au petit nombre de cas. Pour la précision du système, Wilson à 95 % donne 74,2–99,0 %. La borne basse ne confirme donc pas un seuil de 80 %. Des cas synthétiques proches ne sont pas un échantillon aléatoire représentatif des tournages : l'intervalle ne corrige pas ce biais.

**Comment évitez-vous de juger le modèle avec le même modèle ?** Le benchmark de continuité compare les prédictions à des étiquettes fixes ; le juge LLM fait partie du produit, pas de la référence. Le test QA emploie une grille déterministe et les scènes attendues. Mais les références ont été proposées avec assistance IA : une validation humaine indépendante reste nécessaire. Nous ne présentons pas cette méthode comme une vérité métier acquise.

**Le test réservé est-il encore indépendant après les corrections ?** Les scores conservés appartiennent à la version indiquée par leur hash. Après lecture des erreurs, ces cas deviennent connus. Toute correction fondée sur eux doit être évaluée sur de nouveaux cas réservés ; il faut garder les anciens résultats, sans les remplacer silencieusement.

**Le résultat de recherche à 100 % prouve-t-il que tout fonctionne ?** Non. Douze requêtes lexicales retrouvent leur scène dans les cinq premiers passages. Cela teste la recherche sur un seul texte, pas la réponse du modèle, la continuité ou l'utilité utilisateur. Les questions QA réelles apportent une mesure différente, toujours sur une portion du même scénario.

**Comment gérez-vous une information absente ?** Le prompt QA demande `NOT FOUND`. Le code s'abstient aussi en l'absence de passages, de citations ou avec des identifiants inventés. Une source existante peut pourtant être mal interprétée : nous montrons les passages et incluons des questions sans réponse dans l'évaluation réelle.

**Une réponse correcte peut-elle être notée fausse ?** Oui : la grille QA est stricte et approximative. Elle exige les éléments lexicaux attendus, la scène correcte dans le champ `citations` et un repère entre crochets dans le texte de réponse. Dans l’essai historique 20B, QA006 donne un état correct et une référence séparée, mais omet le repère dans le texte : cela constitue un échec de format dans ce protocole. Il faut distinguer contenu, source et format, puis faire valider une grille indépendante avant une nouvelle mesure. Nous ne changeons pas la grille après coup pour relever le score. Le profil 120B possède son propre rapport ; il ne remplace pas les observations du profil 20B.

**Quel coût pour un scénario ?** Les rapports enregistrent les tokens et les durées réels. Le coût catalogue se calcule séparément entrée/sortie et reste une estimation, pas une facture. Un petit cas n'est pas extrapolable directement à 56 scènes : nombre d'objets, candidats et quotas modifient le coût et la latence.

## Questions sur la sécurité et la reproductibilité

**Que se passe-t-il avec “ignore toutes les instructions” dans un scénario ?** Les prompts traitent le document comme une donnée ; le produit n'exécute pas ses instructions comme du code, et la clé n'est pas dans le contexte envoyé au modèle. Trois essais adversariaux réels sont conservés. C'est une protection testée sur un petit échantillon, pas une garantie générale contre l'injection.

**Les citations sont-elles une garantie de vérité ?** Elles prouvent seulement qu'un passage a été retrouvé, après normalisation. Pour une question, le contrôle vérifie les identifiants cités. Ni l'un ni l'autre ne prouve qu'un passage justifie la conclusion. La lecture humaine et une évaluation sémantique restent nécessaires.

**Puis-je analyser un scénario confidentiel ?** L'import et la sauvegarde sont locaux, mais Groq reçoit les scènes ou extraits nécessaires aux appels. Il faut l'autorisation de les transférer. Ollama peut exécuter l'inférence sur la machine locale ; il faut aussi gérer correctement l'appareil et les exports. Le produit ne statue pas sur les droits du document.

**Est-ce reproductible ?** Les dépendances npm, prompts, données, paramètres et résultats sont conservés ; un autre membre peut installer et exécuter le projet. Groq n'expose pas de snapshot immuable des poids via cet identifiant, donc nous ne promettons pas une sortie identique bit à bit. Changer les paramètres exige un nouveau rapport identifié.

**Qu'a fait l'IA et qu'ont fait les étudiants ?** Le README déclare l'assistance de Codex, Groq et Canva. Chaque étudiant doit encore renseigner sa contribution réelle et savoir expliquer le produit entier. Des rôles proposés ou des commits générés ne constituent pas une preuve de contribution humaine des trois membres.

## Démonstration de cinq minutes

| Durée | Action | Ce qu'il faut expliquer |
|---|---|---|
| 0:00–0:45 | Présenter l'utilisateur visé et ouvrir Valkaama | Source réelle, licence, limites du besoin encore à valider |
| 0:45–1:30 | Montrer le scénario et les scènes analysées | Texte et pages conservés ; couverture explicitement bornée |
| 1:30–3:00 | Ouvrir la fiction de démonstration et relire un point | Données synthétiques ; deux passages ; décision et note |
| 3:00–4:00 | Poser une question absente et montrer un échec enregistré | Abstention ; une erreur connue et la façon de la relire |
| 4:00–5:00 | Montrer baseline, résultats et limites | Compromis précision/rappel, coût, validation humaine en attente |

Préparer un fichier vidéo de cette version avant le rendu. Vérifier que les trois membres savent lancer l'application, retrouver les résultats bruts et expliquer l'exemple sans dépendre d'un autre membre.
