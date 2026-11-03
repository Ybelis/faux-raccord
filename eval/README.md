# Reproduire les évaluations

## Distinguer les expériences

| Fichier                  | Données                                                                                                | Modèle et résultat                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `controlled-report.json` | Une adaptation de Valkaama, 15 erreurs injectées et quatre transitions expliquées dans les scènes 1–12 | Expérience principale ; modèle, licence, résultats et associations conservés dans le rapport                 |
| `report.json`            | 50 cas synthétiques réservés, sur un jeu de 60                                                         | Ancienne expérience complémentaire GPT-OSS 20B, mesurée par vignette ; figée avec son code et ses paramètres |
| `qa-real-report.json`    | 24 questions sur les scènes 1–10 de Valkaama                                                           | Configuration indiquée dans le rapport, distincte de l’expérience de continuité                              |
| `retrieval-real.json`    | 12 requêtes sur Valkaama                                                                               | Recherche BM25 seule ; pas d’inférence                                                                       |
| `red-team-results.json`  | Vingt demandes adversariales                                                                           | Essais limités, pas une certification de sécurité                                                            |
| `local-validation.json`  | Courts exemples de connexion, question et extraction                                                   | Contrôles réels de modèles Ollama ; succès et échecs sont distingués                                         |

Les références proposées avec assistance IA ne sont pas réputées validées par une personne.
`english-smoke.json` conserve une question et une analyse réellement exécutées
avec le profil anglais sur deux scènes synthétiques. C’est un contrôle opérationnel,
sans score de précision/rappel comparable au benchmark français.
L’audit structurel se trouve dans `annotation_audit.json` ; ses champs de validation humaine
restent explicitement vides. La [documentation des résultats](http://127.0.0.1:4173/#/docs/evaluation)
explique les métriques, la portée et les limites de chaque expérience.

## Expérience principale : erreurs injectées

```sh
node eval/controlled-run.mjs
node --env-file=.env eval/controlled-run.mjs --live
```

Le scénario adapté contient les 56 scènes de Valkaama ; le périmètre évalué couvre
les scènes 1–12, où se trouvent les 15 injections et quatre contrôles négatifs.
Les références et les modifications sont dans `data/controlled-script/`. Le
scénario publié reste intact. Les associations utilisent les objets et deux
passages : chaque injection ne peut compter qu’une fois. Les doublons et les
alertes sur les transitions expliquées ou avec des preuves non conformes comptent comme faux positifs. Une alerte
sur un objet hors des références est conservée à relire, hors du score contrôlé ;
ce score ne mesure donc pas la précision de toutes les alertes possibles.

Dans la mesure publiée, la montre est reconnue par la baseline mais une citation
remplace « its mechanism » par « the mechanism ». Ce résultat est rejeté par le
critère de preuve littérale : le FP ne correspond pas à une contradiction inventée.

Le rapport indique `measured` uniquement lorsque les deux méthodes sont mesurées.
Sans `--live`, la commande valide les données et les résultats déjà enregistrés,
sans fabriquer de nouvelle prédiction.

## Expériences complémentaires : hors ligne

```powershell
npm run eval:legacy
node eval/qa-real.mjs
node eval/retrieval-real.mjs
```

Ces commandes contrôlent les références et les passages sources. Elles n’inventent pas de
score d’inférence quand aucun modèle n’a été appelé.

## Expériences complémentaires : avec le fournisseur

Une clé doit être configurée côté serveur. Ne pas la passer dans les arguments du terminal.

```powershell
npm run eval:legacy -- --live
node --env-file=.env eval/qa-real.mjs --live --model=openai/gpt-oss-120b
```

La première commande mesure la continuité avec le modèle de référence configuré. La seconde
sélectionne explicitement le profil QA GPT-OSS 120B, choisi pour disposer d’un quota distinct
lorsque le quota 20B est épuisé. La baseline et le système emploient toujours le même modèle
au sein d’une comparaison. Cela ne change pas rétroactivement les scores de continuité 20B.

Les deux méthodes emploient les mêmes données et la même grille, avec leurs prompts
versionnés respectifs. Une réponse QA
est considérée conforme si elle contient les éléments lexicaux attendus, la scène correcte
dans `citations` et une référence dans son texte, ou exactement `NOT FOUND` sans citation
pour une information absente. Cette grille comporte des limites : synonymes, négations et
justification sémantique ne sont pas complètement évalués.

## Quotas et reprise

Après chaque méthode, le script sauvegarde le rapport et un checkpoint dans `.local/`.
Une sortie obtenue, même incorrecte, est réutilisée seulement si les empreintes du code,
des données, du corpus, du protocole, du modèle et des paramètres sont identiques.
Une réponse fausse ne doit pas être relancée jusqu’à ce qu’elle devienne correcte.

Les erreurs réseau ou de quota peuvent être retentées. Un JSON invalide généré par le
modèle est figé comme échec de contenu. Le quota journalier provoque un arrêt ; le script
ne le contourne pas en répétant des requêtes. Lancer la même commande après renouvellement.

Un rapport incomplet conserve ses observations mais ne publie pas de score global de
qualité. Les anciennes versions et le journal des tentatives restent dans `.local/` ;
l’historique Git conserve aussi les résultats déjà enregistrés. Les temps mesurés peuvent
inclure la régulation du quota : ils décrivent alors une durée opérationnelle, pas la vitesse
intrinsèque du modèle.

Après une nouvelle mesure :

```powershell
node scripts/write-evaluation-docs.mjs
node scripts/print-deliverables.mjs --pdf
```

Après lecture des erreurs, réserver de nouveaux cas indépendants avant d’évaluer une
modification du détecteur. Les scores ne doivent pas être présentés comme ceux d’une autre
configuration ni comme une généralisation à tous les scénarios.
