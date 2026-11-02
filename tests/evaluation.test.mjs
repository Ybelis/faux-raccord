import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { metricsFromConfusion } from '../src/evaluation.js';

const report = JSON.parse(await readFile(new URL('../eval/report.json', import.meta.url), 'utf8'));

test('the displayed confusion matrices match the individual recorded predictions', () => {
  for (const method of ['baseline', 'system']) {
    const counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
    for (const row of report.rows) {
      const predicted = row[method].predicted;
      const key = row.expected ? (predicted ? 'tp' : 'fn') : predicted ? 'fp' : 'tn';
      counts[key]++;
    }
    const computed = metricsFromConfusion(counts);
    assert.equal(computed.total, report.n);
    for (const key of ['tp', 'fp', 'fn', 'tn', 'precision', 'recall', 'f1']) {
      assert.ok(Math.abs(computed[key] - report[method][key]) < 1e-10, `${method}.${key}`);
    }
  }
});

test('no positive prediction is undefined precision, not a fabricated perfect score', () => {
  const result = metricsFromConfusion({ tp: 0, fp: 0, fn: 21, tn: 29 });
  assert.equal(result.precision, null);
  assert.equal(result.recall, 0);
  assert.equal(result.accuracy, 0.58);
  assert.equal(metricsFromConfusion({ tp: -1, fp: 0, fn: 0, tn: 1 }), null);
});
