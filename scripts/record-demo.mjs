import { expect } from '@playwright/test';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { baseURL, navigate, openBrowser } from './check-ui.mjs';

// The backup records the real UI and a genuine saved analysis, never a simulated live run.
const evaluation = await (await fetch(`${baseURL}/api/evaluation`)).json();
const controlled = evaluation.controlled;
if (controlled?.status !== 'measured')
  throw new Error('La comparaison contrôlée doit être mesurée avant d’enregistrer la vidéo.');
const project = await (await fetch(`${baseURL}/api/samples/controlled-valkaama`)).json();
if (!project.analysis?.alerts?.length)
  throw new Error('L’analyse contrôlée réellement enregistrée est nécessaire à la vidéo.');
const annotations = JSON.parse(await readFile('data/controlled-script/annotations.json', 'utf8'));
const recordedTruePositive = controlled.system.ledger.find((row) => row.matchedErrorId);
const selectedIndex = Math.max(
  0,
  project.analysis.alerts.findIndex((alert) => alert.id === recordedTruePositive?.alertId),
);
const selectedAlert = project.analysis.alerts[selectedIndex];
const missed = annotations.entries.find((entry) =>
  controlled.system.missedErrorIds.includes(entry.errorId),
);

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
  await page.waitForTimeout(milliseconds);
}
async function show(locator) {
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate((element) =>
    element.scrollIntoView({ block: 'start', behavior: 'instant' }),
  );
  await page.mouse.move(1380, 850);
}
async function openEvaluation() {
  await page.getByRole('button', { name: 'Documentation', exact: true }).click();
  await page
    .getByRole('button', { name: 'Consulter les résultats d’évaluation', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '15 erreurs injectées dans un seul scénario', exact: true }),
  ).toBeVisible();
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Ouvrir directement le projet' }).click();
  await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption('paper');
  await pause('Valkaama : scénario original réel, distinct de notre adaptation');
  await page.getByText('Provenance et conditions d’utilisation', { exact: true }).click();
  await pause('Publication de l’auteur, attribution et licence CC BY-SA 3.0', 2500);

  await openEvaluation();
  const primary = page.getByRole('region', { name: 'Expérience contrôlée principale' });
  await show(primary);
  await pause(
    'Consigne du professeur : 15 injections et quatre transitions expliquées dans un seul scénario',
    2500,
  );
  await primary.getByRole('button', { name: 'Ouvrir le scénario de test', exact: true }).click();
  await expect(page.locator('.document-summary')).toContainText('15 erreurs injectées');
  await pause('Adaptation explicitement identifiée, 56 scènes conservées');
  await page.getByText('Provenance et conditions d’utilisation', { exact: true }).click();
  await pause(
    'Les ajouts ne figurent pas dans le PDF original ; la licence de l’adaptation est conservée',
    2500,
  );

  await navigate(page, 'Analyse');
  await show(page.locator('.result-summary'));
  await pause('Analyse réellement enregistrée : modèle et couverture, sans nouvel appel');
  await navigate(page, 'Relecture');
  await page
    .getByRole('navigation', { name: 'Points de continuité' })
    .getByRole('button')
    .nth(selectedIndex)
    .click();
  await show(page.locator('.point-detail'));
  await expect(page.locator('.evidence-card blockquote')).toHaveText(
    selectedAlert.evidence.map((item) => item.quote),
  );
  await pause(`Alerte ${selectedAlert.id} : deux passages sources consultables`, 3000);
  await show(page.locator('.evidence-grid'));
  await pause('Lire les preuves avant de décider', 2500);
  await page.locator('.evidence-card').first().getByRole('button').click();
  await show(page.locator('.script-paper'));
  await pause('Premier passage : retour à la scène complète');
  await navigate(page, 'Relecture');
  await page.locator('.evidence-card').nth(1).getByRole('button').click();
  await show(page.locator('.script-paper'));
  await pause('Second passage : vérifier le changement dans son contexte');
  await navigate(page, 'Relecture');
  const note = page.getByRole('textbox', { name: 'Note pour l’équipe' });
  await show(note);
  await note.fill(
    'Démonstration : comparer les deux passages avec l’équipe avant toute correction.',
  );
  await page.getByRole('button', { name: 'Confirmer le point', exact: true }).click();
  await pause('Décision et note de démonstration sauvegardées, sans réentraîner le modèle');

  await openEvaluation();
  await show(primary.locator('.controlled-metrics'));
  await pause(
    `Mesure réelle — système : ${controlled.system.tp} détectées, ${controlled.system.fp} fausses alertes et ${controlled.system.fn} manquées`,
    3000,
  );
  await primary.getByText('Comprendre les chiffres et leur incertitude', { exact: true }).click();
  await show(primary.locator('details').first());
  await pause(
    'Précision, rappel, baseline au même modèle et incertitude : les limites restent visibles',
    3000,
  );

  if (missed) {
    await pause(`Échec observé : injection ${missed.errorId} manquée par le système`, 2500);
    await primary.getByRole('button', { name: 'Ouvrir le scénario de test', exact: true }).click();
    for (const evidence of [missed.before, missed.after]) {
      const scene = project.scenes.find((item) => item.id === evidence.sceneId);
      await page
        .getByRole('navigation', { name: 'Scènes du scénario' })
        .getByRole('button')
        .nth(scene.number - 1)
        .click();
      await show(page.locator('.script-paper'));
      await pause(
        `${missed.errorId} : retour au passage ${evidence.sceneId} pour vérification manuelle`,
        2500,
      );
    }
  } else if (controlled.system.fp > 0) {
    await primary
      .getByText('Voir les associations des alertes aux erreurs attendues', { exact: true })
      .click();
    await show(primary.locator('.controlled-ledger'));
    await pause('Échec observé : les fausses alertes restent dans le journal et le score', 2500);
  }

  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  await pause('Export du projet et du rapport pour conserver les sources et décisions');
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await openEvaluation();
  const history = page.locator('.historical-evaluation');
  await history.getByText('Vérifications complémentaires', { exact: true }).click();
  await show(history);
  await pause('Les anciennes vignettes et la QA sont des vérifications complémentaires distinctes');
  await page.getByRole('button', { name: 'Documentation', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Rubriques de la documentation' })
    .getByRole('link', { name: 'Exigences et limites', exact: true })
    .click();
  await pause('Guide unique : exigences, preuves, limites et travail humain restant', 2500);

  expect(errors).toEqual([]);
  expect(inferenceRequests).toEqual([]);
  expect((Date.now() - startedAt) / 1000).toBeLessThanOrEqual(150);
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
          'Valkaama original CC BY-SA 3.0',
          'Valkaama — adaptation contrôlée, analyse réellement enregistrée',
        ],
        model: controlled.model.id,
        recordedAnalysisApiCalls: project.analysis.usage.calls,
        selectedAlertId: selectedAlert.id,
        shownMissedErrorId: missed?.errorId || null,
        scenes,
        artifactPath,
        deliverablePath,
      },
      null,
      2,
    ),
  );
  console.log(
    'Backup video updated with the controlled experiment, genuine source passages and measured metrics. No new inference.',
  );
} catch (error) {
  await page
    .screenshot({ path: 'artifacts/demo-recording-failure.png', fullPage: true })
    .catch(() => {});
  await writeFile(
    'artifacts/demo-recording.json',
    JSON.stringify(
      {
        passed: false,
        pageErrors: errors,
        inferenceRequests,
        scenes,
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
