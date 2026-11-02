import { expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assertNoOverflow, navigate, openBrowser, openProject } from './check-ui.mjs';

await mkdir('artifacts', { recursive: true });
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const checks = [];
const modelRequests = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

// Fixtures test HTTP/UI integration, not model accuracy. No Groq request is sent.
await page.route('**/api/ask', async (route) => {
  const body = route.request().postDataJSON();
  modelRequests.push({
    endpoint: 'ask',
    provider: body.provider,
    model: body.model,
    settings: body.settings,
  });
  const scene = body.scenes.find((scene) => scene.id === 'S003');
  await route.fulfill({
    json: {
      answer: 'Fixture de test : Noé reçoit l’enveloppe rouge. [S003-C01]',
      citations: ['S003-C01'],
      sources: [{ id: 'S003-C01', sceneId: 'S003', page: 1, text: scene.text }],
    },
  });
});

await page.route('**/api/analyze', async (route) => {
  const body = route.request().postDataJSON();
  modelRequests.push({
    endpoint: 'analyze',
    provider: body.provider,
    model: body.model,
    settings: body.settings,
    sceneCount: body.scenes.length,
    consent: body.consent,
  });
  const mentions = body.scenes.map((scene, index) => ({
    sceneId: scene.id,
    quote: scene.text.split('\n').at(-1),
    page: 1,
    state: index ? 'intact' : 'broken',
    owner: 'Inès',
    action: 'observe',
    temporal: 'continuous',
  }));
  const result = {
    objects: [
      {
        id: 'OBJ001',
        key: 'boussole',
        name: 'boussole gravée',
        aliases: [],
        category: 'accessoire',
        mentions,
      },
    ],
    alerts: [],
    analyzedSceneIds: body.scenes.map((scene) => scene.id),
    candidateCount: 0,
    rejectedEvidence: 0,
    usage: { calls: 1, inputTokens: 0, outputTokens: 0, milliseconds: 1 },
    model: body.model,
    provider: body.provider,
    settings: body.settings,
    promptVersion: 'browser-test-fixture',
    completedAt: new Date().toISOString(),
    milliseconds: 1,
  };
  const events = [
    { type: 'progress', done: 0, total: body.scenes.length, message: 'Fixture de test : lecture…' },
    { type: 'result', result },
  ];
  await route.fulfill({
    contentType: 'application/x-ndjson',
    body: events.map((event) => JSON.stringify(event)).join('\n') + '\n',
  });
});

try {
  await openProject(page);
  await page.locator('.project-switch').click();
  await page.getByRole('button', { name: /Les Heures Creuses/ }).click();
  await expect(page.locator('.document-title')).toContainText('Les Heures Creuses');
  await navigate(page, 'Relecture');
  await expect(page.locator('.points-list button')).toHaveCount(3);
  await expect(page.locator('.evidence-card')).toHaveCount(2);
  checks.push(
    'Recorded synthetic example opens with three review points and two source quotes per point',
  );

  const note = 'Relecture du groupe : vérifier la montre avec la mise en scène.';
  await page.getByRole('textbox', { name: 'Note pour l’équipe' }).fill(note);
  await page.getByRole('button', { name: 'Confirmer le point', exact: true }).click();
  await expect(page.locator('.decision-footer')).toContainText('Confirmé');
  await expect(page.locator('.save-state')).toHaveText('Enregistré sur cet appareil');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.project-switch')).toContainText('Les Heures Creuses');
  await navigate(page, 'Relecture');
  await expect(page.getByRole('textbox', { name: 'Note pour l’équipe' })).toHaveValue(note);
  await expect(page.locator('.decision-footer')).toContainText('Confirmé');
  checks.push('Review note and decision survive reload through real IndexedDB persistence');

  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Projet complet · JSON/ }).click();
  const download = await downloadPromise;
  await download.saveAs('artifacts/project-export.json');
  const exported = JSON.parse(await readFile('artifacts/project-export.json', 'utf8'));
  expect(exported.format).toBe('faux-raccord-v1');
  expect(
    exported.project.analysis.alerts.some(
      (alert) => alert.status === 'confirmed' && alert.note === note,
    ),
  ).toBe(true);
  checks.push('Actual JSON download preserves the screenplay, provenance and review decision');

  await page.getByRole('tab', { name: 'Question au scénario', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Votre question', exact: true })
    .fill('Qui reçoit l’enveloppe rouge ?');
  await page.getByRole('button', { name: 'Poser la question', exact: true }).click();
  await expect(page.locator('.answer-box')).toContainText('Fixture de test : Noé');
  await page.locator('.source-card').click();
  await expect(page.getByRole('heading', { name: 'Lire le scénario', exact: true })).toBeVisible();
  await expect(page.locator('.script-page-tools')).toContainText('Scène 3');
  checks.push('Question UI handles a labeled fixture answer and opens its cited source scene');

  await page.locator('.project-switch').click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'Test-continuite.fountain',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      '1. INT. ATELIER - JOUR\nINÈS montre sa boussole gravée. Le verre de la boussole est brisé.\n2. INT. ATELIER - JOUR - CONTINU\nSans réparation ni changement d’objet, INÈS regarde sa même boussole gravée. Le verre est intact.',
    ),
  });
  await expect(page.locator('.document-title')).toContainText('Test continuite');
  await expect(
    page.getByRole('navigation', { name: 'Scènes du scénario' }).getByRole('button'),
  ).toHaveCount(2);
  await navigate(page, 'Analyse');
  const analyze = page.getByRole('button', { name: 'Analyser 2 scènes', exact: true });
  await expect(analyze).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(analyze).toBeEnabled();
  await analyze.click();
  await expect(page.locator('.result-summary')).toContainText('Analyse exécutée');
  await expect(page.locator('.result-numbers')).toContainText('1');
  await expect(page.locator('.error-notice')).toHaveCount(0);
  expect(modelRequests.find((request) => request.endpoint === 'analyze')).toMatchObject({
    sceneCount: 2,
    consent: true,
  });
  checks.push(
    'Real Fountain parsing and consent guard; analysis streaming uses an explicit browser fixture',
  );

  await page.getByRole('button', { name: 'Relire les résultats', exact: true }).click();
  await page.getByRole('tab', { name: /Accessoires/ }).click();
  await expect(page.locator('.object-detail')).toContainText('boussole gravée');
  await page.setViewportSize({ width: 360, height: 844 });
  await assertNoOverflow(page, 'import-analysis-review-360');
  await page.screenshot({ path: 'artifacts/flow-review-mobile.png', fullPage: true });
  expect(pageErrors).toEqual([]);
  await writeFile(
    'artifacts/flow-check.json',
    JSON.stringify(
      {
        passed: true,
        inference: 'Mocked browser fixtures for ask/analyze; no live LLM inference',
        pageErrors,
        modelRequests,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(
    'Review, persistence, export, source links, real Fountain import and mocked model HTTP flows passed. No live LLM inference.',
  );
} catch (error) {
  await page.screenshot({ path: 'artifacts/flow-failure.png', fullPage: true }).catch(() => {});
  await writeFile(
    'artifacts/flow-check.json',
    JSON.stringify(
      {
        passed: false,
        pageErrors,
        modelRequests,
        checks,
        error: error.message,
        inference: 'Mocked browser fixtures; no live LLM inference',
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
