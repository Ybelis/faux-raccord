import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseScreenplay } from '../src/core/parser.js';
import { scoreControlledAlerts, validateControlledDataset } from '../eval/controlled-metrics.mjs';

const load = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const project = await load('../data/controlled-script/project.json');
const reference = await load('../data/controlled-script/reference.json');
const annotations = await load('../data/controlled-script/annotations.json');
const originalBytes = await readFile(new URL('../data/valkaama.json', import.meta.url));
const scenes = parseScreenplay(project).scenes;
const positives = annotations.entries.filter((entry) => entry.expectedAlert);
const alertFor = (entry, id = entry.errorId) => ({
  id,
  entityName: entry.object,
  evidence: [entry.before, entry.after],
});

test('single real screenplay is preserved, with exactly fifteen declared edits to its coherent adaptation', () => {
  const result = validateControlledDataset(project, reference, annotations, originalBytes);
  assert.equal(result.valid, true, result.issues.join('\n'));
  assert.equal(result.injectionCount, 15);
  assert.equal(result.negativeControlCount, 4);
  assert.equal(result.sceneCount, 56);
  const original = parseScreenplay(JSON.parse(originalBytes)).scenes;
  for (const scene of scenes.slice(12))
    assert.equal(scene.text, original.find((s) => s.id === scene.id).text);
  assert.notEqual(project.id, reference.id);
  assert.equal(project.license, 'CC BY-SA 3.0');
});

test('one matching pair of source passages earns one TP, not a whole-case success', () => {
  const scored = scoreControlledAlerts(
    positives.slice(0, 2).map((entry) => alertFor(entry)),
    annotations,
    scenes,
  );
  assert.equal(scored.tp, 2);
  assert.equal(scored.fp, 0);
  assert.equal(scored.fn, 13);
  assert.equal(scored.recall, 2 / 15);
  assert.deepEqual(
    scored.ledger.map((row) => row.matchedErrorId),
    ['E01', 'E02'],
  );
});

test('duplicate detections cannot count the same injected error twice', () => {
  const scored = scoreControlledAlerts(
    [alertFor(positives[0], 'a'), alertFor(positives[0], 'b')],
    annotations,
    scenes,
  );
  assert.equal(scored.tp, 1);
  assert.equal(scored.fp, 1);
  assert.equal(scored.precision, 0.5);
  assert.equal(scored.ledger[1].reason, 'duplicate-gold-match');
});

test('a real quote from a wrong scene or an invented quote cannot satisfy the gold pair', () => {
  const wrong = alertFor(positives[0]);
  wrong.evidence = [{ ...positives[0].before }, { ...positives[0].after, sceneId: 'S003' }];
  const invented = alertFor(positives[1]);
  invented.evidence = [
    { ...positives[1].before },
    { sceneId: 'S999', quote: 'Lasse opens his red notebook, which is not an actual quotation.' },
  ];
  const scored = scoreControlledAlerts([wrong, invented], annotations, scenes);
  assert.equal(scored.tp, 0);
  assert.equal(scored.fp, 2);
  assert.equal(scored.fn, 15);
});

test('an explained transition is a controlled false positive; unannotated original props remain separate', () => {
  const control = annotations.entries.find((entry) => !entry.expectedAlert);
  const scored = scoreControlledAlerts(
    [alertFor(control), { id: 'original', entityName: 'original Scotch bottle', evidence: [] }],
    annotations,
    scenes,
  );
  assert.equal(scored.fp, 1);
  assert.equal(scored.unannotatedAlertCount, 1);
  assert.equal(scored.alertCount, 2);
  assert.equal(scored.ledger[0].reason, 'explained-negative-control');
  assert.equal(scored.ledger[1].status, 'unannotated');
});

test('empty predictions have zero recall and undefined precision, with no fabricated successes', () => {
  const scored = scoreControlledAlerts([], annotations, scenes);
  assert.equal(scored.recall, 0);
  assert.equal(scored.precision, null);
  assert.equal(scored.precisionCI95, null);
  assert.equal(scored.fn, 15);
});

test('a broad quote naming several props cannot earn an arbitrary true positive', () => {
  const entries = positives.slice(0, 2);
  const scored = scoreControlledAlerts(
    [
      {
        entityName: 'un objet',
        evidence: [
          { sceneId: 'S001', quote: entries.map((e) => e.before.quote).join('\n') },
          { sceneId: 'S002', quote: entries.map((e) => e.after.quote).join('\n') },
        ],
      },
    ],
    annotations,
    scenes,
  );
  assert.equal(scored.tp, 0);
  assert.equal(scored.fp, 1);
  assert.equal(scored.ledger[0].reason, 'ambiguous-object-association');
});

test('dataset validation catches an undeclared script change and a stale original hash', () => {
  const changed = structuredClone(project);
  changed.pages[0].text += '\nAn undeclared change.';
  const result = validateControlledDataset(
    changed,
    reference,
    annotations,
    Buffer.from('different source'),
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.includes('Undeclared')));
  assert.ok(result.issues.some((issue) => issue.includes('hash')));
});
