import { expect } from '@playwright/test';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { baseURL, navigate, openBrowser } from './check-ui.mjs';

// This records the real application and its genuinely recorded analyses.
// It never submits an analysis, question or model-compatibility request.
const outputDirectory = resolve('artifacts/demo-recording');
await mkdir(outputDirectory, { recursive: true });
const browser = await openBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const video = page.video();
const errors = [];
const inferenceRequests = [];
const scenes = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  const pathname = new URL(request.url()).pathname;
  if (['/api/analyze', '/api/ask', '/api/models/check'].includes(pathname))
    inferenceRequests.push(pathname);
});
const startedAt = Date.now();

async function pause(label, milliseconds = 2000) {
  scenes.push({ label, seconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)) });
  // Deliberate presentation pauses make the video readable without narration.
  await page.waitForTimeout(milliseconds);
}

async function show(locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.mouse.move(1380, 850);
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await expect(page.getByRole('dialog', { name: 'Commencer avec Faux Raccord' })).toBeVisible();
  await pause('Prise en main : trois étapes');
  await page.getByRole('button', { name: 'Ouvrir directement le projet' }).click();
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('paper');
  await pause('Corpus réel Valkaama');
  await page.getByText('Provenance et conditions d’utilisation', { exact: true }).click();
  await pause('Source auteur et licence CC BY-SA 3.0');
  await page.getByText('Provenance et conditions d’utilisation', { exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Scènes du scénario' })
    .getByRole('button')
    .nth(1)
    .click();
  await show(page.locator('.script-page-tools'));
  await pause('Lecture d’une scène et repères du PDF');

  await navigate(page, 'Analyse');
  await pause('Périmètre et moteur de l’analyse');
  await show(page.locator('.result-summary'));
  await pause('Résultat enregistré : 10 scènes sur 56');
  await navigate(page, 'Relecture');
  await pause('Aucun changement signalé dans l’extrait réel');

  await page.locator('.project-switch').click();
  await pause('Choix d’un exemple contrôlé');
  await page.getByRole('button', { name: /Les Heures Creuses/ }).click();
  await pause('Fiction synthétique clairement identifiée');
  await navigate(page, 'Analyse');
  await pause('Analyse déjà exécutée, sans nouvel appel');
  await show(page.locator('.result-summary'));
  await pause('Couverture du scénario et accessoires suivis');
  await page.getByRole('button', { name: 'Relire les résultats', exact: true }).click();
  await pause('Trois points à relire');
  await show(page.locator('.evidence-grid'));
  await pause('Deux passages sources pour vérifier la montre');
  await show(page.getByRole('textbox', { name: 'Note pour l’équipe' }));
  await page
    .getByRole('textbox', { name: 'Note pour l’équipe' })
    .pressSequentially(
      'Vérifier la montre : aucune réparation n’est décrite entre les deux scènes.',
      { delay: 35 },
    );
  await pause('Note de l’équipe');
  await page.getByRole('button', { name: 'Confirmer le point', exact: true }).click();
  await pause('Décision humaine enregistrée');
  await show(page.locator('.points-list'));
  await page.locator('.points-list button').nth(1).click();
  await pause('Passage à un autre point de continuité');
  await show(page.locator('.evidence-grid'));
  await pause('Vérification du transfert de l’enveloppe');
  await page.locator('.evidence-card .text-button').first().click();
  await pause('Retour au texte original depuis une citation');

  await navigate(page, 'Relecture');
  await page.getByRole('tab', { name: /Accessoires/ }).click();
  await pause('Suivi des accessoires');
  await page.locator('.objects-list button').nth(1).click();
  await pause('Chronologie d’un accessoire');
  await show(page.locator('.object-timeline'));
  await pause('Apparitions, états et propriétaires');
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('slate');
  await pause('Thème Ardoise');
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('paper');
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  await pause('Exports du projet et du rapport');
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await pause('Décisions conservées dans le navigateur');
  await page.getByRole('button', { name: 'Documentation', exact: true }).click();
  await pause('Méthode, confidentialité et limites');
  await page
    .getByRole('button', { name: 'Consulter les résultats d’évaluation', exact: true })
    .click();
  await pause('Mesures sur 50 cas synthétiques réservés');
  await show(page.locator('.evaluation-panel'));
  await pause('Comparaison au prompt simple et limites des scores', 4000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await pause('Faux Raccord : relecture assistée, décision de l’équipe');

  expect(errors).toEqual([]);
  expect(inferenceRequests).toEqual([]);
  await page.close();
  await context.close();
  const artifactPath = resolve('artifacts/faux-raccord-demo.webm');
  await video.saveAs(artifactPath);
  const deliverablePath = resolve('../deliverables/faux-raccord/Faux_Raccord_Demo.webm');
  await mkdir(resolve('../deliverables/faux-raccord'), { recursive: true });
  await copyFile(artifactPath, deliverablePath);
  await writeFile(
    'artifacts/demo-recording.json',
    JSON.stringify(
      {
        passed: true,
        durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
        inferenceRequests,
        pageErrors: errors,
        sources: [
          'Valkaama : analyse réellement enregistrée, 10 scènes',
          'Les Heures Creuses : fiction synthétique, analyse réellement enregistrée',
        ],
        scenes,
        artifactPath,
        deliverablePath,
      },
      null,
      2,
    ),
  );
  console.log(
    'Demo video recorded from the real interface and recorded analyses. No new inference. artifacts/faux-raccord-demo.webm and deliverables/Faux_Raccord_Demo.webm updated.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'artifacts/demo-recording-failure.png', fullPage: true })
    .catch(() => {});
  await writeFile(
    'artifacts/demo-recording.json',
    JSON.stringify(
      { passed: false, pageErrors: errors, inferenceRequests, scenes, error: error.message },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
