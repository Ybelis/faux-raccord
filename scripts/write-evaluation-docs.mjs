import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectTeam = {
  names: ['Yann QUEGUINER', 'Jean-Remy BITOUMBOU-BIBOKA', 'Simon LUSSATO'],
  contactUrl: 'https://github.com/Ybelis/faux-raccord/issues',
};

// Les versions Markdown et imprimables lisent les mêmes preuves. Ce script ne
// lance pas d'inférence ; une mesure absente reste absente, jamais remplacée par zéro.
export async function loadEvaluationReports() {
  const readJSON = async (file, optional = false) => {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      if (optional && error.code === 'ENOENT') return null;
      throw error;
    }
  };
  const [controlled, annotations, license, report, retrieval, red, pricing, qa] = await Promise.all(
    [
      readJSON('eval/controlled-report.json', true),
      readJSON('data/controlled-script/annotations.json'),
      readJSON('data/controlled-script/license.json'),
      readJSON('eval/report.json'),
      readJSON('eval/retrieval-real.json'),
      readJSON('eval/red-team-results.json'),
      readJSON('eval/pricing.json'),
      readJSON('eval/qa-real-report.json', true),
    ],
  );
  return { controlled, annotations, license, report, retrieval, red, pricing, qa };
}

export const format = {
  percentage: (value) =>
    typeof value === 'number' ? `${(value * 100).toFixed(1).replace('.', ',')} %` : '—',
  interval: (values) =>
    Array.isArray(values) ? values.map((value) => format.percentage(value)).join('–') : '—',
  number: (value) => (typeof value === 'number' ? value.toLocaleString('fr-FR') : '—'),
  seconds: (value) => (typeof value === 'number' ? `${value.toFixed(3).replace('.', ',')} s` : '—'),
  money: (value) =>
    typeof value === 'number' ? `${value.toFixed(6).replace('.', ',')} USD` : 'non estimé',
  date: (value) =>
    value
      ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long' }).format(
          new Date(value),
        )
      : 'non mesuré',
};

export function evaluationSummary(data) {
  const { controlled, report, qa, pricing } = data;
  const measured = Boolean(
    controlled?.status === 'measured' && controlled.system && controlled.baseline,
  );
  const qaMeasured = Boolean(
    qa?.status === 'completed' &&
      qa.qualityComparable !== false &&
      !qa.system.errors &&
      !qa.baseline.errors,
  );
  const historicalCost = (row) =>
    report.model === pricing.model
      ? (row.inputTokens * pricing.inputPerMillion + row.outputTokens * pricing.outputPerMillion) /
        1e6
      : null;
  return {
    measured,
    qaMeasured,
    date: format.date(controlled?.generatedAt || report.completedAt),
    historicalCost,
    baselineProtocolText: (controlled?.baselineProtocol?.input || 'protocole à enregistrer')
      .replace(/^Les /, 'les ')
      .replace(/\.+$/, ''),
    inferenceProfile: controlled?.inferenceProfile
      ? `Profil ${controlled.inferenceProfile.id} : extraction par lots de ${controlled.inferenceProfile.extractionBatchSize} scènes, plafond de ${controlled.inferenceProfile.extractionMaxOutputTokens} tokens de sortie ; jugement par groupes de ${controlled.inferenceProfile.judgmentCandidatesPerRequest} candidats, plafond de ${controlled.inferenceProfile.judgmentMaxOutputTokens} tokens ; baseline en ${controlled.baselineProtocol.calls} lots de six scènes, plafond de ${controlled.baselineProtocol.maxOutputTokens} tokens. Empreinte du profil : ${controlled.inferenceProfile.sha256.slice(0, 12)}.`
      : 'Profil de transport non enregistré.',
    inferenceProfileShort: controlled?.inferenceProfile
      ? `Profil ${controlled.inferenceProfile.id} : extraction ${controlled.inferenceProfile.extractionBatchSize} scènes / ${controlled.inferenceProfile.extractionMaxOutputTokens} tokens ; jugement ${controlled.inferenceProfile.judgmentCandidatesPerRequest} candidats / ${controlled.inferenceProfile.judgmentMaxOutputTokens} tokens ; baseline ${controlled.baselineProtocol.calls} × 6 scènes / ${controlled.baselineProtocol.maxOutputTokens} tokens. Hash ${controlled.inferenceProfile.sha256.slice(0, 12)}.`
      : 'Profil de transport non enregistré.',
    primaryStatus: measured
      ? 'Mesure réelle du système et de la baseline disponible.'
      : `Comparaison contrôlée ${controlled?.status === 'partial' ? 'partielle' : 'non mesurée'} : aucun score global de comparaison n’est revendiqué.`,
  };
}

export async function writeEvaluationDocuments(data) {
  data ||= await loadEvaluationReports();
  const { controlled: c, annotations, license, report, retrieval, red, qa } = data;
  const summary = evaluationSummary(data);
  const f = format;
  const primaryRows = ['baseline', 'system']
    .map((key) => {
      const row = c?.[key];
      return `| ${key === 'baseline' ? 'Prompt simple' : 'Extraction + RAG + comparaison'} | ${row ? `${row.tp} / ${row.fp} / ${row.fn}` : '—'} | ${f.percentage(row?.precision)} [${f.interval(row?.precisionCI95)}] | ${f.percentage(row?.recall)} [${f.interval(row?.recallCI95)}] | ${f.percentage(row?.f1)} |`;
    })
    .join('\n');
  const missed = c?.system?.missedErrorIds || [];
  const failures = missed.length
    ? missed
        .map((id) => {
          const entry = annotations.entries.find((item) => item.errorId === id);
          return entry
            ? `${id} : ${entry.object} (${entry.before.sceneId} → ${entry.after.sceneId})`
            : id;
        })
        .join(' ; ')
    : c?.system
      ? 'Aucune des quinze erreurs manquée sur cet essai.'
      : 'Aucun résultat système disponible.';
  const falseAlerts =
    c?.system?.ledger.filter((entry) => entry.status === 'false-positive-controlled-scope') || [];
  const qaText = summary.qaMeasured
    ? `**${qa.n} questions sur de vrais passages inchangés** des dix premières scènes de Valkaama, modèle \`${qa.model}\` : ${qa.system.passed}/${qa.n} conformes avec RAG [IC 95 % ${f.interval(qa.system.confidence95)}], contre ${qa.baseline.passed}/${qa.n} avec prompt simple [${f.interval(qa.baseline.confidence95)}]. Abstentions correctes : ${qa.system.correctAbstentions}/${qa.system.unanswerableTotal} et ${qa.baseline.correctAbstentions}/${qa.baseline.unanswerableTotal}. La grille lexicale vérifie réponse et citation, ou \`NOT FOUND\` ; synonymes et négations peuvent la tromper. Ce résultat mesure les réponses, pas la continuité.`
    : `La comparaison de questions réelles est incomplète ou absente (${qa?.nCompleted || 0}/${qa?.nPlanned || 24} questions complètes). Aucun score global de qualité n’est revendiqué. Les erreurs fournisseur ne valent pas des réponses incorrectes.`;

  const evaluation = `# Rapport d’évaluation — Faux Raccord

État des preuves : ${summary.date}. [Rapport principal brut](../eval/controlled-report.json), [script reproductible](../eval/controlled-run.mjs).

## 1. Expérience principale : un scénario, quinze erreurs

**Valkaama**, Tim Baumann d’après Hendrik Behnisch, version ${license.originalVersion}, contient 56 scènes. Une adaptation d’évaluation conserve ces scènes et ajoute 19 accessoires. Une version de référence est d’abord cohérente ; **exactement 15 phrases ultérieures sont modifiées pour créer 15 faux raccords**, avec quatre transitions expliquées laissées comme contrôles négatifs. L’évaluation porte sur les scènes S001–S012 du même scénario, où se trouvent toutes les injections. Ce ne sont pas des erreurs attribuées aux auteurs originaux.

La [page officielle de l’auteur](${license.originalSourceUrl}) annonce la licence **${license.license}** du scénario. Attribution et modifications sont conservées dans [license.json](../data/controlled-script/license.json) ; l’adaptation reprend cette licence. La validation automatique vérifie les deux passages de chaque annotation et qu’annuler les quinze modifications restitue exactement la référence. Validation des fichiers : **${c?.validation?.valid ? 'réussie' : 'à exécuter ou à corriger'}**. Annotations proposées avec assistance IA ; relecture humaine non encore attestée. Jeu de développement visible, pas test indépendant.

Le système applique le pipeline du produit : extraction structurée par lots de trois scènes, contrôle des preuves, suivi d’états, recherche BM25 et comparaison LLM. Protocole baseline : ${summary.baselineProtocolText}. Modèle de cette expérience : \`${c?.model?.id || 'non mesuré'}\` via ${c?.model?.provider || 'non mesuré'}, température 0. ${c?.model?.choice || ''} Licence modèle : ${c?.model?.license || 'non confirmée'}${c?.model?.licenseUrl ? ` ([texte de licence](${c.model.licenseUrl}))` : ''}. Empreinte du pipeline : \`${c?.dataset?.pipelineHash?.slice(0, 12) || 'absente'}\`.

${summary.inferenceProfile}

## 2. Métriques, résultats et incertitude

L’unité est **l’alerte associée à une injection**, sur les 19 accessoires annotés. Un vrai positif (VP) doit identifier l’objet et fournir des citations valides dans les deux scènes attendues ; chaque injection ne peut compter qu’une fois. Une alerte erronée, dupliquée ou avec des preuves non conformes est un faux positif (FP). Une injection sans détection conforme est un faux négatif (FN). Les alertes sur les autres objets originaux sont signalées séparément, sans verdict automatique ; elles sont exclues de la précision contrôlée.

Le FP de la baseline vient d’une citation approximative de la montre (« the mechanism » à la place de « its mechanism ») : le changement a été reconnu, mais la preuve ne respecte pas le texte. La métrique mesure donc la reconnaissance avec deux preuves valides, pas uniquement la détection sémantique.

Précision = VP / (VP + FP) : parmi les alertes contrôlables, lesquelles sont justes ? Rappel = VP / 15 : combien d’erreurs introduites sont retrouvées ? F1 = 2 × précision × rappel / (précision + rappel). Les intervalles de Wilson à 95 % sont descriptifs : une seule œuvre, erreurs fabriquées et dépendantes, faible effectif. Ils ne démontrent pas une généralisation à d’autres scénarios.

**${summary.primaryStatus}**

| Méthode | VP / FP / FN | Précision [IC 95 %] | Rappel [IC 95 %] | F1 |
|---|---|---|---|---|
${primaryRows}

${c?.system ? `Système : ${c.system.alertCount} alertes au total, dont ${c.system.unannotatedAlertCount} hors périmètre annoté à relire. Baseline : ${c.baseline?.alertCount ?? '—'} alertes, dont ${c.baseline?.unannotatedAlertCount ?? '—'} hors périmètre.` : ''}

${summary.measured ? `Interprétation : le système retrouve ${c.system.tp}/15 injections et en manque ${c.system.fn}. Aucune fausse alerte contrôlée observée ne signifie pas une précision garantie de 100 % : sa borne basse à 95 % est ${f.percentage(c.system.precisionCI95?.[0])}. La baseline retrouve ${c.baseline.tp}/15 injections et produit ${c.baseline.fp} fausse alerte contrôlée. Un écart sur une seule œuvre ne démontre pas une supériorité générale.` : ''}

**Échecs système.** ${failures} ${falseAlerts.length ? `Fausses alertes contrôlées : ${falseAlerts.map((item) => `${item.alertId} (${item.reason})`).join(', ')}.` : ''} Les deux passages sont consultables dans l’interface et dans [annotations.json](../data/controlled-script/annotations.json). Une citation présente ne garantit pas une bonne interprétation.
${c?.failureAnalysis?.length ? '\nLes traces d’extraction donnent des pistes, à vérifier humainement : E03/E06/E12 sont classés comme remplissages malgré la négation ; E04/E08/E15 conservent l’état « perdu » alors que l’objet réapparaît ; E07/E11 ont une mention manquante ou une identité séparée. Le résultat brut n’a pas été corrigé après ce diagnostic. La fausse alerte baseline vient d’une citation presque exacte (« the mechanism » au lieu de « its mechanism »), rejetée par le contrôle des preuves.\n' : ''}
${
  c?.errors?.system || c?.errors?.baseline
    ? `\nErreurs d’exécution conservées : ${Object.entries(c.errors)
        .filter(([, error]) => error)
        .map(([method, error]) => `${method} : ${error.code}, ${error.message}`)
        .join(
          ' ; ',
        )}. Une comparaison incomplète doit être reprise, sans remplacer ses sorties valides pour améliorer les scores.\n`
    : ''
}

## 3. Tokens, coût et durée

| Exécution sur les 12 scènes | Requêtes physiques / appels logiques | Tokens entrée / sortie | Durées cumulées | Coût catalogue estimé |
|---|---|---|---|---|
${['baseline', 'system'].map((key) => `| ${key === 'baseline' ? 'Prompt simple' : 'Pipeline'} | ${c?.[key]?.usage?.physicalCalls ?? '—'} / ${c?.[key]?.usage?.logicalCalls ?? '—'} | ${f.number(c?.[key]?.usage?.inputTokens)} / ${f.number(c?.[key]?.usage?.outputTokens)} | ${f.seconds(c?.[key]?.seconds)} | ${f.money(c?.[key]?.indicativeCostUSD)} |`).join('\n')}

${c?.costBasis ? `Tarif [${c.model.id}](${c.costBasis.source}), vérifié le ${f.date(c.costBasis.checkedAt)} : ${c.costBasis.inputUSDPerMillion} USD/M de tokens d’entrée et ${c.costBasis.outputUSDPerMillion} USD/M de sortie. ${c.costBasis.actualBilledCost}` : 'Aucun tarif associé à cette exécution.'} Les durées ne sont pas des médianes sur plusieurs scénarios ; attentes de quota, cache et volume influencent le temps observé. La comparaison porte sur le coût des sorties mesurées, pas sur tous les essais de développement.

Les requêtes physiques comptent les divisions de transport du jugement ; les appels logiques comptent les lots avant cette division. Les durées cumulées conservent le temps des réponses reprises du cache, y compris la régulation de quota. ${c?.system?.resumedWallSeconds != null ? `Les ${f.seconds(c.system.resumedWallSeconds)} de la dernière reprise ne sont pas la durée totale du système (${f.seconds(c.system.seconds)}).` : ''}

${c?.executionNotes?.length ? `Notes d’exécution : ${c.executionNotes.join(' ')}` : ''}${c?.executionAttempts?.length ? ` Les ${c.executionAttempts.length} tentatives d’infrastructure antérieures sont conservées dans le rapport brut ; leurs sorties ne sont pas mélangées aux scores affichés.` : ''}

## 4. Expériences secondaires et limites

L’ancien jeu séparé de **${report.n} courtes vignettes synthétiques** reste disponible : système, précision ${f.percentage(report.system.precision)} [${f.interval(report.system.precisionCI)}], rappel ${f.percentage(report.system.recall)}, F1 ${f.percentage(report.system.f1)} ; baseline ${f.percentage(report.baseline.precision)}, ${f.percentage(report.baseline.recall)}, ${f.percentage(report.baseline.f1)}. L’unité y est le **cas positif**, différente de l’alerte du benchmark principal. Le prompt simple obtient ici le meilleur F1. Modèle \`${report.model}\`, exécution du ${f.date(report.completedAt)}, code \`${report.codeHash}\` ; ces scores historiques ne valident pas rétroactivement le modèle du nouvel essai. [Résultats](../eval/report.json).

${qaText} [Rapport QA](../eval/qa-real-report.json).

Recherche seule : ${retrieval.n} requêtes lexicales sur Valkaama, scène attendue dans les cinq premiers résultats dans ${f.percentage(retrieval.value)} des cas. Sécurité : ${red.rows.filter((row) => row.passed).length}/${red.rows.length} tests adversariaux réels réussis ; échantillon limité. [Journal](red_team_log.md).

L’utilité pour une équipe de tournage et le gain de temps ne sont pas validés. Le jeu principal est visible et ses annotations attendent une relecture humaine. Objets homonymes, possession implicite et flashbacks restent difficiles. L’analyse porte uniquement sur le texte ; images, audio et vidéo ne sont pas pris en charge. Réserver un autre scénario annoté avant de conclure sur la généralisation.

Reproduction sans inférence : \`node eval/controlled-run.mjs\`, puis \`node scripts/write-evaluation-docs.mjs\` et \`node scripts/print-deliverables.mjs --pdf\`. Nouvelle mesure payante ou soumise au quota : commande \`commands.live\` conservée dans le rapport brut.
`;

  const card = `# Fiche système — Faux Raccord

**Usage.** Aide à la relecture de continuité d’accessoires pour les scriptes et petites équipes de court métrage. L’application rassemble des mentions et génère des alertes à examiner, chacune appuyée par deux passages. Le gain de temps métier n’a pas été mesuré.

**Entrées / sorties.** PDF avec texte, TXT, Fountain, Markdown ; scènes et pages, objets, alertes, décisions et notes de revue. Export projet JSON et rapport Markdown. Les projets sont conservés sur l’appareil, sans synchronisation d’équipe.

**Fonctionnement.** Segmentation déterministe ; extraction JSON par lots de trois scènes ; contrôle des citations ; suivi d’états et de possession ; recherche BM25 ; comparaison par LLM ; revue humaine. Les questions recherchent des passages puis produisent une réponse citée ou une abstention. Pipeline déclenché par l’utilisateur, sans choix autonome d’outils ni action extérieure.

**Modèles.** Profil de référence historique : \`openai/gpt-oss-20b\` via Groq, température 0, raisonnement low, licence Apache 2.0. Dernière expérience contrôlée : \`${c?.model?.id || 'non mesurée'}\`, ${c?.model?.license || 'licence à vérifier'}, même modèle pour la baseline et le système. Le modèle QA 120B est identifié séparément. Ollama est disponible pour l’inférence locale ; les petits modèles testés ne sont pas validés pour une extraction fiable. Les identifiants API ne sont pas des snapshots immuables. Modèle, réglages, date et version des prompts accompagnent les analyses ; un changement impose une nouvelle évaluation.

**Profil d’inférence contrôlé.** ${summary.inferenceProfile}

**Langues.** Interface FR/EN ; citations et analyses enregistrées conservées. Le profil de génération anglais « english-output-v1 » a passé un contrôle opérationnel distinct, sans benchmark de qualité comparable ; les scores ci-dessous concernent le profil français.

**Données et droits.** Valkaama, Tim Baumann d’après Hendrik Behnisch, version ${license.originalVersion}, 56 scènes, **${license.license}**. Source : [page officielle](${license.originalSourceUrl}). Adaptation d’évaluation sous la même licence : 15 erreurs délibérées et quatre contrôles sur 19 accessoires ajoutés, évaluation S001–S012. Les Heures Creuses et les vignettes sont synthétiques. MovieSum est une source facultative hors benchmark ; la licence déclarée du dataset ne garantit pas les droits des scénarios sous-jacents. Importer uniquement des textes autorisés.

**Évaluation.** ${summary.primaryStatus} ${c?.system ? `Sur les quinze injections : précision contrôlée ${f.percentage(c.system.precision)} [IC 95 % ${f.interval(c.system.precisionCI95)}], rappel ${f.percentage(c.system.recall)} [${f.interval(c.system.recallCI95)}], F1 ${f.percentage(c.system.f1)}. ${c.system.unannotatedAlertCount} alertes sur des objets non annotés sont exclues de ce score et restent à relire.` : ''} Les annotations sont proposées avec assistance IA, sans relecture humaine attestée ; jeu visible, œuvre unique, intervalles descriptifs. Les 50 vignettes, les 24 questions et les 12 recherches sont des expériences distinctes, pas un score global.

**Protections et confidentialité.** Clés côté serveur ; limites de taille, pages et texte ; citations et identifiants vérifiés ; documents traités comme données ; sorties non exécutées. Groq reçoit les scènes ou extraits utiles après confirmation d’envoi ; Ollama permet de les traiter localement. Trois essais adversariaux réels documentés, portée limitée. Chaque décision finale appartient à l’utilisateur.

**Hors périmètre et limites.** Pas d’analyse image, audio ou vidéo, d’OCR ni de planning de tournage. Pas de reconstruction fiable de l’ordre narratif. Identité des objets, flashbacks et transferts implicites difficiles ; recherche lexicale limitée sur les paraphrases et les langues croisées. Une citation exacte ne prouve pas la justesse d’une alerte. Aucune promesse de détection exhaustive.

**Équipe.** ${projectTeam.names.join(' · ')}. Contact : [issues du dépôt](${projectTeam.contactUrl}). Politique : [use_policy.md](use_policy.md). Mesures : [evaluation_report.md](evaluation_report.md). Guide utilisateur dans l’application, rubrique « Documentation ».
`;

  const redLog = `# Journal de red teaming — Faux Raccord

Exécution réelle du ${f.date(red.completedAt)}, modèle \`${red.model}\`. [Résultats bruts](../eval/red-team-results.json).

| Cas | Attaque | Réponse observée | Verdict de la grille |
|---|---|---|---|
${red.rows
  .map(
    (row) =>
      `| ${row.id} | ${row.attack} | ${String(row.answer || '')
        .replaceAll('|', '/')
        .replaceAll('\n', ' ')} | ${row.passed ? 'Résistance observée' : 'Échec'} |`,
  )
  .join('\n')}

Les documents sont traités comme données ; le modèle n’a pas d’outil d’exécution et ne reçoit pas la clé serveur. Les citations et identifiants de scènes sont contrôlés ; les sorties sont rendues comme texte. La décision humaine demeure nécessaire.

Les tests déterministes vérifient le rejet des citations inventées, imports invalides et modèles malformés, le consentement avant transfert et l’absence de clé dans le statut. Le benchmark contrôlé vérifie les quinze modifications et leurs preuves littérales. Ces tests de code ne mesurent pas la qualité d’une interprétation du LLM.

Trois essais réels ne prouvent pas une résistance générale aux injections. Résultats de sécurité et scores de détection restent deux mesures distinctes. La politique d’utilisation figure dans [use_policy.md](use_policy.md).
`;
  await Promise.all([
    writeFile('docs/evaluation_report.md', evaluation),
    writeFile('docs/system_card.md', card),
    writeFile('docs/red_team_log.md', redLog),
  ]);
  console.log('Trois documents mis à jour depuis les mesures ; politique existante conservée.');
}

const invokedPath = process.argv[1] && path.resolve(process.argv[1]);
if (invokedPath?.toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  await writeEvaluationDocuments();
}
