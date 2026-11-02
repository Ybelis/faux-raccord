import { readFile } from 'node:fs/promises';

async function readReport(filename) {
  try {
    return JSON.parse(await readFile(new URL(`../eval/${filename}`, import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}

// Le développement et la compilation présentent les mêmes rapports mesurés.
// Un fichier absent reste absent : on ne remplace jamais une mesure par un score fictif.
export async function loadEvaluation() {
  const [benchmark, qa, retrieval, redTeam] = await Promise.all([
    readReport('report.json'),
    readReport('qa-real-report.json'),
    readReport('retrieval-real.json'),
    readReport('red-team-results.json'),
  ]);
  return {
    ...(benchmark || { status: 'not_run', message: 'Évaluation non exécutée.' }),
    qa,
    retrieval,
    redTeam,
  };
}
