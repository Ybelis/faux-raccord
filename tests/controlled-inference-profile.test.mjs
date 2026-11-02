import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTINUITY_PROFILE, withContinuityProfile } from '../src/core/inference-profile.js';

test('transport divides five candidates into 2/2/1 without changing prompts, contexts, options or signal', async () => {
  const calls = [],
    signal = new AbortController().signal;
  const candidates = Array.from({ length: 5 }, (_, index) => ({
    candidateId: `C${index}`,
    context: [{ text: `source ${index}` }],
  }));
  const config = { settings: { maxOutputTokens: 3000, temperature: 0 } };
  const model = withContinuityProfile(async (...args) => {
    calls.push(args);
    return {
      data: { results: args[2].candidates.map((c) => ({ candidateId: c.candidateId })) },
      usage: { inputTokens: 10, outputTokens: 3, milliseconds: 5 },
    };
  });
  const result = await model(
    config,
    'unchanged judge prompt',
    { candidates, marker: 'unchanged' },
    { signal, maxTokens: 3500, retries: 0 },
  );
  assert.deepEqual(
    calls.map((call) => call[2].candidates.length),
    [2, 2, 1],
  );
  assert.deepEqual(
    calls.flatMap((call) => call[2].candidates),
    candidates,
  );
  for (const [configuration, prompt, user, options] of calls) {
    assert.equal(configuration, config);
    assert.equal(prompt, 'unchanged judge prompt');
    assert.equal(user.marker, 'unchanged');
    assert.equal(options.signal, signal);
    assert.equal(options.retries, 0);
    assert.equal(options.maxTokens, 1000);
  }
  assert.deepEqual(
    result.data.results.map((r) => r.candidateId),
    candidates.map((c) => c.candidateId),
  );
  assert.deepEqual(result.usage, { calls: 3, inputTokens: 30, outputTokens: 9, milliseconds: 15 });
  assert.deepEqual(model.stats, { logicalCalls: 1, physicalCalls: 3 });
});

test('smaller user budgets are preserved for extraction and judgment', async () => {
  const options = [];
  const model = withContinuityProfile(async (config, prompt, user, opts) => {
    options.push(opts);
    return { data: {}, usage: {} };
  });
  await model({ settings: { maxOutputTokens: 700 } }, 'extract', { scenes: [] });
  await model(
    { settings: { maxOutputTokens: 700 } },
    'judge',
    { candidates: [] },
    { maxTokens: 3500 },
  );
  await model({ settings: { maxOutputTokens: 5000 } }, 'extract', { scenes: [] });
  assert.equal(options[0].maxTokens, undefined);
  assert.equal(options[1].maxTokens, 700);
  assert.equal(options[2].maxTokens, CONTINUITY_PROFILE.extractionMaxOutputTokens);
});

test('abort and provider failures propagate without silent retries or fabricated results', async () => {
  const failure = new Error('quota exceeded');
  let calls = 0;
  const model = withContinuityProfile(async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(
    model({ settings: { maxOutputTokens: 3000 } }, 'judge', { candidates: [{}, {}, {}] }),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
});
