import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertNoOverflow, baseURL, navigate, openBrowser, openProject } from './check-ui.mjs';
import { MOVIESUM, movieSumProject } from '../worker/sources.js';

await mkdir('artifacts', { recursive: true });
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const checks = [];
const verificationRequests = [];
const sourceImports = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

// Catalog and compatibility responses are fixtures; no remote service is called.
await page.route('**/api/models?*', async (route) => {
  const local = new URL(route.request().url()).searchParams.get('provider') === 'ollama';
  await route.fulfill({
    json: {
      provider: local ? 'ollama' : 'groq',
      models: local
        ? [
            { id: 'qwen3:1.7b', parameters: '1.7B', quantization: 'Q4_K_M' },
            { id: 'qwen3:4b', parameters: '4B' },
          ]
        : [
            { id: 'openai/gpt-oss-20b', owner: 'OpenAI', contextWindow: 131072 },
            { id: 'openai/gpt-oss-120b', owner: 'OpenAI' },
          ],
    },
  });
});
await page.route('**/api/models/check', async (route) => {
  verificationRequests.push(route.request().postDataJSON());
  await route.fulfill({
    json: { ok: true, usage: { inputTokens: 1, outputTokens: 1, milliseconds: 1 } },
  });
});
const libraryEntry = {
  row_idx: 0,
  row: {
    movie_name: 'Fixture source_2024',
    imdb_id: 'tt1234567',
    summary: 'Donnée de test pour le parcours de bibliothèque.',
    script:
      '<script><scene><stage_direction>INT. ATELIER - DAY</stage_direction><scene_description>Une boussole gravée est posée sur la table.</scene_description></scene><scene><stage_direction>EXT. COUR - DAY</stage_direction><scene_description>Inès regarde sa boussole gravée.</scene_description></scene></script>',
  },
  truncated_cells: [],
};
await page.route('**/api/library?*', async (route) => {
  await route.fulfill({
    json: {
      source: MOVIESUM,
      split: 'train',
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
          title: 'Fixture source (2024)',
          imdbId: 'tt1234567',
          summary: libraryEntry.row.summary,
          preview: 'INT. ATELIER - DAY\nUne boussole gravée est posée sur la table.',
          language: 'Anglais',
          truncatedBySource: false,
        },
      ],
    },
  });
});
await page.route('**/api/library/import', async (route) => {
  sourceImports.push(route.request().postDataJSON());
  await route.fulfill({ json: movieSumProject(libraryEntry, 'train') });
});

async function savedProjects() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('faux-raccord-studio');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const projects = await new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return projects.map((project) => ({
      id: project.id,
      title: project.title,
      alerts:
        project.analysis?.alerts.map((alert) => ({
          id: alert.id,
          status: alert.status,
          note: alert.note,
        })) || [],
    }));
  });
}

async function waitForSaved() {
  await expect(page.locator('.save-state')).toHaveText('Enregistré sur cet appareil');
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  const introduction = page.getByRole('dialog', { name: 'Commencer avec Faux Raccord' });
  await expect(introduction).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await introduction.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press('Shift+Tab');
  expect(await introduction.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(introduction).toHaveCount(0);
  checks.push('First-use introduction is keyboard accessible and dismissible');

  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('paper');
  const paperBackground = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  await page.screenshot({ path: 'artifacts/theme-paper.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('slate');
  const slateBackground = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(slateBackground).not.toBe(paperBackground);
  await page.screenshot({ path: 'artifacts/theme-slate.png', fullPage: true });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('combobox', { name: 'Thème', exact: true })).toHaveValue('slate');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  const systemDark = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  await page.emulateMedia({ colorScheme: 'light' });
  const systemLight = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(systemDark).not.toBe(systemLight);
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('paper');
  checks.push(
    'Paper/slate themes differ, selection survives reload, system theme follows OS preference',
  );

  await page.getByRole('button', { name: 'Réglages du moteur', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages du moteur' });
  await expect(settings.getByRole('combobox', { name: 'Modèles du catalogue Groq' })).toBeEnabled();
  await settings.getByText('Réglages avancés', { exact: true }).click();
  await settings.getByRole('combobox', { name: 'Température' }).selectOption('0.3');
  await settings.getByRole('combobox', { name: 'Sortie maximale par appel' }).selectOption('8000');
  await settings.getByRole('combobox', { name: 'Effort de raisonnement' }).selectOption('medium');
  await settings.getByRole('button', { name: 'Tester la connexion et le JSON' }).click();
  await expect(settings.getByRole('status')).toContainText('Réponse JSON vérifiée');
  expect(verificationRequests[0].settings).toMatchObject({
    temperature: 0.3,
    maxOutputTokens: 8000,
    reasoningEffort: 'medium',
  });
  await settings.getByRole('button', { name: /Ollama/ }).click();
  await expect(
    settings.getByRole('combobox', { name: 'Modèles installés', exact: true }),
  ).toBeEnabled();
  await settings
    .getByRole('combobox', { name: 'Modèles installés', exact: true })
    .selectOption('qwen3:4b');
  await settings.getByRole('combobox', { name: 'Contexte Ollama' }).selectOption('32768');
  await settings.getByRole('button', { name: /Groq/ }).click();
  await expect(settings.getByRole('combobox', { name: 'Température' })).toHaveValue('0.3');
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Réglages du moteur', exact: true })).toBeFocused();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Réglages du moteur', exact: true }).click();
  await settings.getByText('Réglages avancés', { exact: true }).click();
  await expect(settings.getByRole('combobox', { name: 'Sortie maximale par appel' })).toHaveValue(
    '8000',
  );
  await settings.getByRole('button', { name: /Ollama/ }).click();
  await expect(
    settings.getByRole('textbox', { name: 'Identifiant du modèle', exact: true }),
  ).toHaveValue('qwen3:4b');
  await expect(settings.getByRole('combobox', { name: 'Contexte Ollama' })).toHaveValue('32768');
  await settings.getByRole('button', { name: /Groq/ }).click();
  await page.keyboard.press('Escape');
  checks.push(
    'Provider-specific settings, advanced parameters, compatibility fixture, reload persistence and dialog focus restoration',
  );

  await page.locator('.project-switch').click();
  await page.getByRole('button', { name: /Les Heures Creuses/ }).click();
  await navigate(page, 'Relecture');
  await page.locator('.points-list button').nth(1).click();
  await page
    .getByRole('textbox', { name: 'Note pour l’équipe' })
    .fill('Cette décision appartient au projet original.');
  await page.getByRole('button', { name: 'Écarter', exact: true }).click();
  await waitForSaved();
  const beforeTour = await savedProjects();

  await page.getByRole('button', { name: 'Guide interactif', exact: true }).click();
  const guide = page.getByRole('complementary', { name: 'Guide interactif' });
  await expect(guide).toBeVisible();
  await expect(page.locator('.save-state')).toHaveText('Copie de démonstration');
  await expect(guide).toContainText('1. Partir du texte');
  await guide.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Analyser les accessoires', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Analyser 12 scènes', exact: true }),
  ).toBeDisabled();
  await guide.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(page.locator('.evidence-card')).toHaveCount(2);
  await guide.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(guide.getByRole('button', { name: 'Suivant', exact: true })).toBeDisabled();
  // A valid decision on any point should allow the tutorial to continue.
  await page.locator('.points-list button').nth(2).click();
  await page.getByRole('textbox', { name: 'Note pour l’équipe' }).fill('Note temporaire du guide.');
  await page.getByRole('button', { name: 'Confirmer le point', exact: true }).click();
  await guide.getByRole('button', { name: 'Suivant', exact: true }).click();
  await expect(guide).toContainText('5. Conserver le travail');
  expect(await savedProjects()).toEqual(beforeTour);
  await guide.getByRole('button', { name: 'Revenir à mon projet', exact: true }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Note pour l’équipe' })).toHaveValue(
    'Cette décision appartient au projet original.',
  );
  await waitForSaved();
  expect(await savedProjects()).toEqual(beforeTour);
  checks.push(
    'Five-step tutorial works on an isolated non-persisted copy and restores original project, decision and note',
  );

  await page.setViewportSize({ width: 360, height: 844 });
  await page.getByRole('button', { name: 'Guide interactif', exact: true }).click();
  await expect(guide).toBeVisible();
  await assertNoOverflow(page, 'guide-360');
  await page.screenshot({ path: 'artifacts/guide-mobile.png', fullPage: true });
  await guide.getByRole('button', { name: 'Quitter le guide', exact: true }).click();
  await expect(guide).toHaveCount(0);
  checks.push('Tutorial can be reopened and exited on mobile');

  await navigate(page, 'Scénario');
  await page.getByRole('button', { name: 'Bibliothèque', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Bibliothèque de scénarios' });
  await expect(
    library.getByRole('heading', { name: 'Fixture source (2024)', exact: true }),
  ).toBeVisible();
  await expect(
    library.getByRole('button', { name: 'Importer ce scénario', exact: true }),
  ).toBeDisabled();
  await assertNoOverflow(page, 'library-360');
  await page.screenshot({ path: 'artifacts/library-mobile.png', fullPage: true });
  await library.getByRole('checkbox').check();
  await library.getByRole('button', { name: 'Importer ce scénario', exact: true }).click();
  await expect(library).toHaveCount(0);
  await expect(page.locator('.document-title')).toContainText('Fixture source (2024)');
  await expect(page.getByRole('navigation', { name: 'Scènes du scénario' })).toContainText(
    'repère XML',
  );
  expect(sourceImports).toEqual([
    { source: 'moviesum', split: 'train', rowIndex: 0, acknowledgeRights: true },
  ]);
  await page.getByText('Provenance et conditions d’utilisation', { exact: true }).click();
  await expect(page.locator('.provenance')).toContainText(
    'Ils ne correspondent pas aux pages d’un PDF original',
  );
  checks.push(
    'Library preview and explicit rights acknowledgment import a fixture with honest XML source references',
  );

  expect(pageErrors).toEqual([]);
  await writeFile(
    'artifacts/experience-check.json',
    JSON.stringify(
      {
        passed: true,
        pageErrors,
        verificationRequests,
        sourceImports,
        checks,
        inference: 'Mocked model catalog, compatibility and library responses; no live inference',
      },
      null,
      2,
    ),
  );
  console.log(
    'Themes, system preference, model settings, keyboard dialogs and isolated interactive tutorial passed. No live inference.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'artifacts/experience-failure.png', fullPage: true })
    .catch(() => {});
  await writeFile(
    'artifacts/experience-check.json',
    JSON.stringify(
      {
        passed: false,
        pageErrors,
        verificationRequests,
        checks,
        error: error.message,
        inference: 'Mocked model catalog and compatibility check; no live inference',
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
