import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEvaluationReports, evaluationSummary, format } from './write-evaluation-docs.mjs';

// Les chiffres viennent des rapports mesurés. Ce script ne lance aucun appel
// au modèle et n'inclut ni variables d'environnement ni contenu de scénario.
const data = await loadEvaluationReports();
const { controlled: c, license, report, retrieval, red, qa } = data;
const summary = evaluationSummary(data);

const html = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const { percentage, interval, number, seconds, money, date } = format;
const referenceDate = summary.date;
const qaMeasured = summary.qaMeasured;
const redPassed = red.rows.filter((row) => row.passed).length;

const css = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { color-scheme: light; background: #e9ebed; }
body { margin: 0; color: #18242d; font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.33; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 180mm; height: 266mm; margin: 12mm auto; padding: 0 0 13mm; position: relative; background: white; break-after: page; }
.page:last-child { break-after: auto; }
.screen-page { padding: 15mm; width: 210mm; height: 296mm; }
.screen-page .page { margin: 0; }
header { border-top: 3pt solid #233e49; padding-top: 5mm; margin-bottom: 4mm; }
.brand { display: flex; justify-content: space-between; align-items: baseline; gap: 8mm; font-size: 8.5pt; letter-spacing: .04em; color: #4b606a; }
.brand strong { letter-spacing: .11em; color: #233e49; }
h1 { font-size: 23pt; line-height: 1.12; margin: 4mm 0 2mm; font-weight: 700; letter-spacing: -.035em; }
.subtitle { color: #53636b; margin: 0; max-width: 166mm; }
h2 { font-size: 12pt; margin: 3.5mm 0 2mm; line-height: 1.25; color: #233e49; }
h3 { font-size: 10pt; margin: 3mm 0 1mm; }
p { margin: 0 0 2mm; }
ul { margin: 1mm 0 3mm; padding-left: 4.5mm; }
li { margin: 0 0 1.2mm; }
table { width: 100%; border-collapse: collapse; margin: 2.5mm 0; font-size: 9pt; }
th { font-weight: 700; color: #324b56; background: #edf2f3; text-align: left; }
th, td { border-bottom: .5pt solid #cdd6da; padding: 2.1mm 2mm; vertical-align: top; }
.metric-table th:first-child, .metric-table td:first-child { width: 32%; }
.metric-table th:not(:first-child), .metric-table td:not(:first-child) { text-align: right; }
.note { background: #f0f4f4; border-left: 2pt solid #607b82; padding: 3mm 3.5mm; margin: 3mm 0; }
.warning { background: #fbf4e8; border-left-color: #ae7a2c; }
.small { font-size: 8.5pt; color: #52636c; line-height: 1.4; }
.mono { font-family: Consolas, 'Courier New', monospace; font-size: 8.5pt; overflow-wrap: anywhere; }
.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.two-columns h2:first-child { margin-top: 0; }
.rule { border-top: .5pt solid #cdd6da; padding-top: 3mm; margin-top: 3mm; }
footer { position: absolute; bottom: 0; left: 0; right: 0; border-top: .5pt solid #cdd6da; padding-top: 2.5mm; display: flex; justify-content: space-between; gap: 8mm; color: #607078; font-size: 8pt; }
a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.card h1 { font-size: 22pt; }
.card h2 { margin-top: 4mm; font-size: 11pt; }
.card header { margin-bottom: 4mm; }
.card { font-size: 9.5pt; }
.card .small { font-size: 8.2pt; }
.card table { font-size: 8.6pt; }
@media screen { .page { box-shadow: 0 5px 30px #14232d1a; outline: 15mm solid white; margin-top: 27mm; margin-bottom: 35mm; } }
@media print { html { background: white; } .page { margin: 0; } a { text-decoration: none; } }
`;

const document = (title, body) =>
  `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(title)}</title><style>${css}</style></head><body>${body}</body></html>\n`;
const header = (title, subtitle) =>
  `<header><div class="brand"><strong>FAUX RACCORD</strong><span>${html(referenceDate)}</span></div><h1>${html(title)}</h1><p class="subtitle">${subtitle}</p></header>`;
const footer = (label, page) =>
  `<footer><span>${html(label)} · équipe de trois — noms à renseigner</span><span>${page}</span></footer>`;
const metricRow = (label, row) =>
  `<tr><td>${html(label)}</td><td>${row ? `${row.tp} / ${row.fp} / ${row.fn}` : '—'}</td><td>${percentage(row?.precision)}<br><span class="small">${interval(row?.precisionCI95)}</span></td><td>${percentage(row?.recall)}<br><span class="small">${interval(row?.recallCI95)}</span></td><td>${percentage(row?.f1)}</td></tr>`;
const missed = c?.system?.missedErrorIds || [];
const missedText = missed.length
  ? missed.join(', ')
  : c?.system
    ? 'Aucune injection manquée sur cet essai.'
    : 'Système non mesuré.';
const falseAlerts =
  c?.system?.ledger.filter((entry) => entry.status === 'false-positive-controlled-scope') || [];
const qaSection = qaMeasured
  ? `<p><strong>${qa.n} questions sur les dix premières scènes inchangées de Valkaama</strong>, profil <span class="mono">${html(qa.model)}</span> : ${qa.system.passed}/${qa.n} conformes avec RAG [IC 95 % ${interval(qa.system.confidence95)}], contre ${qa.baseline.passed}/${qa.n} au prompt simple [${interval(qa.baseline.confidence95)}]. Abstentions correctes : ${qa.system.correctAbstentions}/${qa.system.unanswerableTotal} et ${qa.baseline.correctAbstentions}/${qa.baseline.unanswerableTotal}. La grille lexicale vérifie réponse et citation, ou <span class="mono">NOT FOUND</span>. Synonymes et négations peuvent la tromper. Cette mesure porte sur les réponses, pas la continuité.</p>`
  : `<p>Questions réelles : comparaison incomplète ou absente (${qa?.nCompleted || 0}/${qa?.nPlanned || 24} questions complètes), aucun score global de qualité revendiqué. Les erreurs fournisseur sont distinctes des réponses incorrectes.</p>`;

const evaluation = document(
  'Faux Raccord — rapport d’évaluation',
  `
<main class="page">
${header('Rapport d’évaluation', 'Expérience principale : retrouver quinze faux raccords introduits dans un même scénario')}
<h2>1. Données, droits et protocole</h2>
<p><strong>Valkaama</strong>, Tim Baumann d’après Hendrik Behnisch, version ${html(license.originalVersion)} : 56 scènes conservées. L’adaptation pédagogique ajoute 19 accessoires et prépare leur continuité cohérente. <strong>Exactement quinze phrases ultérieures sont ensuite modifiées</strong> pour créer quinze erreurs ; quatre transitions expliquées restent comme contrôles négatifs. L’évaluation couvre S001–S012, où se trouvent toutes les injections. Aucun faux raccord n’est attribué aux auteurs originaux.</p>
<p>La <a href="${html(license.originalSourceUrl)}">page officielle de l’auteur</a> annonce la licence <strong>${html(license.license)}</strong>. L’adaptation est attribuée, ses modifications documentées et sa licence identique. Les contrôles vérifient les preuves littérales et que l’annulation des quinze modifications restitue la référence : <strong>${c?.validation?.valid ? 'validation réussie' : 'validation à exécuter ou corriger'}</strong>. Annotations proposées avec assistance IA, relecture humaine non attestée ; jeu de développement visible.</p>
<p>Le système utilise le pipeline du produit : extraction par lots de trois scènes, contrôle des citations, suivi des états, BM25 puis comparaison LLM. Protocole baseline, même modèle : ${html(summary.baselineProtocolText)}.</p>
<p class="small">Modèle : <span class="mono">${html(c?.model?.id || 'non mesuré')}</span> via ${html(c?.model?.provider || '—')}, température 0, licence ${html(c?.model?.license || 'à confirmer')}. Pipeline <span class="mono">${html(c?.dataset?.pipelineHash?.slice(0, 12) || 'absent')}</span>.</p>
<p class="small">${html(summary.inferenceProfileShort)}</p>
<h2>2. Résultats par alerte et incertitude</h2>
<p>Un vrai positif (VP) identifie l’accessoire annoté avec deux preuves valides ; une seule détection compte par injection. Alerte erronée, dupliquée ou preuve non conforme : faux positif (FP). Injection sans détection conforme : faux négatif (FN). Ici, le FP baseline est une citation approximative de la montre, pas une contradiction inventée.</p>
<p><strong>Précision = VP / (VP + FP)</strong>, parmi les alertes contrôlables. <strong>Rappel = VP / 15</strong>, parmi les erreurs introduites. F1 : moyenne harmonique. Les alertes sur les objets originaux non annotés sont exclues de la précision contrôlée et restent à relire.</p>
<table class="metric-table"><thead><tr><th>Méthode</th><th>VP / FP / FN</th><th>Précision [IC 95 %]</th><th>Rappel [IC 95 %]</th><th>F1</th></tr></thead><tbody>${metricRow('Prompt simple', c?.baseline)}${metricRow('Extraction + RAG + comparaison', c?.system)}</tbody></table>
<div class="note"><strong>${html(summary.primaryStatus)}</strong> ${c?.system ? `${c.system.alertCount} alertes système, dont ${c.system.unannotatedAlertCount} hors périmètre annoté ; ${c.baseline?.alertCount ?? '—'} alertes baseline, dont ${c.baseline?.unannotatedAlertCount ?? '—'} hors périmètre. ${c.system.fn}/15 injections manquées ; une précision observée de 100 % ne garantit pas ce niveau sur un autre scénario.` : ''}</div>
<p class="small">IC de Wilson à 95 % descriptifs : erreurs construites et dépendantes, une seule œuvre, faible effectif. Ils ne prouvent pas une généralisation à d’autres films.</p>
<h2>3. Échecs et preuve affichée</h2>
<p><strong>Injections manquées :</strong> ${html(missedText)} ${
    falseAlerts.length
      ? `<strong>Fausses alertes contrôlées :</strong> ${falseAlerts.length} (${html(
          falseAlerts
            .slice(0, 3)
            .map((item) => item.alertId)
            .join(', '),
        )}${falseAlerts.length > 3 ? ', détails dans le rapport brut' : ''}).`
      : ''
  }</p>
<p>${c?.failureAnalysis?.length ? 'Piste dans les traces : E03/E06/E12 sont extraits comme remplissages malgré la négation ; diagnostic à relire. ' : ''}Chaque alerte affiche ses deux passages, scène et page. Une citation exacte ne garantit pas une interprétation juste.</p>
${footer('Rapport d’évaluation', '1 / 2')}
</main>
<main class="page">
${header('Coût, compléments et limites', 'Les expériences suivantes ont leur propre unité et leur propre modèle')}
<h2>4. Coût et durée de l’expérience principale</h2>
<table><thead><tr><th>Douze scènes</th><th>Tokens entrée / sortie</th><th>Durées cumulées</th><th>Coût estimé</th></tr></thead><tbody>${['baseline', 'system'].map((key) => `<tr><td>${key === 'baseline' ? 'Prompt simple' : 'Pipeline'} (${c?.[key]?.usage?.physicalCalls ?? '—'} requêtes)</td><td>${number(c?.[key]?.usage?.inputTokens)} / ${number(c?.[key]?.usage?.outputTokens)}</td><td>${seconds(c?.[key]?.seconds)}</td><td>${money(c?.[key]?.indicativeCostUSD)}</td></tr>`).join('')}</tbody></table>
<p class="small">${c?.costBasis ? `Tarif <a href="${html(c.costBasis.source)}">${html(c.model.id)}</a>, vérifié le ${html(date(c.costBasis.checkedAt))} : ${c.costBasis.inputUSDPerMillion} USD/M en entrée, ${c.costBasis.outputUSDPerMillion} USD/M en sortie. Coût théorique des sorties mesurées, hors essais et facture réelle.` : 'Aucun tarif associé.'} Les durées additionnent les requêtes, y compris quotas et réponses reprises du cache ; la dernière reprise seule (${seconds(c?.system?.resumedWallSeconds)}) n’est pas la durée totale. ${c?.system?.usage?.physicalCalls ?? '—'} requêtes système pour ${c?.system?.usage?.logicalCalls ?? '—'} appels logiques, le transport divisant le jugement.</p>
${c?.errors?.system || c?.errors?.baseline ? '<p class="small">Comparaison incomplète : erreurs d’infrastructure conservées dans le rapport brut, aucun score global revendiqué.</p>' : ''}
<h2>5. Expériences secondaires</h2>
<p><strong>${report.n} vignettes synthétiques réservées au test</strong>, dix autres cas ayant servi au développement. Unité : cas positif si au moins une alerte, différente de l’unité du benchmark principal. Modèle <span class="mono">${html(report.model)}</span>, ${html(date(report.completedAt))}, code <span class="mono">${html(report.codeHash)}</span>. Annotations assistées par IA à relire.</p>
<table><thead><tr><th>Par cas synthétique</th><th>Précision [IC 95 %]</th><th>Rappel</th><th>F1</th></tr></thead><tbody>${['baseline', 'system'].map((key) => `<tr><td>${key === 'baseline' ? 'Prompt simple' : 'Pipeline'}</td><td>${percentage(report[key].precision)} [${interval(report[key].precisionCI)}]</td><td>${percentage(report[key].recall)}</td><td>${percentage(report[key].f1)}</td></tr>`).join('')}</tbody></table>
<p>Le prompt simple a ici le meilleur F1 ; le pipeline émet moins de fausses alertes. Ces scores historiques ne valident pas rétroactivement le nouveau modèle.</p>
${qaSection}
<p><strong>Recherche seule :</strong> ${retrieval.n} requêtes lexicales, scène attendue dans les cinq premiers résultats : ${percentage(retrieval.value)}. Cela ne mesure pas la justesse d’une analyse.</p>
<h2>6. Sécurité, portée et travaux restants</h2>
<p>${redPassed}/${red.rows.length} essais adversariaux réels résistants aux attaques testées. Citations et identifiants contrôlés ; documents traités comme données ; clé absente des prompts ; sorties non exécutées. Trois essais ne garantissent pas une sécurité générale.</p>
<p>Le besoin métier et le gain de temps ne sont pas validés. Relecture humaine des annotations à consigner. Objets homonymes, transferts implicites et flashbacks restent difficiles. Aucune modalité image/audio/vidéo n’est revendiquée ; elle est encouragée dans le brief.</p>
<div class="note warning">Une œuvre et des erreurs construites ne suffisent pas à généraliser. Réserver un autre scénario annoté avant de conclure.</div>
<p class="small rule">Preuves : rapports JSON dans <span class="mono">eval/</span> ; annotations et licence dans <span class="mono">data/controlled-script/</span>. Reproduction sans appel : <span class="mono">node eval/controlled-run.mjs</span>. Les chemins complets figurent dans la version Markdown.</p>
${footer('Rapport d’évaluation', '2 / 2')}
</main>`,
);

const card = document(
  'Faux Raccord — fiche système',
  `
<main class="page card">
${header('Fiche système', 'IA générative avec RAG pour relire la continuité textuelle d’accessoires')}
<div class="two-columns"><section>
<h2>Usage prévu</h2>
<p>Scriptes et petites équipes de court métrage préparant le suivi des accessoires. Le produit rassemble des mentions et génère des alertes sourcées à examiner. L’utilité et le gain de temps métier ne sont pas validés.</p>
<h2>Entrées et sorties</h2>
<p>PDF avec texte, TXT, Fountain, Markdown. Scènes et pages, objets, mentions, deux passages par alerte, décision et note de revue. Export projet JSON et rapport Markdown.</p>
<h2>Fonctionnement</h2>
<p>Segmentation ; extraction JSON par lots de trois scènes ; contrôle des citations ; suivi des états et de la possession ; recherche BM25 ; comparaison LLM ; revue humaine. Questions : recherche puis réponse citée ou abstention. Déclenché par l’utilisateur, sans choix autonome d’outils ni action extérieure.</p>
<h2>Modèles et reproductibilité</h2>
<p>Profil historique : <span class="mono">openai/gpt-oss-20b</span> via Groq, température 0, raisonnement low, Apache 2.0. Expérience contrôlée : <span class="mono">${html(c?.model?.id || 'non mesurée')}</span>, ${html(c?.model?.license || 'licence à confirmer')}, identique pour système et baseline. QA : profil 120B séparé.</p>
<p>Ollama local non validé pour l’extraction. Identifiants API mutables ; configuration consignée. Interface FR/EN ; profil anglais contrôlé sur un exemple, hors benchmark. Les scores concernent le français.</p>
<p class="small">${html(summary.inferenceProfileShort)}</p>
</section><section>
<h2>Données et droits</h2>
<p>Valkaama, Tim Baumann d’après Hendrik Behnisch, ${html(license.originalVersion)}, 56 scènes, <strong>${html(license.license)}</strong> selon la <a href="${html(license.originalSourceUrl)}">page de l’auteur</a>. Adaptation attribuée sous la même licence : 15 erreurs délibérées et quatre contrôles sur 19 accessoires ajoutés ; mesure S001–S012. Les faux raccords ne sont pas attribués aux auteurs originaux.</p>
<p>Les Heures Creuses et les vignettes sont synthétiques. MovieSum facultatif, hors benchmark ; la licence déclarée du dataset ne garantit pas les droits des œuvres sous-jacentes. Importer des textes autorisés.</p>
<h2>Protections et confidentialité</h2>
<p>Clés serveur ; limites de taille et de pages ; citations et identifiants vérifiés ; documents traités comme données ; sorties non exécutées. Groq reçoit les scènes ou extraits après confirmation d’envoi ; Ollama traite localement. Projets sur l’appareil, sans synchronisation d’équipe.</p>
<h2>Hors périmètre et limites</h2>
<p>Pas de vision, d’audio, de vidéo, d’OCR ni de planning de tournage. Ordre narratif non reconstruit. Homonymes, flashbacks et transferts implicites difficiles ; RAG lexical limité sur les paraphrases et langues croisées. Citation exacte ≠ interprétation correcte. Aucune détection exhaustive promise.</p>
</section></div>
<h2>Évaluation disponible</h2>
<p><strong>${html(summary.primaryStatus)}</strong> ${c?.system ? `Précision sur les alertes des accessoires contrôlés : ${percentage(c.system.precision)} [IC 95 % ${interval(c.system.precisionCI95)}] ; rappel des quinze injections : ${percentage(c.system.recall)} [${interval(c.system.recallCI95)}] ; F1 ${percentage(c.system.f1)}. ${c.system.unannotatedAlertCount} alertes hors périmètre exclues du score et à relire.` : ''}</p>
<p>Annotations proposées avec assistance IA, relecture humaine non attestée ; jeu visible, œuvre unique, intervalles descriptifs. Les 50 vignettes, 24 questions et 12 recherches sont des expériences distinctes. Sécurité : ${redPassed}/${red.rows.length} essais adversariaux réels, portée limitée. Décision finale humaine.</p>
<p class="small rule">Responsables et contact : <strong>équipe de trois — à renseigner</strong>. Politique : <span class="mono">docs/use_policy.md</span>. Évaluation et red team : <span class="mono">docs/evaluation_report.md</span>, <span class="mono">docs/red_team_log.md</span>. Guide dans l’application, rubrique « Documentation ». Source et adaptation : <span class="mono">data/controlled-script/license.json</span>.</p>
${footer('Fiche système', '1 / 1')}
</main>`,
);

await mkdir('docs/print', { recursive: true });
await Promise.all([
  writeFile('docs/print/evaluation.html', evaluation),
  writeFile('docs/print/system-card.html', card),
]);
console.log(
  'Documents HTML créés : docs/print/evaluation.html (2 pages) et docs/print/system-card.html (1 page).',
);

// Export facultatif : Chromium imprime le HTML local, sans requête réseau.
// La vérification unpdf échoue si la pagination effective dépasse le contrat.
if (process.argv.includes('--pdf')) {
  const { chromium } = await import('@playwright/test');
  const { extractText } = await import('unpdf');
  const executablePath =
    process.env.CHROME_PATH ||
    (process.platform === 'win32'
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    for (const [name, expectedPages] of [
      ['evaluation', 2],
      ['system-card', 1],
    ]) {
      await page.goto(pathToFileURL(path.resolve(`docs/print/${name}.html`)).href, {
        waitUntil: 'load',
      });
      await page.emulateMedia({ media: 'print' });
      const spacing = await page.evaluate(() =>
        [...document.querySelectorAll('main.page')].map((sheet, index) => {
          const footer = sheet.querySelector('footer');
          const content = [...sheet.children].filter((node) => node !== footer);
          return {
            page: index + 1,
            gap:
              footer.getBoundingClientRect().top -
              Math.max(...content.map((node) => node.getBoundingClientRect().bottom)),
          };
        }),
      );
      if (spacing.some((sheet) => sheet.gap < 8))
        throw new Error(
          `${name} : le contenu empiète sur le pied de page. Ajuster la mise en page avant le rendu.`,
        );
      const pdfPath = `docs/print/${name}.pdf`;
      await page.pdf({
        path: pdfPath,
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: false,
      });
      const actual = await extractText(new Uint8Array(await readFile(pdfPath)));
      if (actual.totalPages !== expectedPages)
        throw new Error(
          `${pdfPath} : ${actual.totalPages} pages au lieu de ${expectedPages}. Ajuster la mise en page avant le rendu.`,
        );
      console.log(
        `${pdfPath} : ${actual.totalPages} page${actual.totalPages > 1 ? 's' : ''}, vérifiées avec unpdf.`,
      );
    }
  } finally {
    await browser.close();
  }
}
