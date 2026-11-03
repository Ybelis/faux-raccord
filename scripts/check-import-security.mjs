import { expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assertNoOverflow, navigate, openBrowser, openProject } from './check-ui.mjs';

// This browser has its own IndexedDB. Real imports run against the local API;
// inference routes are blocked even if a regression tries to call a provider.
await mkdir('artifacts', { recursive: true });
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const blockedModelRequests = [];
const importRequests = [];
const checks = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('request', (request) => {
  if (new URL(request.url()).pathname === '/api/import') importRequests.push(request.method());
});
await page.addInitScript(() => {
  globalThis.__importExecuted = false;
});
for (const routePath of ['ask', 'analyze', 'models/check'])
  await page.route(`**/api/${routePath}`, async (route) => {
    blockedModelRequests.push(routePath);
    await route.fulfill({ status: 503, json: { error: 'Inference disabled in security check.' } });
  });

async function projects() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('faux-raccord-studio');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('projects').objectStore('projects').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
}

async function upload(name, buffer, mimeType = 'application/json') {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType, buffer });
}

async function currentProjectId() {
  const saved = await projects();
  return saved.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))[0]?.id;
}

try {
  await openProject(page);
  await page.locator('.project-switch').click();
  await page.getByRole('button', { name: /Les Heures Creuses/ }).click();
  await navigate(page, 'Relecture');
  const note = 'Note originale à conserver lors d’un import.';
  await page.getByRole('textbox', { name: 'Note pour l’équipe' }).fill(note);
  await page.getByRole('button', { name: 'Confirmer le point', exact: true }).click();
  await expect
    .poll(async () => {
      const original = (await projects()).find((project) => project.id === 'les-heures-creuses');
      return (
        original?.analysis.alerts[0].status === 'confirmed' &&
        original.analysis.alerts[0].note === note
      );
    })
    .toBe(true);
  const original = (await projects()).find((project) => project.id === 'les-heures-creuses');

  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Projet complet · JSON/ }).click();
  const download = await downloading;
  await download.saveAs('artifacts/import-security-original.json');
  const raw = await readFile('artifacts/import-security-original.json', 'utf8');
  const backup = JSON.parse(raw);
  expect(backup.project.id).toBe(original.id);

  const invalidUTF8 = Buffer.from(raw);
  const titleByte = invalidUTF8.indexOf(Buffer.from(original.title));
  expect(titleByte).toBeGreaterThanOrEqual(0);
  invalidUTF8[titleByte] = 0xff;
  await upload('invalid-utf8.json', invalidUTF8);
  await expect(page.locator('.error-notice')).toContainText('encodé en UTF-8');
  expect(await currentProjectId()).toBe(original.id);
  expect((await projects()).find((project) => project.id === original.id)).toEqual(original);
  checks.push(
    'A malformed UTF-8 byte inside a JSON string is rejected without silently replacing text or the original review',
  );

  for (const sourceUrl of [
    'javascript:globalThis.__importExecuted=true',
    'file:///C:/private-document.txt',
  ]) {
    const hostile = structuredClone(backup);
    hostile.project.sourceUrl = sourceUrl;
    await upload('unsafe-url.json', Buffer.from(JSON.stringify(hostile)));
    await expect(page.locator('.error-notice')).toContainText('projet Faux Raccord valide');
    expect(await currentProjectId()).toBe(original.id);
    expect((await projects()).find((project) => project.id === original.id)).toEqual(original);
    await expect(page.locator('a[href^="javascript:"], a[href^="file:"]')).toHaveCount(0);
  }
  checks.push(
    'Unsafe javascript: and file: source URLs are rejected before rendering and leave the original project unchanged',
  );

  await upload('fake.pdf', Buffer.from('MZ\u0000This is not a PDF.'), 'application/pdf');
  await expect(page.locator('.error-notice')).toContainText('PDF valide');
  expect(await currentProjectId()).toBe(original.id);
  expect((await projects()).find((project) => project.id === original.id)).toEqual(original);
  checks.push(
    'A renamed binary PDF is refused by the real API without replacing notes, decisions or scenes',
  );

  const literalCode = '<script>globalThis.__importExecuted=true</script>';
  const text = `1. INT. ATELIER - JOUR\nALICE pose sa montre sur la table.\nALICE\nLe livre contient exactement ${literalCode}.\n2. EXT. COUR - JOUR\nAlice reprend sa montre avant de sortir.`;
  await upload('Dialogue-code.fountain', Buffer.from(text), 'text/plain');
  await expect(page.locator('.document-title')).toContainText('Dialogue code');
  await expect(page.locator('.script-paper pre')).toContainText(literalCode);
  await expect(
    page.locator('script').filter({ hasText: 'globalThis.__importExecuted=true' }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__importExecuted)).toBe(false);
  await expect(page.locator('.save-state')).toHaveText('Enregistré sur cet appareil');
  await page.setViewportSize({ width: 360, height: 844 });
  await assertNoOverflow(page, 'literal-code-import-360');
  await page.screenshot({ path: 'artifacts/import-literal-text-360.png', fullPage: true });
  checks.push(
    'A legitimate screenplay dialogue containing script-like text imports and displays literally without executing code',
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await upload('restore-project.json', Buffer.from(raw));
  await expect(page.locator('.document-title')).toContainText('Les Heures Creuses');
  await expect(page.locator('.document-title')).toContainText('Projet importé');
  await expect
    .poll(
      async () =>
        (await projects()).filter((project) => project.importedFromId === original.id).length,
    )
    .toBe(1);
  const all = await projects();
  const restored = all.find((project) => project.importedFromId === original.id);
  expect(restored.id).not.toBe(original.id);
  expect(restored.importedBackup).toBe(true);
  expect(restored.analysis.imported).toBe(true);
  expect(restored.scenes).toEqual(original.scenes);
  expect(restored.analysis.alerts).toEqual(original.analysis.alerts);
  expect(all.find((project) => project.id === original.id)).toEqual(original);
  checks.push(
    'Re-importing an existing project ID creates a new copy, retains its review, and leaves the original IndexedDB record intact',
  );

  await navigate(page, 'Analyse');
  await expect(page.locator('.result-label')).toContainText('Résultat importé');
  await expect(page.locator('.result-label')).not.toContainText('Analyse enregistrée');
  await expect(page.locator('.result-summary')).toContainText('déclarés dans ce fichier');
  await page.setViewportSize({ width: 360, height: 844 });
  await assertNoOverflow(page, 'imported-analysis-provenance-360');
  await page.screenshot({ path: 'artifacts/imported-result-360.png', fullPage: true });
  checks.push(
    'Imported analyses visibly identify their file-declared provenance instead of claiming a verified recorded run',
  );

  await page.getByRole('combobox', { name: 'Langue', exact: true }).selectOption('en');
  await expect(page.locator('.result-label')).toContainText('Imported result');
  await expect(page.locator('.result-summary')).toContainText('declared in that file');
  await expect(page.locator('.result-label')).not.toContainText('Recorded analysis');
  await assertNoOverflow(page, 'imported-analysis-provenance-english-360');
  await page.screenshot({ path: 'artifacts/imported-result-en-360.png', fullPage: true });
  checks.push(
    'English labels retain the imported-result distinction and file-declared provenance on mobile',
  );

  expect(pageErrors).toEqual([]);
  expect(blockedModelRequests).toEqual([]);
  expect(importRequests).toHaveLength(2);
  await writeFile(
    'artifacts/import-security-check.json',
    JSON.stringify(
      {
        passed: true,
        checks,
        pageErrors,
        blockedModelRequests,
        actualDocumentImports: importRequests.length,
        liveInferenceCalls: 0,
      },
      null,
      2,
    ),
  );
  console.log(
    'Import security browser checks passed: literal text, rejected payloads, independent restoration and explicit provenance. No model inference.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'artifacts/import-security-failure.png', fullPage: true })
    .catch(() => {});
  await writeFile(
    'artifacts/import-security-check.json',
    JSON.stringify(
      {
        passed: false,
        checks,
        pageErrors,
        blockedModelRequests,
        importRequests,
        error: error.message,
        liveInferenceCalls: 0,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
