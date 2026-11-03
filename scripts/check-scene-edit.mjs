import { expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { openBrowser, openProject, navigate, assertNoOverflow } from './check-ui.mjs';
import { readProjectExport } from '../src/project-import.js';

await mkdir('artifacts', { recursive: true });
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const requests = [];
const unexpectedInference = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/api/{ask,analyze,models/check}', async (route) => {
  unexpectedInference.push(route.request().url());
  await route.abort();
});
await page.route('**/api/edit', async (route) => {
  const body = route.request().postDataJSON();
  requests.push(body);
  const text = body.scenes[0].text.replace(
    'Le verre de la montre se brise',
    'Le verre de la montre reste intact',
  );
  await route.fulfill({
    json: {
      changed: true,
      text,
      summary: 'Le verre reste intact.',
      editPromptVersion: 'scene-edit-v1',
    },
  });
});

async function savedProjects() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('faux-raccord-studio');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}
const checks = [];
try {
  await openProject(page);
  await page.locator('.project-switch').click();
  await page.getByRole('button', { name: /Les Heures Creuses/ }).click();
  await navigate(page, 'Relecture');
  await page
    .getByRole('textbox', { name: 'Note pour l’équipe' })
    .fill('Commentaire conservé dans le projet original.');
  await page.getByRole('button', { name: 'Confirmer le point', exact: true }).click();
  await expect(page.locator('.save-state')).toContainText('Enregistré sur cet appareil');
  const original = (await savedProjects()).find((item) => item.id === 'les-heures-creuses');
  expect(original.analysis.alerts[0].note).toBe('Commentaire conservé dans le projet original.');

  await navigate(page, 'Scénario');
  await page.locator('.scene-list button').nth(1).click();
  const editor = page.getByRole('region', { name: 'Modifier la scène avec le modèle' });
  await editor
    .getByRole('textbox', { name: 'Modifier cette scène', exact: true })
    .fill('Le verre de la montre reste intact dans cette scène.');
  const propose = editor.getByRole('button', { name: 'Proposer une modification', exact: true });
  await expect(propose).toBeDisabled();
  await editor.getByRole('checkbox').check();
  await propose.click();
  await expect(editor).toContainText('Proposition à valider');
  expect(requests).toHaveLength(1);
  expect(requests[0].consent).toBe(true);
  expect(requests[0].scenes).toHaveLength(1);
  expect((await savedProjects()).find((item) => item.id === original.id).scenes).toEqual(
    original.scenes,
  );
  checks.push('The proposal requires explicit consent and does not modify the original scene');

  await editor
    .getByRole('button', { name: 'Appliquer dans une nouvelle copie', exact: true })
    .click();
  await expect(page.locator('.document-title')).toContainText(
    'Les Heures Creuses — version modifiée',
  );
  await expect(page.locator('.save-state')).toContainText('Enregistré sur cet appareil');
  const projects = await savedProjects();
  const preserved = projects.find((item) => item.id === original.id);
  const revised = projects.find((item) => item.derivedFromId === original.id);
  expect(preserved.analysis).toEqual(original.analysis);
  expect(preserved.scenes).toEqual(original.scenes);
  expect(revised.id).not.toBe(original.id);
  expect(revised.analysis).toBeNull();
  expect(revised.scenes[1].text).toContain('Le verre de la montre reste intact');
  expect(revised.controlled).toBe(false);
  checks.push(
    'Applying creates a new version without stale analysis, preserving original notes, decisions and scenes',
  );

  const downloadReady = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  await page.getByRole('button', { name: /Projet complet · JSON/ }).click();
  const download = await downloadReady;
  const exportedPath = 'artifacts/scene-edit-export.json';
  await download.saveAs(exportedPath);
  const validated = readProjectExport(await readFile(exportedPath, 'utf8'));
  expect(validated.analysis).toBeNull();
  expect(validated.scenes).toEqual(revised.scenes);
  await page.locator('input[type=file]').setInputFiles(exportedPath);
  await expect(page.locator('.document-title')).toContainText('Projet importé');
  checks.push(
    'The edited version passes the hardened JSON validator and can be restored from its exported file',
  );

  await page.setViewportSize({ width: 360, height: 844 });
  await assertNoOverflow(page, 'scene-edit-360');
  await page.screenshot({ path: 'artifacts/scene-edit-360.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Langue', exact: true }).selectOption('en');
  await expect(page.getByRole('region', { name: 'Edit the scene with the model' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suggest an edit', exact: true })).toBeDisabled();
  await assertNoOverflow(page, 'scene-edit-en-360');
  expect(errors).toEqual([]);
  expect(unexpectedInference).toEqual([]);
  checks.push(
    'French and English editing controls remain available at 360px without live inference',
  );
  await writeFile(
    'artifacts/scene-edit-check.json',
    JSON.stringify(
      { passed: true, checks, errors, modelCalls: 0, mockedEditCalls: requests.length },
      null,
      2,
    ),
  );
  console.log(
    'Scene editing: consent, proposal, preserved original, new copy, export/restore and English mobile checks passed. No live model call.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'artifacts/scene-edit-failure.png', fullPage: true })
    .catch(() => {});
  await writeFile(
    'artifacts/scene-edit-check.json',
    JSON.stringify({ passed: false, checks, errors, error: error.message, modelCalls: 0 }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
