# Reproduire les évaluations

## Distinguer les expériences

| Fichier | Données | Modèle et résultat |
|---|---|---|
| `report.json` | 50 cas synthétiques réservés, sur un jeu de 60 | Référence de continuité GPT-OSS 20B ; figée avec son code et ses paramètres |
| `qa-real-report.json` | 24 questions sur les scènes 1–10 de Valkaama | Configuration indiquée dans le rapport, distincte de l’expérience de continuité |
| `retrieval-real.json` | 12 requêtes sur Valkaama | Recherche BM25 seule ; pas d’inférence |
| `red-team-results.json` | Trois demandes adversariales | Essais limités, pas une certification de sécurité |
| `local-validation.json` | Courts exemples de connexion, question et extraction | Contrôles réels de modèles Ollama ; succès et échecs sont distingués |

Les références proposées avec assistance IA ne sont pas réputées validées par une personne.
L’audit structurel se trouve dans `annotation_audit.json` ; ses champs de validation humaine
restent explicitement vides. Voir [le détail des limites](../docs/annotation_review.md).

## Hors ligne

```powershell
npm run eval
node eval/qa-real.mjs
node eval/retrieval-real.mjs
```

Ces commandes contrôlent les références et les passages sources. Elles n’inventent pas de
score d’inférence quand aucun modèle n’a été appelé.

## Avec le fournisseur

Une clé doit être configurée côté serveur. Ne pas la passer dans les arguments du terminal.

```powershell
npm run eval:live
node --env-file=.env eval/qa-real.mjs --live --model=openai/gpt-oss-120b
```

La première commande mesure la continuité avec le modèle de référence configuré. La seconde
sélectionne explicitement le profil QA GPT-OSS 120B, choisi pour disposer d’un quota distinct
lorsque le quota 20B est épuisé. La baseline et le système emploient toujours le même modèle
au sein d’une comparaison. Cela ne change pas rétroactivement les scores de continuité 20B.

Les prompts, les données et la grille restent identiques entre les méthodes. Une réponse QA
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
