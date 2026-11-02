import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { LANGUAGE_KEY } from '../src/i18n.js';
import { MOVIESUM } from '../worker/sources.js';
import { assertNoOverflow, baseURL, openBrowser, openProject } from './check-ui.mjs';

// Browser fixtures exercise language propagation without spending provider quota.
// Recorded screenplay text, quotations and review decisions are checked separately.
await mkdir('artifacts', { recursive: true });
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const checks = [];
const modelRequests = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.route('**/api/models?*', async (route) =>
  route.fulfill({
    json: {
      models: [
        { id: 'openai/gpt-oss-20b', owner: 'OpenAI', contextWindow: 131072 },
        { id: 'openai/gpt-oss-120b', owner: 'OpenAI', contextWindow: 131072 },
      ],
    },
  }),
);
await page.route('**/api/models/check', async (route) => {
  modelRequests.push({ endpoint: 'check', body: route.request().postDataJSON() });
  await route.fulfill({
    json: { ok: true, usage: { inputTokens: 1, outputTokens: 1, milliseconds: 1 } },
  });
});
await page.route('**/api/ask', async (route) => {
  const body = route.request().postDataJSON();
  modelRequests.push({ endpoint: 'ask', body });
  const scene = body.scenes[0];
  await route.fulfill({
    json: {
      answer: 'Browser fixture: the watch is broken. [S001-C1]',
      citations: ['S001-C1'],
      sources: [{ id: 'S001-C1', sceneId: scene.id, page: scene.pages[0], text: scene.text }],
    },
  });
});
await page.route('**/api/analyze', async (route) => {
  const body = route.request().postDataJSON();
  modelRequests.push({ endpoint: 'analyze', body });
  const result = {
    objects: [],
    alerts: [],
    candidateCount: 0,
    rejectedEvidence: 0,
    analyzedSceneIds: body.scenes.map((scene) => scene.id),
    usage: { calls: 1, inputTokens: 0, outputTokens: 0, milliseconds: 1 },
    model: body.model,
    provider: body.provider,
    settings: body.settings,
    language: 'en',
    promptVersion: 'browser-test-fixture',
    completedAt: new Date().toISOString(),
    milliseconds: 1,
  };
  await route.fulfill({
    contentType: 'application/x-ndjson',
    body: JSON.stringify({ type: 'result', result }) + '\n',
  });
});
await page.route('**/api/library?*', async (route) =>
  route.fulfill({
    json: {
      source: MOVIESUM,
      split: 'all',
      query: '',
      offset: 0,
      pageSize: 6,
      total: 1,
      partial: false,
      items: [
        {
          source: 'moviesum',
          split: 'train',
          rowIndex: 0,
          title: 'Language fixture (2026)',
          imdbId: 'tt1234567',
          summary: '',
          preview: '',
          hasPreview: false,
          language: 'Anglais',
          truncatedBySource: false,
        },
      ],
    },
  }),
);
await page.route('**/api/library/preview?*', async (route) =>
  route.fulfill({
    json: {
      source: 'moviesum',
      split: 'train',
      rowIndex: 0,
      title: 'Language fixture (2026)',
      imdbId: 'tt1234567',
      summary: 'Browser fixture, not a real screenplay.',
      preview: 'INT. TEST ROOM - DAY\nA watch rests on a desk.',
      truncatedBySource: false,
    },
  }),
);

async function navigateEnglish(label) {
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name: new RegExp(label) })
    .click();
}

async function storedProject(id) {
  return page.evaluate(async (projectId) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('faux-raccord-studio');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const project = await new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!project) return null;
    const { savedAt, ...content } = project;
    return content;
  }, id);
}

try {
  await openProject(page);
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('paper');
  await page.locator('.project-switch').click();
  await page.getByRole('button', { name: /Valkaama — atelier de continuité/ }).click();
  const source = await (
    await page.request.get(`${baseURL}/api/samples/controlled-valkaama`)
  ).json();
  expect(source.analysis.alerts).toHaveLength(7);
  await page
    .getByRole('navigation', { name: 'Navigation principale', exact: true })
    .getByRole('button', { name: /Relecture/ })
    .click();
  const originalAlert = source.analysis.alerts[0];
  await expect(page.locator('.evidence-card blockquote')).toHaveText(
    originalAlert.evidence.map((item) => item.quote),
  );
  const note = 'Language check: conserver exactement cette note — test.';
  await page.getByRole('textbox', { name: 'Note pour l’équipe', exact: true }).fill(note);
  await page.getByRole('button', { name: 'Confirmer le point', exact: true }).click();
  await expect(page.locator('.save-state')).toHaveText('Enregistré sur cet appareil');
  const beforeLanguageChange = await storedProject(source.id);

  await page.getByRole('combobox', { name: 'Langue', exact: true }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('paper');
  await expect(page.getByRole('heading', { name: 'Review continuity', exact: true })).toBeVisible();
  await expect(page.locator('.point-detail h2')).toHaveText(originalAlert.title);
  await expect(page.locator('.evidence-card blockquote')).toHaveText(
    originalAlert.evidence.map((item) => item.quote),
  );
  await expect(page.getByRole('textbox', { name: 'Team note', exact: true })).toHaveValue(note);
  await expect(page.locator('.decision-footer')).toContainText('Confirmed');
  expect(await storedProject(source.id)).toEqual(beforeLanguageChange);
  checks.push(
    'FR → EN changes interface labels while preserving the actual screenplay, recorded explanation, quotations, note and decision in IndexedDB',
  );

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Read the script', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('paper');
  await navigateEnglish('Review');
  await expect(page.getByRole('textbox', { name: 'Team note', exact: true })).toHaveValue(note);
  expect(await storedProject(source.id)).toEqual(beforeLanguageChange);
  expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBe('en');
  checks.push('English preference, theme and the reviewed project survive reload');

  for (const width of [1440, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width > 768 ? 1000 : 844 });
    for (const [label, heading] of [
      ['Script', 'Read the script'],
      ['Analysis', 'Analyse the props'],
      ['Review', 'Review continuity'],
    ]) {
      await navigateEnglish(label);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await assertNoOverflow(page, `english-${label}-${width}`);
    }
    await page.getByRole('button', { name: 'Documentation', exact: true }).click();
    for (const [id, title] of [
      ['utiliser', 'Using Faux Raccord'],
      ['fonctionnement', 'Data and processing'],
      ['evaluation', 'Results and tests'],
      ['limites', 'Limits and privacy'],
    ]) {
      await page.locator(`.guide-nav a[href="#/docs/${id}"]`).click();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await assertNoOverflow(page, `english-docs-${id}-${width}`);
    }
    await page.screenshot({ path: `artifacts/english-documentation-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'View evaluation results', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Results and method', exact: true }),
    ).toBeVisible();
    const primary = page.getByRole('region', {
      name: 'Primary controlled experiment',
      exact: true,
    });
    await expect(
      primary.getByRole('heading', { name: '15 injected errors in one screenplay', exact: true }),
    ).toBeVisible();
    const systemRow = primary.locator('.controlled-metrics tbody tr').filter({ hasText: 'System' });
    await expect(systemRow.locator('td')).toHaveText(['7', '0', '8', '100%', '46.7%', '63.6%']);
    await assertNoOverflow(page, `english-evaluation-${width}`);
    await page.screenshot({ path: `artifacts/english-evaluation-${width}.png`, fullPage: true });
  }
  checks.push(
    'Three workspaces, four English documentation chapters and measured evaluation fit 1440/768/390/360 px; numeric results remain unchanged with English decimal formatting',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Documentation', exact: true }).click();
  await page.locator('.guide-nav a[href="#/docs/evaluation"]').click();
  for (const [label, path] of [
    ['Evaluation report — PDF (French)', '/docs/print/evaluation.pdf'],
    ['System card — PDF (French)', '/docs/print/system-card.pdf'],
  ]) {
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      path,
    );
    const response = await page.request.get(baseURL + path);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
  }
  checks.push(
    'English documentation labels French deliverables explicitly and links to valid PDFs',
  );

  await navigateEnglish('Script');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Screenplay library', exact: true });
  await expect(
    library.getByRole('textbox', { name: 'Search MovieSum', exact: true }),
  ).toBeVisible();
  await expect(library).toContainText('Language fixture (2026)');
  await library.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Model settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Model settings', exact: true });
  await expect(
    settings.getByRole('textbox', { name: 'Model identifier', exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Test connection and JSON', exact: true }).click();
  await expect(settings.locator('.settings-success')).toContainText('JSON');
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Interactive tutorial', exact: true }).click();
  await expect(page.locator('.tour-card')).toContainText('GETTING STARTED');
  await expect(page.locator('.tour-card')).toContainText('Next');
  await page.getByRole('button', { name: 'Exit guide', exact: true }).click();
  expect(await storedProject(source.id)).toEqual(beforeLanguageChange);
  checks.push(
    'Library, model settings and isolated interactive guide expose English text and accessible controls without altering the recorded project',
  );

  await navigateEnglish('Review');
  await page.getByRole('tab', { name: 'Ask the screenplay', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Your question', exact: true })
    .fill('What is the state of the watch?');
  await page.getByRole('button', { name: 'Ask question', exact: true }).click();
  await expect(page.locator('.answer-box')).toContainText('Browser fixture: the watch is broken.');
  await page.locator('input[type=file]').setInputFiles({
    name: 'Language-check.fountain',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      '1. INT. TEST ROOM - DAY\nALICE drops her blue watch. Its glass breaks.\n2. INT. TEST ROOM - DAY - CONTINUOUS\nThe same watch has intact glass. Nobody has repaired it.',
    ),
  });
  await expect(page.locator('.document-title')).toContainText('Language check');
  await navigateEnglish('Analysis');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Analyse 2 scenes', exact: true }).click();
  await expect(page.locator('.result-summary')).toContainText('Analysis completed');
  for (const endpoint of ['ask', 'analyze']) {
    const request = modelRequests.find((item) => item.endpoint === endpoint);
    expect(request, `${endpoint}: a request was captured`).toBeTruthy();
    expect(request.body.language, `${endpoint}: selected output language`).toBe('en');
  }
  const connectionRequest = modelRequests.find((item) => item.endpoint === 'check');
  expect(connectionRequest).toBeTruthy();
  expect(connectionRequest.body.scenes).toBeUndefined();
  expect(await storedProject(source.id)).toEqual(beforeLanguageChange);
  checks.push(
    'Mocked question and analysis requests carry language=en; the JSON connection check sends no screenplay, and no live model is called',
  );

  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBe('fr');
  expect(pageErrors).toEqual([]);
  await writeFile(
    'artifacts/language-check.json',
    JSON.stringify(
      {
        passed: true,
        pageErrors,
        checks,
        inference: 'Browser fixtures only; no live model calls',
        modelRequests: modelRequests.map(({ endpoint, body }) => ({
          endpoint,
          language: body.language,
          provider: body.provider,
          model: body.model,
        })),
      },
      null,
      2,
    ),
  );
  console.log(
    'English interface, documentation, persistence, preserved source evidence and language propagation passed at four responsive widths. No live model inference.',
  );
} catch (error) {
  await page.screenshot({ path: 'artifacts/language-failure.png', fullPage: true }).catch(() => {});
  await writeFile(
    'artifacts/language-check.json',
    JSON.stringify({ passed: false, pageErrors, checks, error: error.message }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
