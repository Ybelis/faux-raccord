import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeWithRetry } from '../eval/atomic-write.mjs';
import { writeCheckpoint } from '../eval/qa-checkpoint.mjs';

test('a transient Windows file lock is retried without losing the saved answers', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'faux-raccord-write-'));
  try {
    const file = path.join(directory, 'report.json');
    const report = { answers: [{ passed: false, answer: 'Réponse conservée' }] };
    let first = true;
    await writeWithRetry(file, report, {
      writer: async (...args) => {
        if (first) {
          first = false;
          throw Object.assign(new Error('Locked'), { code: 'EPERM' });
        }
        await writeCheckpoint(...args);
      },
      sleep: async () => {},
    });
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), report);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('faux-raccord-write-'));
    await rm(directory, { recursive: true, force: true });
  }
});

test('a non-transient write error is reported instead of silently discarded', async () => {
  await assert.rejects(
    () =>
      writeWithRetry(
        'unused.json',
        {},
        {
          writer: async () => {
            throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' });
          },
          sleep: async () => assert.fail('No retry on a permanent error'),
        },
      ),
    /Disk full/,
  );
});
