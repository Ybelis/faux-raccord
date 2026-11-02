import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseScreenplay } from '../src/core/parser.js';
import { analyze } from '../src/core/pipeline.js';
import { modelConfig } from '../src/core/model.js';
import { demo } from '../data/demo.js';
const corpus = JSON.parse(
  await readFile(new URL('../data/valkaama.json', import.meta.url), 'utf8'),
);
const config = modelConfig(process.env, 'groq');
await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
let recorded = {};
try {
  recorded = JSON.parse(await readFile(new URL('../data/recorded.json', import.meta.url), 'utf8'));
} catch {}
for (const sample of [demo, corpus]) {
  const scenes = parseScreenplay(sample.pages ? sample : sample.text).scenes.slice(
    0,
    sample.id === 'valkaama' ? 10 : 12,
  );
  console.log(`Analyse réelle : ${sample.title}, ${scenes.length} scènes`);
  const audits = [];
  const result = await analyze(scenes, config, {
    onProgress: (p) => console.log(p.message),
    audit: (entry) => {
      audits.push(entry);
      writeFile(
        new URL(`../.local/${sample.id}-audit.json`, import.meta.url),
        JSON.stringify(audits, null, 2),
      );
    },
  });
  recorded[sample.id] = {
    ...result,
    recorded: true,
    provenance: 'Appels réels Groq, pas de résultats simulés.',
    corpusVersion: sample.version || '1.0.0',
  };
  await writeFile(
    new URL('../data/recorded.json', import.meta.url),
    JSON.stringify(recorded, null, 2),
  );
  console.log(
    JSON.stringify({
      title: sample.title,
      objects: result.objects.length,
      alerts: result.alerts.length,
      rejected: result.rejectedEvidence,
      usage: result.usage,
    }),
  );
}
