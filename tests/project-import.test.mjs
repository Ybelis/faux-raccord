import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readProjectExport } from '../src/project-import.js';
import { parseScreenplay } from '../src/core/parser.js';
import { demo } from '../data/demo.js';
import { movieSumProject } from '../worker/sources.js';
import { safeExternalUrl } from '../src/input-safety.js';

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

test('an actual controlled analysis and its provider-specific settings survive backup import', async () => {
  const source = JSON.parse(
    await readFile(new URL('../data/controlled-script/project.json', import.meta.url), 'utf8'),
  );
  const analysis = JSON.parse(
    await readFile(new URL('../data/controlled-script/analysis.json', import.meta.url), 'utf8'),
  );
  const project = { ...source, ...parseScreenplay(source), analysis };
  assert.deepEqual(
    readProjectExport(JSON.stringify({ format: 'faux-raccord-v1', project })),
    project,
  );
});

test('executable, local-file and credential-bearing source links are rejected', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///C:/Windows/win.ini',
    '//example.com',
    'https://user:password@example.com',
    'https://example.com\n/redirect',
  ]) {
    const data = backup();
    data.project.sourceUrl = url;
    assert.throws(() => readProjectExport(JSON.stringify(data)), /HTTP ou HTTPS/);
    assert.equal(safeExternalUrl(url), null);
  }
  const safe = 'https://example.com/screenplay?edition=2#sources';
  assert.equal(safeExternalUrl(safe), safe);
  const data = backup();
  data.project.sourceUrl = safe;
  assert.equal(readProjectExport(JSON.stringify(data)).sourceUrl, safe);
});

test('dangerous prototype keys are rejected even inside unknown nested metadata', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const data = backup();
    data.project.extra = JSON.parse(`{"${key}":{"polluted":true}}`);
    assert.throws(() => readProjectExport(JSON.stringify(data)), /propriété JSON non autorisée/);
  }
  assert.equal({}.polluted, undefined);
});

test('raw bytes, nesting and metadata lists are bounded before rendering', () => {
  assert.throws(() => readProjectExport(' '.repeat(5 * 1024 * 1024 + 1)), /5 Mo/);
  assert.throws(() => readProjectExport('"' + 'é'.repeat(3 * 1024 * 1024) + '"'), /5 Mo/);
  assert.throws(() => readProjectExport('['.repeat(25) + '0' + ']'.repeat(25)), /trop imbriquée/);
  const data = backup();
  data.project.extra = Array(1001).fill('item');
  assert.throws(() => readProjectExport(JSON.stringify(data)), /liste.*taille autorisée/);
});

test('UI metadata cannot contain objects where text or booleans are rendered', () => {
  for (const mutate of [
    (p) => {
      p.provenance = { rightsNotice: { unexpected: 'object' } };
    },
    (p) => {
      p.scenes[0].sourceLocator = { unexpected: 'object' };
    },
    (p) => {
      p.analysis.alerts[0].question = { unexpected: 'object' };
    },
    (p) => {
      p.synthetic = 'false';
    },
    (p) => {
      p.analysis.alerts[0].note = false;
    },
    (p) => {
      p.scenes[0].pageSegments = [{ page: 999, text: 'Forged page.' }];
    },
  ]) {
    const data = backup();
    mutate(data.project);
    assert.throws(() => readProjectExport(JSON.stringify(data)), /projet Faux Raccord valide/);
  }
});

test('duplicate analysis identities and references outside the analysed scenes are rejected', () => {
  for (const mutate of [
    (a) => {
      a.objects[1].id = a.objects[0].id;
    },
    (a) => {
      a.alerts[1].id = a.alerts[0].id;
    },
    (a) => {
      a.analyzedSceneIds.push(a.analyzedSceneIds[0]);
    },
    (a) => {
      a.analyzedSceneIds = ['S001'];
    },
    (a) => {
      a.alerts[0].entityId = 'missing-object';
    },
    (a) => {
      a.alerts[0].evidence[0].state = '<script>invalid</script>';
    },
  ]) {
    const data = backup();
    mutate(data.project.analysis);
    assert.throws(() => readProjectExport(JSON.stringify(data)), /projet Faux Raccord valide/);
  }
});

test('analysis counters, object lists and warnings cannot bypass resource and shape checks', () => {
  for (const mutate of [
    (a) => {
      a.usage.inputTokens = -1;
    },
    (a) => {
      a.milliseconds = -1;
    },
    (a) => {
      a.objects[0].aliases = Array(101).fill('watch');
    },
    (a) => {
      a.warnings = [{ text: 'not a warning string' }];
    },
    (a) => {
      a.settings = { temperature: 0, maxOutputTokens: 10000000 };
    },
  ]) {
    const data = backup();
    mutate(data.project.analysis);
    assert.throws(() => readProjectExport(JSON.stringify(data)), /projet Faux Raccord valide/);
  }
});

test('JSON-import origin markers remain ordinary bounded metadata on the next export', () => {
  const data = backup();
  data.project.importedBackup = true;
  data.project.importedFromId = data.project.id;
  data.project.analysis.imported = true;
  assert.deepEqual(readProjectExport(JSON.stringify(data)), data.project);
});
