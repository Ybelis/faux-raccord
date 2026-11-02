import { mkdir, writeFile } from 'node:fs/promises';
import { parseScreenplay } from '../src/core/parser.js';
import { analyze, answerQuestion } from '../src/core/pipeline.js';
import { callModel, checkModel, modelConfig } from '../src/core/model.js';

// Ce contrôle fait de vrais appels au serveur Ollama local. Il sépare une
// connexion JSON réussie d'une extraction correcte sur un cas connu.
const modelArgument = process.argv.find((argument) => argument.startsWith('--model='));
const config = modelConfig({ ...process.env, LOCAL_MODE: true }, 'ollama', modelArgument?.slice(8));
const scenes = parseScreenplay(`1. INT. ATELIER - JOUR
ALICE pose sa montre argentée sur la table. Le verre de la montre est brisé.

2. EXT. COUR - JOUR - CONTINU
ALICE regarde la même montre argentée. Sans réparation ni changement de montre, le verre est intact.`).scenes;
const report = {
  kind: 'local-operational-check',
  synthetic: true,
  notQualityBenchmark: true,
  model: config.model,
  settings: config.settings,
  startedAt: new Date().toISOString(),
  checks: {},
};
const checks = [
  ['connection', () => checkModel(config), (result) => result.ok === true],
  [
    'extraction',
    () => analyze(scenes, config, { signal: AbortSignal.timeout(120000) }),
    (result) => result.objects.length >= 1 && result.alerts.length >= 1,
  ],
  [
    'question',
    () =>
      answerQuestion(scenes, 'Dans quel état est le verre de la montre dans la scène 1 ?', config, {
        model: (selected, system, user, options) =>
          callModel(selected, system, user, { ...options, signal: AbortSignal.timeout(120000) }),
      }),
    (result) =>
      result.answer.toLowerCase().includes('brisé') && result.citations.includes('S001-C1'),
  ],
];
for (const [name, execute, verify] of checks) {
  const start = Date.now();
  try {
    const result = await execute();
    report.checks[name] = { passed: verify(result), milliseconds: Date.now() - start, result };
  } catch (error) {
    report.checks[name] = {
      passed: false,
      code: error.code,
      error: error.message,
      milliseconds: Date.now() - start,
    };
  }
  console.log(
    `${name}: ${report.checks[name].passed ? 'réussi' : 'échec'} (${report.checks[name].milliseconds} ms)`,
  );
}
report.completedAt = new Date().toISOString();
report.passed = Object.values(report.checks).every((check) => check.passed);
await mkdir('.local', { recursive: true });
const filename = `.local/local-check-${config.model.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
await writeFile(filename, JSON.stringify(report, null, 2));
console.log(`Rapport : ${filename}. Un JSON valide ne garantit pas une extraction correcte.`);
if (!report.passed) process.exitCode = 1;
