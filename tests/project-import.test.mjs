import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readProjectExport } from '../src/project-import.js';
import { parseScreenplay } from '../src/core/parser.js';
import { demo } from '../data/demo.js';
import { movieSumProject } from '../worker/sources.js';

const recorded = JSON.parse(
  await readFile(new URL('../data/recorded.json', import.meta.url), 'utf8'),
);
const backup = () => ({
  format: 'faux-raccord-v1',
  project: { ...demo, ...parseScreenplay(demo.text), analysis: structuredClone(recorded[demo.id]) },
});

test('a complete backup retains decisions, evidence and provenance on re-import', () => {
  const data = backup();
  data.project.analysis.alerts[0].status = 'confirmed';
  data.project.analysis.alerts[0].note = 'Vérifié par le groupe.';
  assert.deepEqual(readProjectExport(JSON.stringify(data)), data.project);
});
test('a malformed backup or a duplicate scene ID is rejected before rendering', () => {
  assert.throws(() => readProjectExport('{broken'), /projet Faux Raccord valide/);
  const data = backup();
  data.project.scenes[1].id = data.project.scenes[0].id;
  assert.throws(() => readProjectExport(JSON.stringify(data)), /projet Faux Raccord valide/);
});
test('an imported backup cannot present invented evidence as verified', () => {
  const data = backup();
  data.project.analysis.alerts[0].evidence[0].quote =
    'Une preuve inventée qui ne figure pas dans le scénario.';
  assert.throws(() => readProjectExport(JSON.stringify(data)), /projet Faux Raccord valide/);
});

test('a MovieSum scene split into source parts survives a JSON export and restore', () => {
  const imported = movieSumProject(
    {
      row_idx: 0,
      row: {
        movie_name: 'Test long scene_2024',
        imdb_id: 'tt1234567',
        script: `<script><scene><stage_direction>INT. ATELIER - DAY</stage_direction><scene_description>${'Alice regarde sa montre. '.repeat(900)}</scene_description></scene></script>`,
      },
      truncated_cells: [],
    },
    'train',
  );
  assert.ok(imported.scenes.some((scene) => String(scene.number).includes('.')));
  assert.deepEqual(
    readProjectExport(JSON.stringify({ format: 'faux-raccord-v1', project: imported })),
    imported,
  );
});
