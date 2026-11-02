import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  cacheOutput,
  checkpointKey,
  dailyQuotaReached,
  fixedContentFailure,
  readCheckpoint,
  reusableOutput,
  safeProviderError,
  writeCheckpoint,
} from '../eval/qa-checkpoint.mjs';

const metadata = {
  codeHash: 'code-v1',
  datasetHash: 'data-v1',
  corpusHash: 'corpus-v1',
  protocolHash: 'protocol-v1',
  provider: 'groq',
  model: 'example-model',
  settings: { temperature: 0, reasoningEffort: 'low' },
};

test('resume preserves wrong answers from successful provider calls and never caches failures', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'faux-raccord-qa-'));
  try {
    const file = path.join(directory, 'cache.json');
    const cache = await readCheckpoint(file);
    const key = checkpointKey(metadata, 'QA001', 'baseline');
    const wrongAnswer = {
      providerSucceeded: true,
      answer: 'Une mauvaise réponse [S001]',
      citations: ['S001'],
      passed: false,
      milliseconds: 400,
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    assert.equal(cacheOutput(cache, key, wrongAnswer), true);
    assert.equal(cacheOutput(cache, 'network-failure', { error: 'quota', passed: false }), false);
    await writeCheckpoint(file, cache);
    const resumed = await readCheckpoint(file);
    assert.equal(reusableOutput(resumed.outputs[key]), true);
    assert.equal(resumed.outputs[key].passed, false);
    assert.equal(resumed.outputs[key].milliseconds, 400);
    assert.equal(resumed.outputs['network-failure'], undefined);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('faux-raccord-qa-'));
    await rm(directory, { recursive: true, force: true });
  }
});

test('cache identity separates code, data, model, settings, corpus, protocol, case and method', () => {
  const key = checkpointKey(metadata, 'QA001', 'system');
  for (const field of [
    'codeHash',
    'datasetHash',
    'corpusHash',
    'protocolHash',
    'provider',
    'model',
  ])
    assert.notEqual(checkpointKey({ ...metadata, [field]: 'other' }, 'QA001', 'system'), key);
  assert.notEqual(
    checkpointKey({ ...metadata, settings: { temperature: 0.3 } }, 'QA001', 'system'),
    key,
  );
  assert.notEqual(checkpointKey(metadata, 'QA002', 'system'), key);
  assert.notEqual(checkpointKey(metadata, 'QA001', 'baseline'), key);
  assert.equal(
    checkpointKey(
      { ...metadata, key: 'server-secret', settings: { reasoningEffort: 'low', temperature: 0 } },
      'QA001',
      'system',
    ),
    key,
  );
});

test('daily quota stops differ from minute rate limits and redact credential-looking text', () => {
  assert.equal(
    dailyQuotaReached({
      code: 'RATE_LIMIT',
      details: 'tokens per day (TPD): Limit 200000, Used 198617, Requested 5605',
    }),
    true,
  );
  assert.equal(
    dailyQuotaReached({ code: 'RATE_LIMIT', details: 'tokens per minute (TPM). Try again in 5s.' }),
    false,
  );
  assert.equal(
    dailyQuotaReached({
      code: 'PROVIDER_ERROR',
      details: 'TPD mentioned in an unrelated response',
    }),
    false,
  );
  const safe = safeProviderError({
    code: 'RATE_LIMIT',
    message: 'Rejected gsk_exampleSecret',
    details: 'Daily token limit, gsk_anotherSecret, org_privateAccount',
  });
  assert.equal(JSON.stringify(safe).includes('gsk_'), false);
  assert.equal(JSON.stringify(safe).includes('org_'), false);
  assert.equal(safe.dailyQuota, true);
});

test('invalid model JSON is frozen as a content failure instead of retried as infrastructure', () => {
  const cache = { version: 1, outputs: {} };
  const result = fixedContentFailure({ code: 'INVALID_JSON', message: 'JSON invalide' }, 500);
  assert.equal(result.passed, false);
  assert.equal(result.usageUnavailable, true);
  assert.equal(cacheOutput(cache, 'malformed', result), true);
  assert.equal(reusableOutput(cache.outputs.malformed), true);
  assert.equal(fixedContentFailure({ code: 'RATE_LIMIT', message: 'Quota atteint' }, 500), null);
  assert.equal(
    fixedContentFailure(
      { code: 'PROVIDER_ERROR', message: 'Refus (400, json_validate_failed)' },
      500,
    ).formatError,
    'INVALID_JSON',
  );
});
