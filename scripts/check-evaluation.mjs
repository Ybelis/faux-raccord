import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { guideChapters } from '../data/project-guide.js';
import { fold, locateQuote } from '../src/core/parser.js';
import { percent } from '../src/evaluation.js';
import { assertNoOverflow, baseURL, navigate, openBrowser } from './check-ui.mjs';

// These checks inspect the real interface and recorded reports. No model call is submitted.
const guideOnly = process.argv.includes('--guide-only');
await mkdir('artifacts', { recursive: true });
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const inferenceRequests = [];
const checks = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('request', (request) => {
  if (/\/api\/(?:ask|analyze|models\/check)$/.test(new URL(request.url()).pathname))
    inferenceRequests.push(request.url());
});

async function checkGuide() {
  // A direct documentation link must work without the welcome dialog blocking it.
  await page.goto(`${baseURL}/#/docs/utiliser`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const navigation = page.getByRole('navigation', { name: 'Rubriques de la documentation' });
  await expect(navigation.getByRole('link')).toHaveCount(guideChapters.length);
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width > 768 ? 1000 : 844 });
    for (const chapter of guideChapters) {
      const link = navigation.getByRole('link', { name: chapter.title, exact: true });
      await link.click();
      await expect(page.getByRole('heading', { name: chapter.title, exact: true })).toBeVisible();
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveURL(new RegExp(`#/docs/${chapter.id}$`));
      for (const section of chapter.sections)
        await expect(page.getByRole('heading', { name: section.title, exact: true })).toBeVisible();
      await expect(page.locator('.guide-content')).not.toContainText(
        /préparer le travail à l’oral|soutenance|répartition des commits|questions de l’oral/i,
      );
      await assertNoOverflow(page, `guide-${chapter.id}-${width}`);
      await page.screenshot({ path: `artifacts/guide-${chapter.id}-${width}.png`, fullPage: true });
    }
  }
  checks.push(
    `${guideChapters.length} product documentation chapters render through direct links at 1440/768/390/360px, without internal oral-preparation content or document overflow`,
  );

  // Follow actual generated PDF links rather than merely checking their labels.
  await navigation
    .getByRole('link', {
      name: guideChapters.find((chapter) => chapter.id === 'evaluation').title,
      exact: true,
    })
    .click();
  for (const [label, path] of [
    ['Rapport d’évaluation — PDF', '/docs/print/evaluation.pdf'],
    ['Fiche système — PDF', '/docs/print/system-card.pdf'],
  ]) {
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      path,
    );
    const response = await page.request.get(`${baseURL}${path}`);
    expect(response.ok(), `${label} returns a readable file`).toBe(true);
    expect(response.headers()['content-type']).toContain('application/pdf');
    expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
  }
  checks.push('Both required PDF links serve genuine PDF files');
}

async function checkControlledEvaluation() {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole('button', { name: 'Consulter les résultats d’évaluation', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Résultats et méthode', exact: true }),
  ).toBeVisible();
  const response = await page.request.get(`${baseURL}/api/evaluation`);
  expect(response.ok()).toBe(true);
  const recorded = await response.json();
  const report = recorded.controlled;
  expect(report?.status, 'The primary comparison needs actual measurements').toBe('measured');
  expect(report.dataset.injectionCount).toBe(15);
  const primary = page.getByRole('region', { name: 'Expérience contrôlée principale' });
  await expect(
    primary.getByRole('heading', {
      name: '15 erreurs injectées dans un seul scénario',
      exact: true,
    }),
  ).toBeVisible();
  await expect(primary).toContainText('quatre restent expliquées');
  await expect(primary).toContainText('scènes 1 à 12');
  for (const [label, metrics] of [
    ['Prompt simple', report.baseline],
    ['Système', report.system],
  ]) {
    const row = primary
      .locator('.controlled-metrics tbody tr')
      .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) });
    await expect(row.locator('td')).toHaveText([
      String(metrics.tp),
      String(metrics.fp),
      String(metrics.fn),
      percent(metrics.precision),
      percent(metrics.recall),
      percent(metrics.f1),
    ]);
  }
  await primary.getByText('Comprendre les chiffres et leur incertitude', { exact: true }).click();
  await expect(primary).toContainText(
    `précision ${report.system.tp} / (${report.system.tp} + ${report.system.fp})`,
  );
  await expect(primary).toContainText('Les intervalles de Wilson');
  await expect(primary).toContainText('ne mesure donc pas toutes les fausses alertes');
  await primary
    .getByText('Voir les associations des alertes aux erreurs attendues', { exact: true })
    .click();
  await expect(primary.locator('.controlled-ledger tbody tr')).toHaveCount(
    report.system.ledger.length,
  );
  checks.push(
    'Primary evaluation shows the measured per-injection counts, formulas, scope, excluded alerts and matching ledger',
  );

  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width > 768 ? 1000 : 844 });
    await assertNoOverflow(page, `controlled-evaluation-${width}`);
    await page.screenshot({ path: `artifacts/evaluation-${width}.png`, fullPage: true });
  }
  const history = page.locator('.historical-evaluation');
  await expect(history).not.toHaveAttribute('open', '');
  await history.getByText('Vérifications complémentaires', { exact: true }).click();
  const methods = history.getByRole('group', { name: 'Méthode à expliquer' });
  await expect(history.locator('.confusion-grid > div > strong')).toHaveText([
    '17',
    '1',
    '4',
    '28',
  ]);
  await methods.getByRole('button', { name: 'Prompt simple', exact: true }).click();
  await expect(history.locator('.confusion-grid > div > strong')).toHaveText([
    '21',
    '4',
    '0',
    '25',
  ]);
  await expect(history.locator('.metric-definitions')).toContainText('21 / (21 + 4) = 84 %');
  checks.push(
    'Historical case-level evaluation stays separate and both recorded confusion matrices remain correct',
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await primary.getByRole('button', { name: 'Ouvrir le scénario de test', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lire le scénario', exact: true })).toBeVisible();
  await expect(page.locator('.document-summary')).toContainText('15 erreurs injectées');
  const sampleResponse = await page.request.get(`${baseURL}/api/samples/controlled-valkaama`);
  const project = await sampleResponse.json();
  expect(
    project.analysis?.alerts?.length,
    'A genuine recorded analysis is required',
  ).toBeGreaterThan(0);
  await navigate(page, 'Relecture');
  const points = page.getByRole('navigation', { name: 'Points de continuité' }).getByRole('button');
  await expect(points).toHaveCount(project.analysis.alerts.length);
  let quotationsChecked = 0;
  for (const [index, alert] of project.analysis.alerts.entries()) {
    await points.nth(index).click();
    await expect(page.locator('.point-detail h2')).toHaveText(alert.title);
    await expect(page.locator('.evidence-card blockquote')).toHaveText(
      alert.evidence.map((item) => item.quote),
    );
    expect(alert.evidence).toHaveLength(2);
    for (const [evidenceIndex, evidence] of alert.evidence.entries()) {
      const scene = project.scenes.find((item) => item.id === evidence.sceneId);
      expect(
        locateQuote(scene, evidence.quote),
        `${alert.id}: quote exists in its actual scene`,
      ).toBeTruthy();
      await page.locator('.evidence-card').nth(evidenceIndex).getByRole('button').click();
      expect(fold(await page.locator('.script-paper pre').textContent())).toContain(
        fold(evidence.quote),
      );
      await navigate(page, 'Relecture');
      quotationsChecked++;
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow(page, 'controlled-review-390');
  await page.screenshot({ path: 'artifacts/controlled-review-390.png', fullPage: true });
  checks.push(
    `Every recorded controlled alert exposes two genuine quotes and both source-scene links (${quotationsChecked} passages)`,
  );
}

try {
  await checkGuide();
  if (!guideOnly) await checkControlledEvaluation();
  expect(pageErrors).toEqual([]);
  expect(inferenceRequests).toEqual([]);
  await writeFile(
    `artifacts/${guideOnly ? 'guide' : 'evaluation'}-check.json`,
    JSON.stringify(
      {
        passed: true,
        baseURL,
        pageErrors,
        inferenceRequests,
        checks,
        sources: 'Actual local guide, PDF files and recorded evaluation/analysis; no inference',
      },
      null,
      2,
    ),
  );
  console.log(
    guideOnly
      ? 'Product documentation checked at four widths, including both PDF links. No inference.'
      : 'Guide, primary controlled evaluation, historical scores and every alert source checked. No inference.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'artifacts/evaluation-failure.png', fullPage: true })
    .catch(() => {});
  await writeFile(
    `artifacts/${guideOnly ? 'guide' : 'evaluation'}-check.json`,
    JSON.stringify(
      {
        passed: false,
        pageErrors,
        inferenceRequests,
        checks,
        error: error.message,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
