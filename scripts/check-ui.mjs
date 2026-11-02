import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const baseURL = process.env.CHECK_BASE_URL || 'http://127.0.0.1:4173';
const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function openBrowser() {
  const executablePath =
    process.env.CHECK_BROWSER_PATH || (existsSync(systemChrome) ? systemChrome : undefined);
  return chromium.launch({ executablePath, headless: true });
}

export async function dismissWelcome(page) {
  const welcome = page.getByRole('dialog', { name: 'Commencer avec Faux Raccord' });
  if (await welcome.isVisible())
    await welcome.getByRole('button', { name: 'Ouvrir directement le projet' }).click();
}

export async function openProject(page) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Lire le scénario', exact: true }).waitFor();
  await dismissWelcome(page);
}

export async function navigate(page, label) {
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('button', { name: new RegExp(label) })
    .click();
}

export async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document, `${label}: horizontal document overflow`).toBeLessThanOrEqual(
    dimensions.viewport + 2,
  );
}

async function run() {
  await mkdir('artifacts', { recursive: true });
  const browser = await openBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  const checks = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await openProject(page);
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button'),
    ).toHaveCount(3);
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width > 768 ? 1000 : 844 });
      for (const [label, heading, file] of [
        ['Scénario', 'Lire le scénario', 'script'],
        ['Analyse', 'Analyser les accessoires', 'analysis'],
        ['Relecture', 'Relire la continuité', 'review'],
      ]) {
        await navigate(page, label);
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        await assertNoOverflow(page, `${file}-${width}`);
        await expect(
          page
            .getByRole('navigation', { name: 'Navigation principale' })
            .getByRole('button', { name: new RegExp(label) }),
        ).toBeVisible();
        await page.screenshot({ path: `artifacts/${file}-${width}.png`, fullPage: true });
        checks.push(`${label}: ${width}px, visible navigation and no horizontal overflow`);
      }
    }
    expect(pageErrors).toEqual([]);
    await writeFile(
      'artifacts/browser-check.json',
      JSON.stringify({ passed: true, pageErrors, checks, modelCalls: 0 }, null, 2),
    );
    console.log(
      'Interface checked at 1440, 768, 390 and 360 px: three steps, visible labels, no horizontal overflow. No model inference was called.',
    );
  } catch (error) {
    await page.screenshot({ path: 'artifacts/ui-failure.png', fullPage: true }).catch(() => {});
    await writeFile(
      'artifacts/browser-check.json',
      JSON.stringify(
        { passed: false, pageErrors, checks, error: error.message, modelCalls: 0 },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await run();
