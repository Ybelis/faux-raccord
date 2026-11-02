import { readFile } from 'node:fs/promises';
import { demo } from '../data/demo.js';
import { parseScreenplay } from '../src/core/parser.js';
import { mergeObjects, findCandidates } from '../src/core/pipeline.js';
import { callModel, modelConfig } from '../src/core/model.js';
import { JUDGE_PROMPT } from '../src/core/prompts.js';
const audits = JSON.parse(await readFile('.local/les-heures-creuses-audit.json', 'utf8'));
for (const a of audits) console.log(JSON.stringify({ scenes: a.sceneIds, objects: a.validated.objects.map(o => ({ name:o.name, states:o.mentions.map(m => `${m.sceneId}:${m.state}`) })), rejected:a.validated.rejected }));
const scenes = parseScreenplay(demo.text).scenes;
const candidates = findCandidates(mergeObjects(audits.flatMap(a => a.validated.objects), scenes), scenes);
try { console.log(JSON.stringify(await callModel(modelConfig(process.env), JUDGE_PROMPT, { candidates: candidates.map(c => ({ candidateId: c.id, object:c.entityName, before:c.before, after:c.after, context:c.context })) }, { maxTokens:3500 }))); }
catch(e) { console.log(JSON.stringify({message:e.message,details:e.details})); process.exitCode=1; }
