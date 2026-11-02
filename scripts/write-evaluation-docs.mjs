import { readFile, writeFile } from 'node:fs/promises';
const report = JSON.parse(await readFile('eval/report.json', 'utf8'));
const retrieval = JSON.parse(await readFile('eval/retrieval-real.json', 'utf8'));
const red = JSON.parse(await readFile('eval/red-team-results.json', 'utf8'));
const pricing = JSON.parse(await readFile('eval/pricing.json', 'utf8'));
let qa;
try {
  qa = JSON.parse(await readFile('eval/qa-real-report.json', 'utf8'));
} catch {}
const percent = (v) => (v == null ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' %');
const interval = (v) => (v ? v.map(percent).join('–') : '—');
const cost = (row) =>
  (row.inputTokens * pricing.inputPerMillion + row.outputTokens * pricing.outputPerMillion) / 1e6;
const positive = report.rows.filter((r) => r.expected).length;
const qaComplete =
  qa &&
  qa.status === 'completed' &&
  qa.qualityComparable !== false &&
  !qa.baseline.errors &&
  !qa.system.errors;
const qaCompleted = qa
  ? (qa.nCompleted ??
    qa.rows.filter((row) => row.baseline && row.system && !row.baseline.error && !row.system.error)
      .length)
  : 0;
const qaPlanned = qa ? (qa.nPlanned ?? qa.n) : 24;
const realQA = !qa
  ? 'Le jeu réel `eval/qa-real.json` et son script sont disponibles ; aucune mesure d’inférence QA réelle n’est encore enregistrée.'
  : !qaComplete
    ? `La comparaison QA réelle est **incomplète** : ${qaCompleted}/${qaPlanned} questions ont leurs deux sorties fournisseur disponibles ; erreurs d'infrastructure : ${qa.baseline.errors} baseline, ${qa.system.errors} système.${qa.quotaReached || qa.stopReason === 'daily_quota' ? ' Un quota journalier a arrêté l’exécution.' : ''} Aucun score global de qualité n'est revendiqué sur cet essai. Les sorties obtenues, y compris les réponses incorrectes, sont conservées ; voir [le journal brut](../eval/qa-real-report.json). La commande de reprise est \`node --env-file=.env eval/qa-real.mjs --live\` ; les nouveaux checkpoints n'autorisent une réutilisation qu'à empreintes de code, données, modèle et paramètres identiques. Une erreur fournisseur peut être retentée, une réponse valide mais fausse ne doit pas être rééchantillonnée pour améliorer le score.`
    : `Exécution réelle du ${new Date(qa.completedAt).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}, modèle \`${qa.model}\`, code \`${qa.codeHash}\`. **${qa.n} questions** sur les scènes 1–10 de Valkaama : vingt réponses appuyées par un passage inchangé et quatre informations absentes. Cette configuration QA est distincte du benchmark de continuité \`${report.model}\`. Le profil 120B a été choisi pour son quota disponible après saturation du profil 20B ; il ne remplace pas rétroactivement les anciens scores. Les questions et grilles ont été proposées avec assistance IA ; citations contrôlées par script, relecture étudiante en attente. La baseline reçoit les dix scènes intégrales ; le système cherche sur les mêmes dix scènes.

| Méthode | Réponse conforme et scène citée, ou abstention correcte [IC 95 %] | Abstentions correctes | Durée médiane observée |
|---|---|---|---|
| Prompt simple | ${qa.baseline.passed}/${qa.n} · ${percent(qa.baseline.correctAndCitedOrCorrectAbstention)} [${interval(qa.baseline.confidence95)}] | ${qa.baseline.correctAbstentions}/${qa.baseline.unanswerableTotal} | ${qa.baseline.medianSeconds.toFixed(3)} s |
| Questions avec RAG | ${qa.system.passed}/${qa.n} · ${percent(qa.system.correctAndCitedOrCorrectAbstention)} [${interval(qa.system.confidence95)}] | ${qa.system.correctAbstentions}/${qa.system.unanswerableTotal} | ${qa.system.medianSeconds.toFixed(3)} s |

Les durées QA incluent la régulation des quotas de tokens ; elles ne comparent pas la vitesse intrinsèque des modèles. La grille exige les éléments lexicaux attendus, la scène dans le champ des citations et une référence dans le texte, ou \`NOT FOUND\` sans citation. Des synonymes valables peuvent être rejetés et une négation peut échapper à cette grille. C'est un indicateur automatique approximatif, pas un jugement sémantique indépendant. Les échecs observés du système sont : ${
        qa.rows
          .filter((row) => !row.system.passed)
          .map((row) => row.id)
          .join(', ') || 'aucun sur ces questions'
      }. Tokens système : ${qa.system.inputTokens} entrée, ${qa.system.outputTokens} sortie ; baseline : ${qa.baseline.inputTokens}, ${qa.baseline.outputTokens}.${qa.model === pricing.model ? ` Coût catalogue estimé du système : ${cost(qa.system).toFixed(6)} USD au total.` : ''} [Résultats détaillés](../eval/qa-real-report.json). Cette mesure porte sur les questions, pas sur la continuité ; elle ne démontre pas une généralisation à d'autres œuvres.`;
const doc = `# Rapport d'évaluation — Faux Raccord

Exécution réelle Groq du ${new Date(report.completedAt).toLocaleDateString('fr-FR')}, modèle \`${report.model}\`, prompts v1.0.0. Référence du code de l'exécution : \`${report.codeHash}\`. Prédictions détaillées : [report.json](../eval/report.json).

## Jeu et protocole

60 cas synthétiques contrôlés ont été proposés avec assistance IA : dix cas de développement et **50 cas réservés au test** (${positive} positifs, ${report.n - positive} négatifs). Ils couvrent états, possession, réparations/remplacements, objets homonymes, ellipses, absences de mention et injections. Les annotations restent **à relire et à valider par les étudiants**. Il ne s'agit ni d'erreurs trouvées dans des films ni d'une validation utilisateur.

La baseline reçoit le texte intégral de chaque cas avec un prompt simple. Le système reçoit les mêmes scènes : extraction structurée, validation des citations, suivi d'états, recherche BM25 puis comparaison LLM. Une alerte ambiguë compte comme un point signalé. Le modèle et la température sont identiques. Les appels et tokens supplémentaires du système sont comptés. Les cas de test n'ont pas servi à modifier le détecteur après lecture des résultats.

## Métriques et résultats

L'unité est le cas : une prédiction est positive dès qu'au moins une alerte est produite. Précision = cas positifs correctement signalés / cas signalés ; rappel = cas positifs signalés / cas positifs ; F1 = moyenne harmonique. Intervalles à 95 % calculés par Wilson sur les proportions. Ils ne corrigent ni la proximité de certains cas synthétiques ni l'absence d'échantillonnage représentatif des tournages.

| Méthode | Précision [IC 95 %] | Rappel [IC 95 %] | F1 | Latence médiane / cas |
|---|---|---|---|---|
| Prompt simple | ${percent(report.baseline.precision)} [${interval(report.baseline.precisionCI)}] | ${percent(report.baseline.recall)} [${interval(report.baseline.recallCI)}] | ${percent(report.baseline.f1)} | ${report.baseline.medianSeconds.toFixed(3)} s |
| Extraction + RAG + comparaison | ${percent(report.system.precision)} [${interval(report.system.precisionCI)}] | ${percent(report.system.recall)} [${interval(report.system.recallCI)}] | ${percent(report.system.f1)} | ${report.system.medianSeconds.toFixed(3)} s |

Système : ${report.system.tp} vrais positifs, ${report.system.fp} faux positif, ${report.system.fn} faux négatifs et ${report.system.tn} vrais négatifs. Baseline : ${report.baseline.tp}, ${report.baseline.fp}, ${report.baseline.fn}, ${report.baseline.tn}. Erreurs de fournisseur : ${report.system.errors} pour le système et ${report.baseline.errors} pour la baseline.

**Interprétation :** le système émet moins de fausses alertes, mais manque davantage de points. Le prompt simple obtient ici un meilleur F1. Le seuil visé de 80 % de précision est dépassé ponctuellement, mais la borne basse de l'intervalle du système reste inférieure à 80 %. Cela ne prouve pas une supériorité globale du pipeline.

## Analyse des échecs

- Quatre points de possession manqués : C013, C024, C032, C059. Exemple : un passeport conservé par un agent réapparaît chez sa propriétaire sans restitution décrite. Le suivi des transferts reste à améliorer ; l'extraction et les actions doivent être inspectées avant de choisir la correction.
- Une fausse alerte temporelle : C051. Un lecteur cassette cassé est vu intact dans une séquence explicitement située cinq ans plus tôt.
- Les erreurs JSON initiales et la fusion d'objets génériques ont des tests de régression ; ce ne sont pas des échecs masqués du benchmark final.

## Questions sur le corpus réel

${realQA}

## Recherche, coût et limites

Sur **12 recherches de référence dans Valkaama**, la bonne scène est retrouvée dans les cinq premiers résultats : ${percent(retrieval.value)}. Les citations de référence ont été contrôlées dans le texte. Cette mesure porte uniquement sur la recherche, pas sur la justesse d'une analyse de continuité ou d'une réponse générée.

Le système consomme ${report.system.inputTokens} tokens d'entrée et ${report.system.outputTokens} de sortie sur les 50 tests, contre ${report.baseline.inputTokens} et ${report.baseline.outputTokens} pour la baseline. Au [tarif catalogue Groq vérifié le 2 novembre 2026](${pricing.source}) (${pricing.inputPerMillion} USD/M en entrée, ${pricing.outputPerMillion} USD/M en sortie), l'estimation est **${cost(report.system).toFixed(6)} USD au total**, soit ${(cost(report.system) / report.n).toFixed(6)} USD/cas, contre ${(cost(report.baseline) / report.n).toFixed(6)} USD/cas. Hors cache, remises et éventuel plan gratuit ; il ne s'agit pas du montant effectivement facturé. Les latences incluent les éventuelles attentes de quota et ne prédisent pas celles d'un long scénario.

Prochaines étapes : faire relire les annotations, recueillir l'avis d'un scripte, compléter par de vrais dossiers de production et réserver un nouveau jeu indépendant avant de retoucher le détecteur. Aucun gain de temps utilisateur n'a encore été mesuré.
`;
await writeFile('docs/evaluation_report.md', doc);
const log = `# Journal de red teaming — Faux Raccord

Exécution réelle du ${new Date(red.completedAt).toLocaleDateString('fr-FR')}, \`${red.model}\`. Résultats bruts : [red-team-results.json](../eval/red-team-results.json).

| Cas | Attaque | But | Résultat observé | Protection |
|---|---|---|---|---|
${red.rows.map((r) => `| ${r.id} | ${r.attack} | Détourner la réponse ou obtenir un secret | ${r.passed ? 'Résistance observée' : 'ÉCHEC'} : ${r.answer?.replaceAll('|', '/')} | Documents traités comme données, pas d'outil d'exécution, sources contrôlées |`).join('\n')}

Les tests déterministes vérifient en outre le rejet des scènes et citations inventées, des imports invalides, des modèles malformés, des requêtes sans consentement et l'absence de clé dans la route de statut. Un test parse le vrai PDF de Valkaama et vérifie ses 56 scènes.

Trois attaques sont un échantillon limité, pas une preuve de sécurité générale. Les documents ne sont jamais exécutés comme code. La clé n'est pas incluse dans les prompts. Les décisions de continuité restent à valider humainement.
`;
await writeFile('docs/red_team_log.md', log);
console.log('Evaluation report and red-team log generated from actual results.');
