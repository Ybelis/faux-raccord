import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertNoOverflow, baseURL, navigate, openBrowser, openProject } from './check-ui.mjs';

await mkdir('artifacts', { recursive: true });
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const inferenceRequests = [];
const checks = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('request', (request) => {
  if (/\/api\/(?:ask|analyze|models\/check)(?:\?|$)/.test(new URL(request.url()).pathname))
    inferenceRequests.push(request.url());
});

async function assertMatrix(values) {
  await expect(page.locator('.confusion-grid > div > strong')).toHaveText(values.map(String));
}

try {
  await openProject(page);
  await page.getByRole('button', { name: 'Documentation', exact: true }).click();
  await page
    .getByRole('button', { name: 'Consulter les résultats d’évaluation', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Résultats et méthode', exact: true }),
  ).toBeVisible();
  const explainer = page.getByRole('region', { name: 'Comprendre les métriques' });
  const methods = page.getByRole('group', { name: 'Méthode à expliquer' });
  await assertMatrix([17, 1, 4, 28]);
  await expect(explainer.locator('.metric-definitions')).toContainText('17 / (17 + 1) = 94,4 %');
  await expect(explainer.locator('.metric-definitions')).toContainText('17 / (17 + 4) = 81 %');
  checks.push(
    'System confusion matrix 17/1/4/28 and displayed precision/recall formulas match the measured case counts',
  );

  await methods.getByRole('button', { name: 'Prompt simple', exact: true }).click();
  await assertMatrix([21, 4, 0, 25]);
  await expect(explainer.locator('.metric-definitions')).toContainText('21 / (21 + 4) = 84 %');
  await expect(explainer.locator('.metric-definitions')).toContainText('21 / (21 + 0) = 100 %');
  await expect(methods.getByRole('button', { name: 'Prompt simple', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  checks.push('Switching to the baseline updates all four counts and both formulas to 21/4/0/25');

  for (const title of [
    'Pourquoi ne pas donner uniquement le pourcentage de bonnes décisions ?',
    'Comment lire l’intervalle de confiance à 95 % ?',
    'Que signifient latence, tokens et coût ?',
  ])
    await page.getByText(title, { exact: true }).click();
  await expect(explainer).toContainText('92 %');
  await expect(explainer).toContainText('58 %');
  await expect(explainer).toContainText('ne signifie pas que chaque alerte est fiable à 95 %');
  await expect(
    page.getByRole('heading', { name: 'Tests du code et des parcours', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.test-scope-list')).toContainText(
    'Un test logiciel réussi ne prouve pas',
  );
  await expect(page.locator('.test-scope-list')).toContainText(
    'elle ne mesure pas les faux raccords',
  );
  checks.push(
    'Accuracy, uncertainty, latency/tokens/cost and the difference between software tests and model evaluation are visible',
  );

  await methods.getByRole('button', { name: 'Système', exact: true }).click();
  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width > 768 ? 1000 : 844 });
    await assertNoOverflow(page, `evaluation-${width}`);
    await assertMatrix([17, 1, 4, 28]);
    await page.screenshot({ path: `artifacts/evaluation-${width}.png`, fullPage: true });
    if (width === 1440 || width === 390)
      await explainer.screenshot({ path: `artifacts/evaluation-explainer-${width}.png` });
  }
  checks.push('Explanations remain readable without horizontal overflow at 1440/768/390/360 px');

  // This optional path uses the actual source API. It never starts inference.
  if (process.argv.includes('--live-library')) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate(page, 'Scénario');
    await page.getByRole('button', { name: 'Bibliothèque', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Bibliothèque de scénarios' });
    await expect(library.getByRole('combobox', { name: 'Collection MovieSum' })).toHaveValue('all');
    await library.getByRole('textbox', { name: 'Rechercher dans MovieSum' }).fill('Napoléon 2023');
    await library.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(
      library.getByRole('heading', { name: 'Napoleon (2023)', exact: true }),
    ).toBeVisible();
    await expect(library.locator('.source-preview pre')).toContainText('NAPOLEON', {
      timeout: 30000,
    });
    await expect(library.locator('.source-results-line')).toContainText('1 résultat');
    await library.getByRole('textbox', { name: 'Rechercher dans MovieSum' }).fill('tt13287846');
    await library.getByRole('button', { name: 'Rechercher', exact: true }).click();
    await expect(
      library.getByRole('heading', { name: 'Napoleon (2023)', exact: true }),
    ).toBeVisible();
    await expect(library.locator('.source-preview pre')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'artifacts/library-napoleon-1440.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoOverflow(page, 'library-napoleon-390');
    await page.screenshot({ path: 'artifacts/library-napoleon-390.png' });
    checks.push(
      'Real MovieSum title/accent and IMDb searches find Napoleon (2023); genuine remote preview renders on desktop and mobile',
    );
  }
  expect(pageErrors).toEqual([]);
  expect(inferenceRequests).toEqual([]);
  await writeFile(
    'artifacts/evaluation-check.json',
    JSON.stringify(
      {
        passed: true,
        baseURL,
        pageErrors,
        inferenceRequests,
        checks,
        sources: process.argv.includes('--live-library')
          ? 'Actual title index and live MovieSum preview'
          : 'Evaluation reports only; no source request',
      },
      null,
      2,
    ),
  );
  console.log(
    'Evaluation explanations, both confusion matrices and responsive layouts passed. No model inference.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'artifacts/evaluation-failure.png', fullPage: true })
    .catch(() => {});
  await writeFile(
    'artifacts/evaluation-check.json',
    JSON.stringify(
      { passed: false, pageErrors, inferenceRequests, checks, error: error.message },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
