import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Les chiffres viennent des rapports mesurés. Ce script ne lance aucun appel
// au modèle et n'inclut ni variables d'environnement ni contenu de scénario.
const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'));
const [report, retrieval, red, pricing] = await Promise.all([
  readJSON('eval/report.json'),
  readJSON('eval/retrieval-real.json'),
  readJSON('eval/red-team-results.json'),
  readJSON('eval/pricing.json'),
]);
let qa = null;
try {
  qa = await readJSON('eval/qa-real-report.json');
} catch {}

const html = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const percentage = (value) =>
  typeof value === 'number' ? `${(value * 100).toFixed(1).replace('.', ',')} %` : '—';
const interval = (value) => (Array.isArray(value) ? value.map(percentage).join('–') : '—');
const number = (value) => (typeof value === 'number' ? value.toLocaleString('fr-FR') : '—');
const seconds = (value) =>
  typeof value === 'number' ? `${value.toFixed(3).replace('.', ',')} s` : '—';
const money = (value) =>
  typeof value === 'number' ? `${value.toFixed(6).replace('.', ',')} USD` : '—';
const date = (value) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(value));
const cost = (row) =>
  (row.inputTokens * pricing.inputPerMillion + row.outputTokens * pricing.outputPerMillion) / 1e6;
const referenceDate = date(report.completedAt);
const errors = qa ? (qa.baseline.errors || 0) + (qa.system.errors || 0) : 0;
const qaMeasured =
  qa && qa.status === 'completed' && qa.qualityComparable !== false && errors === 0;
const redPassed = red.rows.filter((row) => row.passed).length;

const css = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
html { color-scheme: light; background: #e9ebed; }
body { margin: 0; color: #18242d; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.42; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 180mm; height: 266mm; margin: 12mm auto; padding: 0 0 13mm; position: relative; background: white; break-after: page; }
.page:last-child { break-after: auto; }
.screen-page { padding: 15mm; width: 210mm; height: 296mm; }
.screen-page .page { margin: 0; }
header { border-top: 3pt solid #233e49; padding-top: 5mm; margin-bottom: 6mm; }
.brand { display: flex; justify-content: space-between; align-items: baseline; gap: 8mm; font-size: 8.5pt; letter-spacing: .04em; color: #4b606a; }
.brand strong { letter-spacing: .11em; color: #233e49; }
h1 { font-size: 23pt; line-height: 1.12; margin: 4mm 0 2mm; font-weight: 700; letter-spacing: -.035em; }
.subtitle { color: #53636b; margin: 0; max-width: 166mm; }
h2 { font-size: 12pt; margin: 5.5mm 0 2mm; line-height: 1.25; color: #233e49; }
h3 { font-size: 10pt; margin: 3mm 0 1mm; }
p { margin: 0 0 2.5mm; }
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
  `<tr><td>${html(label)}</td><td>${percentage(row.precision)}<br><span class="small">${interval(row.precisionCI)}</span></td><td>${percentage(row.recall)}</td><td>${percentage(row.f1)}</td><td>${seconds(row.medianSeconds)}</td></tr>`;
const confusion = (row) => `${row.tp} VP · ${row.fp} FP · ${row.fn} FN · ${row.tn} VN`;
const qaRows = qaMeasured
  ? ['baseline', 'system']
      .map((method) => {
        const row = qa[method];
        return `<tr><td>${method === 'baseline' ? 'Prompt simple' : 'Questions avec RAG'}</td><td>${row.passed}/${qa.n} · ${percentage(row.correctAndCitedOrCorrectAbstention)}<br><span class="small">${interval(row.confidence95)}</span></td><td>${row.correctAbstentions}/${row.unanswerableTotal}</td><td>${seconds(row.medianSeconds)}</td></tr>`;
      })
      .join('')
  : '';
const qaSection = qaMeasured
  ? `
<p><strong>${qa.n} questions sur les scènes 1–10 de Valkaama</strong> : vingt informations présentes et quatre absentes, sans modification des événements. La baseline reçoit les dix scènes intégrales ; le système recherche sur ces mêmes scènes.</p>
<table class="metric-table"><thead><tr><th>Méthode</th><th>Réussite [IC 95 %]</th><th>Abstentions correctes</th><th>Médiane</th></tr></thead><tbody>${qaRows}</tbody></table>
<p>La réussite exige des éléments lexicaux de réponse et la citation de la scène attendue, ou <span class="mono">NOT FOUND</span> sans citation. Cette grille automatique reste approximative ; les références proposées avec IA doivent être relues.</p>
<p class="small">Exécution : ${html(date(qa.completedAt))}, ${html(qa.model)}, code ${html(qa.codeHash)}. Erreurs fournisseur : 0. Échecs système : ${html(
      qa.rows
        .filter((row) => !row.system.passed)
        .map((row) => row.id)
        .join(', ') || 'aucun sur ce jeu',
    )}. Cette mesure concerne les réponses, pas la détection de continuité.</p>
`
  : `<div class="note warning"><strong>Mesure QA réelle à terminer.</strong> ${qa ? `${errors} erreurs fournisseur ont empêché une comparaison complète. Les échecs réseau ne permettent pas de conclure sur la qualité du modèle.` : 'Le jeu de 24 questions sourcées existe, mais aucun rapport d’inférence n’est encore disponible.'}</div>`;

const evaluation = document(
  'Faux Raccord — rapport d’évaluation',
  `
<main class="page">
${header('Rapport d’évaluation', 'Continuité textuelle des accessoires · résultats du prototype et limites de leur interprétation')}
<h2>1. Protocole de continuité</h2>
<p>Le jeu comporte <strong>60 cas synthétiques contrôlés</strong> : dix de développement et cinquante réservés au test (${report.rows.filter((row) => row.expected).length} positifs, ${report.n - report.rows.filter((row) => row.expected).length} négatifs). États, possession, réparations, objets homonymes, ellipses, absences de mention et injections sont représentés. Les annotations assistées par IA <strong>attendent une validation étudiante</strong>.</p>
<p>Le prompt simple reçoit le texte intégral du cas. Le système reçoit les mêmes scènes : extraction JSON, validation des citations, suivi d’objets, recherche BM25 puis comparaison LLM. Modèle et température identiques ; tous les appels du système sont comptés.</p>
<p class="small">Référence : ${html(report.model)} sur ${html(report.provider)} · prompts v1.0.0 · température 0 · raisonnement low · code <span class="mono">${html(report.codeHash)}</span>. Les nouveaux réglages du produit n’héritent pas de ces scores.</p>
<h2>2. Résultats et incertitude</h2>
<p>L’unité est le <strong>cas</strong> : au moins une alerte rend la prédiction positive. Précision = VP / (VP + FP) ; rappel = VP / (VP + FN) ; F1 = moyenne harmonique. Les intervalles de Wilson à 95 % rendent visible le petit effectif.</p>
<table class="metric-table"><thead><tr><th>Méthode</th><th>Précision [IC 95 %]</th><th>Rappel</th><th>F1</th><th>Médiane</th></tr></thead><tbody>${metricRow('Prompt simple', report.baseline)}${metricRow('Extraction + RAG + comparaison', report.system)}</tbody></table>
<p class="small">Système : ${html(confusion(report.system))}. Baseline : ${html(confusion(report.baseline))}. Erreurs fournisseur : ${report.system.errors} système, ${report.baseline.errors} baseline. IC du rappel : ${interval(report.system.recallCI)} système ; ${interval(report.baseline.recallCI)} baseline.</p>
<div class="note"><strong>Le prompt simple obtient le meilleur F1.</strong> Le pipeline réduit les fausses alertes de ${report.baseline.fp} à ${report.system.fp}, mais manque ${report.system.fn} cas positifs. Sa supériorité globale n’est pas démontrée. La borne basse de la précision ne confirme pas un seuil de 80 %.</div>
<h2>3. Échecs à expliquer</h2>
<ul><li><strong>Quatre faux négatifs de possession</strong> : C013, C024, C032, C059. Un passeport conservé par un agent réapparaît chez sa propriétaire sans restitution décrite.</li><li><strong>Un faux positif temporel</strong> : C051. Un lecteur cassette cassé est vu intact dans une séquence située cinq ans plus tôt.</li></ul>
<p>Les cas sont courts, synthétiques et parfois proches. Leurs intervalles ne corrigent pas ce biais et ne prédisent pas la performance sur un film. Après lecture des erreurs, toute correction doit être évaluée sur de nouveaux cas indépendants.</p>
${footer('Rapport d’évaluation', '1 / 2')}
</main>
<main class="page">
${header('Données réelles et limites', 'Mesures complémentaires · coût · sécurité · travail restant')}
<h2>4. Questions sur un vrai scénario</h2>
${qaSection}
<h2>5. Recherche, tokens et coût</h2>
<p>Sur ${retrieval.n} recherches lexicales dans Valkaama, la scène de référence apparaît dans les cinq premiers résultats dans <strong>${percentage(retrieval.value)}</strong> des cas. Les citations sont contrôlées dans le texte. Ce résultat mesure la recherche seule.</p>
<table><thead><tr><th>50 cas synthétiques</th><th>Tokens entrée / sortie</th><th>Coût estimé / cas</th></tr></thead><tbody><tr><td>Prompt simple</td><td>${number(report.baseline.inputTokens)} / ${number(report.baseline.outputTokens)}</td><td>${report.model === pricing.model ? money(cost(report.baseline) / report.n) : 'Tarif non associé'}</td></tr><tr><td>Pipeline</td><td>${number(report.system.inputTokens)} / ${number(report.system.outputTokens)}</td><td>${report.model === pricing.model ? money(cost(report.system) / report.n) : 'Tarif non associé'}</td></tr></tbody></table>
<p class="small">Tarif catalogue ${html(pricing.model)}, vérifié le ${html(date(pricing.checkedAt))} : ${pricing.inputPerMillion} USD/M en entrée et ${pricing.outputPerMillion} USD/M en sortie. Estimation hors cache, remises et plan gratuit, distincte d’une facture. Les quotas et le volume d’un scénario modifient coût et latence.${qaMeasured && qa.model === pricing.model ? ` QA réel : ${number(qa.system.inputTokens)} / ${number(qa.system.outputTokens)} tokens système, ${money(cost(qa.system))} au total ; baseline ${money(cost(qa.baseline))}.` : ''}</p>
<h2>6. Sécurité et portée</h2>
<p>${redPassed}/${red.rows.length} essais adversariaux réels ont résisté aux attaques testées : instruction dans le scénario, demande de secret et détournement de la question. Cet échantillon ne garantit pas la résistance générale aux injections.</p>
<p>Les citations extraites sont recherchées après normalisation ; les identifiants inventés sont rejetés. Un passage présent ne garantit pas une interprétation correcte. La validation humaine reste nécessaire.</p>
<div class="note warning"><strong>Avant le rendu :</strong> faire relire les références ; tester avec une personne concernée et convenir d’une cible utile ; vérifier la démo sur les trois machines ; réserver de nouveaux cas avant de modifier le détecteur. Aucun gain de temps utilisateur ni benchmark multi-productions n’est établi.</div>
<p class="small rule">Sources et preuves : <span class="mono">eval/report.json</span>, <span class="mono">eval/qa-real-report.json</span>, <span class="mono">eval/retrieval-real.json</span>, <span class="mono">eval/red-team-results.json</span>. Méthodes reproductibles dans <span class="mono">eval/</span>. Tarifs : <a href="${html(pricing.source)}">documentation Groq</a>. Attribution du scénario et droits : <span class="mono">data/README.md</span>.</p>
${footer('Rapport d’évaluation', '2 / 2')}
</main>`,
);

const card = document(
  'Faux Raccord — fiche système',
  `
<main class="page card">
${header('Fiche système', 'Aide à la relecture de continuité des accessoires d’un scénario')}
<div class="two-columns"><section>
<h2>Usage prévu</h2>
<p>Scriptes et petites équipes de court métrage préparant le suivi des accessoires. Le produit rassemble des mentions et propose des points sourcés à examiner. Le besoin et le gain de temps restent à valider avec une personne réelle.</p>
<h2>Entrées et sorties</h2>
<p>PDF avec texte, TXT, Fountain, Markdown. Scènes et pages, accessoires, mentions, deux passages par point signalé, décision et note de revue. Export du projet JSON et du rapport Markdown.</p>
<h2>Modèle de référence</h2>
<p><span class="mono">openai/gpt-oss-20b</span> via Groq : MoE 20B, 3,6B actifs, licence Apache 2.0 ; température 0 et raisonnement low. Précision d’infrastructure TruePoint gérée par Groq, pas par l’équipe. L’API ne propose pas de snapshot immuable.</p>
<p>Ollama et autres modèles en option. Licence, mémoire et compatibilité à vérifier pour chaque choix. Les nouveaux paramètres sont conservés avec l’analyse ; changer la configuration impose une nouvelle évaluation.</p>
<h2>Fonctionnement</h2>
<p>Segmentation déterministe ; extraction JSON par lots ; contrôle des citations ; suivi des objets ; candidats d’état ou de possession ; BM25 puis comparaison LLM ; revue humaine. Les questions utilisent recherche, réponse citée ou abstention.</p>
</section><section>
<h2>Données et droits</h2>
<p>Valkaama, Tim Baumann d’après Hendrik Behnisch, version 2007-06-30 : 56 scènes, CC BY-SA 3.0, pages conservées. Les Heures Creuses et le benchmark de continuité sont synthétiques.</p>
<p>MovieSum : catalogue externe facultatif, hors benchmark. Sa licence de jeu déclarée CC BY-NC 4.0 ne garantit pas les droits des œuvres sous-jacentes. Imports avec provenance et portée explicites.</p>
<h2>Protections et confidentialité</h2>
<p>Clés côté serveur ; limites de fichier, pages et texte ; citations et identifiants contrôlés ; documents traités comme données ; sorties non exécutées. Groq reçoit les scènes ou extraits utiles ; Ollama permet l’inférence locale. Les projets restent sur l’appareil, sans synchronisation d’équipe.</p>
<h2>Hors périmètre et limites</h2>
<p>Pas de vidéo, d’OCR ni de planning de tournage. L’ordre narratif n’est pas reconstruit. Identité des objets, flashbacks et transferts implicites difficiles ; RAG lexical limité sur les paraphrases et les langues croisées. Les citations ne prouvent pas la justesse d’une conclusion.</p>
</section></div>
<h2>Évaluation disponible</h2>
<p>50 cas synthétiques réservés, annotations assistées par IA à relire. <strong>Précision par cas signalé ${percentage(report.system.precision)} [${interval(report.system.precisionCI)}], rappel ${percentage(report.system.recall)}, F1 ${percentage(report.system.f1)}.</strong> Baseline : précision ${percentage(report.baseline.precision)}, rappel ${percentage(report.baseline.recall)}, F1 ${percentage(report.baseline.f1)}. Le pipeline réduit les fausses alertes mais n’est pas globalement supérieur.</p>
<p>${qaMeasured ? `QA réel : ${qa.system.passed}/${qa.n} questions réussies selon la grille automatique [${interval(qa.system.confidence95)}], contre ${qa.baseline.passed}/${qa.n} pour la baseline ; validation humaine en attente.` : 'Le jeu de 24 questions réelles existe ; sa comparaison complète reste à vérifier.'} Recherche seule : ${retrieval.n} requêtes, rappel de scène à 5 de ${percentage(retrieval.value)}. Red team : ${redPassed}/${red.rows.length} essais réussis ; portée limitée.</p>
<p class="small rule">Responsables et contact : <strong>équipe de trois — à renseigner</strong>. Détails : <span class="mono">docs/evaluation_report.md</span>, <span class="mono">docs/use_policy.md</span>, <span class="mono">docs/red_team_log.md</span>, <span class="mono">data/README.md</span>. Les rapports bruts conservent leurs dates, modèles et références de code.</p>
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
